# ReactiveExtream (rx-pipeline-puzzle) Implementation Plan

正式ゲーム名は **ReactiveExtream**（Extream = Extreme × Stream の造語）。リポジトリ名・内部識別子（localStorage キー等）は開発コードの rx-pipeline-puzzle を継続使用する。

## 目的

ReactiveXのストリーム変換を、タイムライン上の論理パズルとして遊べる最小プロトタイプを作る。最初の目標は、1ステージを最後まで遊べる縦切り実装を完成させること。

## 制作プロセス

1. コンセプトペーパーを確認する
   - ゲームの核となる体験を明文化する。
   - ストリーム、イベント、完了、時間軸、正解判定の扱いを固定する。
   - ReactiveX互換性よりも、パズルとして理解しやすい仕様を優先する。

2. 画面サンプル案を比較する
   - 入力、パイプライン、現在出力、正解出力の配置を比較する。
   - 正解との一致・不足・余分・時刻ずれが直感的に見えるかを確認する。
   - 初心者ステージと上級ステージの情報密度が同じUIで耐えられるかを確認する。

3. 最小プロトタイプを実装する
   - 単一入力ストリームを扱う。
   - `map`, `filter`, `take`, `skip` を最初の関数パーツにする。
   - パイプラインは横方向に関数パネルを並べる方式にする。
   - 再生、一時停止、リセット、速度変更を実装する。
   - 正解ストリームと現在出力を比較し、1周一致したらクリアにする。

4. ステージ定義を外出しする
   - 入力ストリーム、正解ストリーム、使用可能パーツ、制限条件をJSONで定義する。
   - 初期ステージは3から5問に絞る。
   - 問題ごとの学習目標を短く持たせる。

5. プレイ感を調整する
   - 失敗理由が見える差分表示を入れる。
   - 関数パネルのパラメータ編集を素早くする。
   - 過剰な説明文よりも、ミニ例と即時フィードバックで理解させる。

## 最初の実装スコープ

### 必須

- 固定タイムラインの入力ストリーム表示
- 関数パーツの追加・並び替え・削除
- 関数パーツのパラメータ編集
- 現在出力ストリームのリアルタイム再計算
- 正解ストリームとの比較表示
- 再生、一時停止、リセット、速度変更
- クリア判定

### 後回し

- 複数入力ストリーム
- エラーイベント
- 非同期時間系オペレータ
- ステージエディタ
- ユーザー作問共有
- ReactiveXライブラリとの完全互換

## データモデル案

```ts
type StreamEvent = {
  t: number;
  value: number | string | boolean;
  kind: "next" | "complete" | "error";
};

type OperatorNode = {
  id: string;
  type: "map" | "filter" | "take" | "skip";
  params: Record<string, string | number | boolean>;
};

type Stage = {
  id: string;
  title: string;
  input: StreamEvent[];
  expected: StreamEvent[];
  availableOperators: OperatorNode["type"][];
  maxNodes?: number;
};
```

## 最初のステージ案

1. `map(x * 2)`
   - 入力: `1, 2, 3`
   - 正解: `2, 4, 6`

2. `filter(x >= 3)`
   - 入力: `1, 4, 2, 5, 3`
   - 正解: `4, 5, 3`

3. `filter` + `map`
   - 入力: `1, 2, 3, 4, 5`
   - 正解: `6, 8, 10`

4. `skip` + `take`
   - 入力: `A, B, C, D, E`
   - 正解: `B, C, D`

5. 複数解を許す問題
   - 同じ正解に到達する別解を認め、試行錯誤の幅を残す。

## 技術方針

- 最初は静的フロントエンドで十分。
- UI状態、ステージ定義、ストリーム評価器を分ける。
- ReactiveX本体に依存せず、小さな評価器を自前で作る。
- 将来RxJS互換モードを追加できるよう、オペレータ実装は純粋関数に寄せる。

## v0 確定仕様（`prototype/` 実装準拠）

最初の縦切り実装で採用した仕様。concept.html の「案A + 出力レーンのみ案Bのオーバーレイ」を採用する。

### タイムラインとイベント

- 時間は `t = 0 .. duration` の離散値。イベントは整数 `t` に置く。
- v0 では 1 ストリームにつき同時刻イベントは最大 1 個とする（差分表示を単純化するため）。
- ストリームは `{ events: {t, value}[], completeAt: number }` で表す。エラーイベントは扱わない。

### オペレータの意味論

オペレータは**39個・10系統**（基本32＋高階4＋エラー3）。完了時刻に触れないものは明記しない限り完了不変。

**基礎**: `map(op, k)`（op ∈ +−×%）／ `filter(cmp, k)`（cmp ∈ ≥ > ≤ < = ≠。「偶数のみ」等の組み込み条件は置かず `map(x%2)`+`filter(=0)` で解かせる）／ `take(n)`（n個目で完了前倒し）／ `skip(n)`

**状態**: `scan(op, seed)`（op ∈ acc+x, acc×x, max, min。各イベントで累積値）／ `distinctUntilChanged`（直前と同値を捨てる）／ `takeWhile(cmp, k)`（破れたイベントは出さず、その時刻で完了）／ `startWith(v)`（t=0 に挿入。入力は t=0 を空けておく）

**時間**: `delay(d)`（イベントと完了を +d。タイムライン外は描画しない）／ `throttleTime(d)`（発火後 d 未満を捨てる・先頭優先）／ `debounceTime(d)`（t+d に発火予約、次イベントが先なら上書き。完了時に保留があれば完了時刻に放出）／ `reduce(op, seed)`（完了時刻に畳み込み結果を1個）

**変換**: `mapTo(c)` ／ `index`（値→通し番号 0,1,2,…）／ `timestamp`（値→発生時刻）／ `last`（完了時刻に最後の値を1個）

**位置**: `takeLast(n)` / `skipLast(n)`（末尾 n 個を残す/捨てる。Rx は完了時一括放出だが、同時刻1イベント制約のため元の時刻を保つ位置ベース仕様）／ `elementAt(n)`（n 番目だけ。出した瞬間に完了前倒し）／ `defaultIfEmpty(c)`（イベントが 0 個なら完了時刻に c を1個）

**選別**: `distinct`（一度出た値は二度と通さない）／ `takeUntil(t)`（t 以降を捨て、完了も t に前倒し）／ `skipUntil(t)`（t より前を捨てる）／ `auditTime(d)`（イベント到着で窓 [t, t+d] を開き、閉じた時刻に窓内の最新値。窓は延長されない。完了時に閉じていない保留分は捨てる）

**合流（2入力）**: `merge`（時系列に合流。同時刻衝突は A 優先・ステージデータでは回避）／ `zip(op)`（k 番目同士を合成し遅い方の時刻に発火。完了は「短い方の完了」と「最後の組」の遅い方）／ `combineLatest(op)`（両方が値を出した後、どちらかの更新ごとに最新同士を合成。同時刻更新は1回だけ発火）／ `withLatestFrom(op)`（A 側イベントでのみ発火し B の最新値（同時刻含む）を添える。B が未発行なら捨てる）。op ∈ {a+b, a−b, a×b, max}

**制御（2入力）**: `sample`（B の合図時刻に A の最新値。前回の合図から新しい発行がなければ出さない）／ `takeUntil(B)`（B の最初のイベントで完了前倒し。B が空なら素通し）／ `skipUntil(B)`（B の最初のイベント以降だけ通す。B が空なら全て捨てる）／ `race`（最初のイベントが早い方を丸ごと採用。同時刻は A 優先）

**展開（高階ストリーム）**: `mergeMap` / `concatMap` / `switchMap` / `exhaustMap`。各イベントから「d 間隔 × count 回のエコー」の内部ストリームを展開し、重なりの捌き方だけが異なる（merge=並行 / concat=順番待ち / switch=乗り換え / exhaust=取り込み中は無視）。初期値 `count=1, d=0` は恒等変換。

**エラー**: `catchError(v)`（✕ を値 v に変えて正常完了）／ `retry(n)`（エラー時刻から録画を n 回まで再購読）／ `timeout(d)`（無音が d を超えたら ✕ で終端）

2入力ステージではパイプラインが2本になる。**パイプライン A（メイン）**は入力 A を処理し、2入力オペレータを置ける。**パイプライン B** は合流前に B を加工する単入力専用のパイプライン（空なら B は原本のまま）。2入力オペレータは「メイン側の現在のストリーム」と「パイプライン B の出力」を合成する。`maxNodes` は A/B 合計に対する上限。ステージ定義に `inputB` があるときだけ入力レーン B・パイプライン B を表示し、2入力オペレータを提供する。

- 追加直後のパラメータは原則「ストリームが変化しない中立値」（map: ×1、filter/takeWhile: ≥0、take/skip: 1、時間系: d=0 等）。中立値が存在しない scan/reduce や パラメータなしオペレータの導入ステージは、複数候補から正しいオペレータを選ばせる形にする。
- パーツの提供範囲: 各サイクルの前半4問（導入）はステージ定義の `availableOperators` で絞り（「正しいオペレータを選ぶ」課題。選択肢はそのサイクルまでに登場するものに限る）、後半4問（応用）は**そのサイクルまでに登場した全パーツ**を累積開放する（一覧が答えのヒントにならず、かつ未登場パーツは出さない）。2入力オペレータは `inputB` のあるステージでのみ提供。
- 「パーツを追加」ボタンはホバーで各オペレータの動作説明（`OPERATOR_DOCS`）をポップアップ表示する。
- `skip(count)`: 先頭 count 個を捨てる。完了時刻は不変。
- `take(count)`: 先頭 count 個だけ通す。**入力に count 個以上イベントがある場合、完了時刻は count 個目のイベントと同じ `t` に前倒しされる**（Rx の take 即時完了に対応）。足りない場合は元の完了時刻のまま。

### 正解判定と差分分類

パイプライン変更のたびに出力を即時再計算し、正解と比較する。各時刻 `t` ごとに:

- 出力と正解が同時刻・同値 → `match`（緑）
- 同時刻だが値が違う → `wrong`（赤 + 正解値をゴースト表示）
- 出力にだけある → `extra`（赤）
- 正解にだけある → `missing`（破線ゴースト）
- 完了時刻の一致は独立に判定し、ずれていれば正解位置をゴーストの完了バーで示す。

`extra = missing = wrong = 0` かつ完了時刻一致でステージクリア条件成立。

### 再生とクリアフロー

1. 再生はループ。ステージ開始時から自動で再生状態になり、末尾に達したら先頭に巻き戻して繰り返す。
2. 出力の再計算は編集のたびに行うが、判定の**確定はゴールライン（タイムライン末尾）到達時**。編集するとスイープが先頭からやり直しになり、バッジは「検査中…」表示で点滅する。
3. サイクル開始カードの表示中は再生を止め、「はじめる」を押してから先頭から流し始める（裏で勝手に進むのを避けるため）。
4. ゴールライン到達時に判定を確定。一致ならクリア演出＋次ステージ導線を出して停止、不一致なら差分内訳をバッジに表示してループ継続。
4. 再生の途中でパイプラインを編集したら演出・判定は取り消し、再スイープする。

### パラメータ編集 UI

- 自由入力の式（eval）は使わず、演算子はセレクト、**数値は −/+ ボタンのステッパー**で編集する。キーボード入力欄は置かない（ネイティブの number スピナーは当たり判定が小さく、スマホではソフトキーボードまで出てしまうため）。長押しで連射（400ms 後に 90ms 間隔）、値は `role="spinbutton"` でフォーカスでき矢印キー・PageUp/Down・Home/End でも動く。
- 数値には上下限を持たせ、端ではボタンを無効化する。時間系（`delay` / `throttleTime` / `debounceTime` / `auditTime` / `timeout` / `takeUntil(t)` 等）の上限は**そのステージの `duration`**（タイムラインの外は意味がないため）。個数系は 20、`retry` は 5、`mergeMap` 系の count は 6、値・seed 系は ±99。
- パネルごとに削除・左右移動ボタンを持つ。ドラッグ&ドロップは v0 では実装しない。
- ステージの `maxNodes` に達したら追加ボタンを無効化する。

### ステージデータ

- v0 では `prototype/app.js` 先頭の `STAGES` 配列（純粋な構造化データ）に置く。JSON 化してそのまま外出しできる形を維持する。
- 全 94 ステージ・12サイクル。「4つ新関数の導入 → 4つ応用」×8 ＋ Cycle 9: 実践編（実務題材8問・スペックモード）＋ Cycle 10: 分岐編（B 前処理6問）＋ Cycle 11: 展開編（mergeMap/concatMap/switchMap/exhaustMap の高階ストリーム8問）＋ Cycle 12: エラー編（catchError/retry/timeout 8問）。サイクルはサイズ可変（`CYCLES` に size/opsThrough/intro を定義）。
- **高階ストリーム（Cycle 11）**: 各イベントから「d 間隔×count 回のエコー」の内部ストリームを展開する。4オペレータの違いは重なりの捌き方のみ（merge=並行 / concat=順番待ち / switch=乗り換え / exhaust=取り込み中は無視)。初期値 count=1, d=0 は恒等変換。
- **エラー終端（Cycle 12）**: ストリームの終端は complete（｜）または error（✕、`stream.error`）。判定は終端種別の一致も要求（バッジ「終端種別ずれ」）。既定伝播は「完了時刻を動かさないオペレータは終端種別を引き継ぎ、前倒しした場合は正常完了」（take が error を消すのは Rx 準拠）。catchError=値に変えて正常完了 / retry=エラー時刻から録画を再購読（n 回）/ timeout=無音が d を超えたら ✕。
### 多言語対応（日本語 / 英語）

- 既定は日本語。トップページ右上の国旗ボタン（🇯🇵 / 🇺🇸）で切り替え、選択は localStorage（キー `rx-pipeline-puzzle/lang`）に保存してゲーム画面にも引き継ぐ。`?lang=en` / `?lang=ja` でも指定できる。切り替え時に `<html lang>` も更新する。
- 実装は `prototype/i18n.js`（UI 文字列辞書と `t(key, params)`、`I18N.applyStatic()`）＋ `prototype/i18n-en.js`（英訳データ）。UI 文字列は `{name}` プレースホルダ付きのキーで引き、未翻訳キーは自動的に日本語へフォールバックする。
- **ステージ定義（STAGES）と CYCLES は日本語を原本のまま保持**し、英語は `I18N_STAGES_EN` / `I18N_CYCLES_EN` で id をキーに上書きする。これにより STAGES 側は純データ（JSON 外出し可能）を維持できる。オペレータ説明とパラメータ表示（`describe`）も `t("op.xxx", …)` 経由。
- HTML の静的文字列は `data-i18n`（textContent）／ `data-i18n-html`（innerHTML）／ `data-i18n-title`（title 属性）で印を付け、マークアップには日本語の原文を書いたまま `applyStatic()` で差し替える。JS が動かない場合でも日本語では読める状態を保つため。

### サウンド（BGM / 効果音）

- 音源は **ElevenLabs API** で生成する。生成スクリプトは `tools/gen-audio.mjs`（`node tools/gen-audio.mjs` で未生成分のみ、`<id>` 指定で個別に作り直し、`--force` で全再生成）。プロンプトと尺はこのスクリプト内のデータとして持つ。API キーは `.env`（gitignore 済み）または macOS キーチェーン（`elevenlabs-api-key`）から読む。
- 生成後は ffmpeg で後処理する: 無音のトリム → `loudnorm`（SFX は I=-16、BGM は I=-18）→ `alimiter` でクリップ防止。生成直後の raw は `prototype/assets/audio/raw/`（gitignore）に残し、後処理のやり直しで API を再度叩かずに済ませる。
- 実装は `prototype/audio.js`（`GameAudio`）。**Master ← { Music, Sfx }** のバス構成で、スライダー値(0..1)は -40dB〜0dB の対数カーブに変換して適用する。効果音は再生ごとに ±3% のピッチ揺らぎを与え、連打時の機械的な反復を防ぐ。クリア演出中は Music を 25% にダッキングして戻す。
- 再生経路は 2 系統。`file://` では `fetch` がブロックされ `decodeAudioData` が使えないため、`HTMLAudioElement` にフォールバックする（`GameAudio.mode()` が `webaudio` / `element` を返す）。どちらでも音量・ピッチ揺らぎ・ダッキングは同等に動く。
- 設定は localStorage（キー `rx-pipeline-puzzle/audio`）。**BGM・効果音とも既定オン**（BGM は `music: 0.6` と効果音より控えめに始める）。ヘッダーのスピーカーボタンからミュートと3系統の音量を操作する。ブラウザの自動再生規制に合わせ、最初のポインタ操作かキー入力で `unlock()` してからデコードする。
- 音源の試聴用ページ: `prototype/audio-check.html`（各音の再生ボタンと、ゲーム内で鳴る場面の対応表）。

- **学習支援**: クリア時にプレイヤーの解を RxJS コードとして自動生成表示（簡略化オペレータには「本物はこう違う」注記）＋ステージの `insight`（現実での使いどころ）。「もう表示しない」チェックで非表示化でき、画面下部のボタンで復元。パーツボタンのホバーにはテキストマーブル図（`-12-3--4-|` 記法）で before/after を表示。3段階ヒント（考え方→パーツ名→完全解、`SOLUTIONS` の正準解から自動生成。不一致3回で点滅誘導）。サイクル開始時に1度だけテーマカードを表示（localStorage 記録）。Cycle 9 はスペックモード（正解レーンは最初の判定確定まで非表示、差分色も出さない）。Cycle 1: 基礎編（map/filter/take/skip）、Cycle 2: 状態編（scan/distinctUntilChanged/takeWhile/startWith）、Cycle 3: 時間編（delay/throttleTime/debounceTime/reduce）、Cycle 4: 変換編（mapTo/index/timestamp/last）、Cycle 5: 位置編（takeLast/skipLast/elementAt/defaultIfEmpty）、Cycle 6: 選別編（distinct/takeUntil/skipUntil/auditTime）、Cycle 7: 合流編（merge/zip/combineLatest/withLatestFrom）、Cycle 8: 制御編（sample/takeUntil(B)/skipUntil(B)/race）。ステージ選択はサイクルごとの optgroup で区切る。
- Cycle 7-8 の応用は現実の ReactiveX パターン（保存ボタン=withLatestFrom、料金ダッシュボード=combineLatest、請求突合=zip、Redux カウンター=merge+scan、定点観測=sample、タイムアウト=race、type-ahead=debounce+distinctUntilChanged、ドラッグ&ドロップ=takeUntil(B)+scan+last）を題材にしている。
- 実世界パターンのステージはステージ定義の `inputLabel` / `inputBLabel` でシグナル名（例:「保存クリック」「草稿の更新」）を持ち、入力レーンの見出しに「入力 A: 保存クリック」の形で表示する。ラベルのないステージは従来どおり「入力ストリーム (A/B)」。
- Cycle 9 実践編の題材: 時計ずれ補正（delay+merge）、二重配信の排除（merge+distinct）、アラートのフラッピング抑制（distinctUntilChanged+debounce）、ログイン失敗ロック（elementAt+mapTo）、クォータ警告（scan+filter+take）、SLA フォールバック（takeUntil+defaultIfEmpty）、プログレスバー（mapTo+scan+map）、時間窓の集計（skipUntil+takeUntil+reduce）。
- 2入力パーツのカードは青系スタイル＋「⤵ パイプライン B と合成」バッジで合流位置を明示し、パイプライン見出しにも合流の説明を表示する。パイプライン B パネルは応用ステージ（または openAll）のみ表示し、導入ステージでは B は常に原本のまま合流する。
- Cycle 10 分岐編の題材（B 側前処理が必須）: ノイズ除去して合流（B: filter → merge。合流後除去の別解も許容）、単位換算して合流（B: map×12 → merge）、突き合わせのオフセット補正（B: skip → zip）、notifier の誤検知除去（B: filter → takeUntil(B)）、クロックの間引き（B: throttleTime → sample）、上流での入力サニタイズ（B: filter → combineLatest。合流後に弾くと汚染された最新値が残ることを教える）。
- 判定は出力ストリームのみで行うため、別解（例: filter→map と map→filter）は自然に許容される。
- クリア済みステージ id は `localStorage`（キー `rx-pipeline-puzzle/cleared-v2`）に保存し、ステージ選択に ✔ を表示する。

### 画面構成

- `prototype/index.html`: トップページ。ゲーム概要と「ゲームをはじめる」ボタン。SEO / OG メタ、非公式である旨の免責を含む。
- `prototype/game.html`: ゲーム画面本体（ヘッダーのタイトルからトップへ戻れる）。
- `prototype/analytics.js`: 計測アダプタ。既定は無効で何も送らない。設計は [metrics.md](metrics.md)。

### 公開構成

`prototype/` がそのまま公開サイトのルートになる。`.github/workflows/pages.yml` が `prototype/` を `_site/`、`docs/` を `_site/docs/` に並べ替えて GitHub Pages にデプロイする（ビルドなし）。公開 URL は `https://hummer98.dev/rx-pipeline-puzzle/`。canonical / OG の URL もこれを前提にしている。

## 次の作業

1. ~~`concept.html` の画面案から採用する基本レイアウトを選ぶ。~~ → 案A + 出力レーンのみ案Bオーバーレイで確定。
2. ~~プロトタイプの技術スタックを決める。~~ → 依存なしの静的 HTML/CSS/JS（`prototype/`）で確定。
3. ~~1ステージ縦切りの実装タスクに分解する。~~ → v0 実装済み。
4. ステージ定義の JSON 外出しとローダの追加。**外部からのステージ投稿の唯一の障壁がここ**（CONTRIBUTING.md は暫定的に `STAGES` 配列への直接追加を案内している）。
5. 同時刻に複数イベントを許す場合の順序規則と差分表示の拡張を決める。
6. ~~エラーイベント・複数入力ストリーム（案C系）の導入時期を決める。~~ → Cycle 7-8（2入力）・Cycle 12（エラー終端）として実装済み。
7. 公開後: 計測プロバイダを決めて `analytics.js` の CONFIG を設定する（[metrics.md](metrics.md) §4）。

