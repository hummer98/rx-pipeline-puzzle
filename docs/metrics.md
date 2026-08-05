# 計測設計 (metrics)

ReactiveExtream で「何を・なぜ・どう測るか」。実装は [`prototype/analytics.js`](../prototype/analytics.js) と `prototype/app.js` の計測フックです。

**既定では何も送信しません。** `analytics.js` の `CONFIG.provider` が `"none"` の間、外部への通信は 1 バイトも発生しません。

---

## 1. 何を知りたいのか

アクセス数そのものは目的ではありません。知りたいのは次の 4 つだけです。

| 問い | それを表す指標 |
| --- | --- |
| **人は来ているか** | ランディングのユニーク訪問数 |
| **来た人は遊ぶか** | 「ゲームをはじめる」到達率 → **プレイ率**（パーツを 1 個でも置いた割合） |
| **遊んだ人は続くか** | 到達サイクル、クリア数のマイルストーン |
| **どこで折れるか** | ステージ別の初回クリア数（急に落ちる箇所＝難易度の壁）、ヒント使用率 |

最重要は **プレイ率**（ゲーム画面 PV に対する `play` の比）です。ここが低ければ、記事を何本書いても意味がありません。

---

## 2. イベント一覧

すべて Cookie 不使用・個人識別子なし。重複抑止は端末内の `localStorage` / `sessionStorage` のフラグだけで行い、そのフラグ自体は送信しません。

| イベント | 発火タイミング | 重複抑止 | 仮想パス | 何が分かるか |
| --- | --- | --- | --- | --- |
| `pageview` | ページ読み込み | なし | 実パス | アクセス数・流入元・ランディング/ゲームの比 |
| `play` | **最初のパーツを置いた瞬間** | タブで 1 回 | `/e/play` | **真のプレイ回数**（開いただけと区別する） |
| `stage-clear` | ステージ初回クリア | 端末で永続 | `/e/stage-clear/stage-07` | ステージ別の突破人数＝難易度の壁 |
| `progress` | クリア数が 1/3/8/16/32/48/64/80 に達した | 端末で永続 | `/e/progress/8` | 継続の深さ（サイクル 1 完走 = 8） |
| `all-clear` | 94 ステージ全クリア | 端末で永続 | `/e/all-clear` | 完走者の数 |
| `cycle-reach` | 各サイクルの導入カード初表示 | 端末で永続（既存の記録に相乗り） | `/e/cycle-reach/3` | どのサイクルまで到達したか |
| `hint` | ヒント 1/2/3 段目を初めて開いた | タブで段階ごと 1 回 | `/e/hint/2` | 難易度が破綻していないか |

### 設計上の判断

- **`stage-clear` は初回のみ。** 94 ステージ × リトライ回数を全部送るとノイズになるうえ、知りたいのは「何人が突破したか」なので初回で足ります。
- **`progress` はマイルストーンのみ。** 1〜94 の全カウントを送る価値はありません。区切りは「1 問目（＝離脱の最大の崖）」「8 = サイクル 1 完走」「以降は 16 刻み」。
- **`hint` にステージ ID を付けない。** 付けると 94 × 3 通りに散り、どのステージも母数が小さすぎて読めません。詰まる場所は `stage-clear` の落差から読みます。
- **解答内容・パイプラインの中身は送らない。** 知りたいことに寄与せず、送る理由がありません。
- **「ゲームをはじめる」のクリックは計測しない。** ページ遷移と送信が競合して取りこぼすため、数字が信用できません。起動率は `game.html` と `index.html` のページビュー比で求めます（同じことが分かって、こちらは落ちません）。

### イベントを「仮想パス」に落とす理由

GoatCounter や Cloudflare のようにパス単位でしか集計できないサービスでも、`/e/stage-clear/stage-07` の形にしておけば、ページ一覧をソートするだけでファネルが読めます。プロパティを持てるサービス（Plausible / Umami）では props としても送っています。

---

## 3. 主要指標の作り方

| 指標 | 計算 | 見るべき点 |
| --- | --- | --- |
| プレイ率 | `play` ÷ `game.html` の PV | 40% を切るなら、ゲーム画面の第一印象か初手の分かりにくさ |
| 起動率 | `game.html` の PV ÷ `index.html` の PV | ランディングの文言・OG が機能しているか |
| 1 問目突破率 | `stage-clear/stage-01` ÷ `play` | ここが低いなら Stage 1 が難しすぎる（チュートリアル失敗） |
| サイクル 1 完走率 | `progress/8` ÷ `play` | 教材として成立しているかの最初の関門 |
| 難易度の壁 | `stage-clear/stage-NN` を N 順に並べる | 急落する箇所がレベルデザインの欠陥 |
| ヒント依存度 | `hint/3` ÷ `hint/1` | 3 段目（完全解）に流れる比率が高いなら 2 段目が弱い |

---

## 4. 計測サービスの選択

### 現在の構成: 自前コレクタ（Cloudflare Workers + D1）

外部サービスに依存せず、**データを自分で持つ**構成にしてあります。実装は [`tools/collector/`](../tools/collector/)。

```
ブラウザ ──POST──> https://t.hummer98.dev/e (Workers) ──> D1 (rx-metrics)
```

| 項目 | 値 |
| --- | --- |
| 受け口 | `https://t.hummer98.dev/e`（Worker 名 `rx-metrics`） |
| 保存先 | D1 `rx-metrics` — 1 イベント 1 行（[`schema.sql`](../tools/collector/schema.sql)） |
| 費用 | 無料枠内（D1 は 5GB / 書き込み 10 万行日、Workers は 10 万リクエスト日） |
| 対象 | `site="game"`（本ゲーム）と `site="site"`（hummer98.dev の受注窓口）の**両方**を同じテーブルに集約 |

同じテーブルに 2 面を入れているのは、**ゲーム → 受注窓口 → 問い合わせのファネルを 1 本の SQL で追う**ためです。

ゲーム側の設定は `prototype/analytics.js` の CONFIG 3 行だけです。

```js
provider: "endpoint",
site: "game",
endpointUrl: "https://t.hummer98.dev/e",
```

受注窓口側（`hummer98/hummer98.github.io` の `index.html`）は、依存を増やさないため同等の処理を 20 行程度インラインで持たせています（`pageview` と `contact` のみ）。

### ログの見方

**1. ターミナルから定型クエリ**（[`tools/collector/queries.sql`](../tools/collector/queries.sql) にプレイ率・難易度の壁・流入元・ファネルを用意してあります）

```sh
npx wrangler d1 execute rx-metrics --remote --command "SELECT day, name, COUNT(*) n FROM events WHERE day >= date('now','-7 day') GROUP BY day, name ORDER BY day DESC"
```

Cloudflare ダッシュボードの D1 コンソールでも同じ SQL が打てます。

**2. Claude Code に聞く。** `--json` で結果が返るので、「今週のプレイ率は」「どのステージで人が消えているか」と聞けば集計して答えられます。ダッシュボードを作る前に、まずこれで足ります。

**3. 週次サマリを Discord に流す**（未実装）。Cron Triggers で集計して投稿する。数字は「見に行く」より「流れてくる」ほうが続きます。

HTML のダッシュボードは、数字が動き始めてから検討すれば十分です。

### 乗り換える場合

`analytics.js` の `CONFIG.provider` を切り替えるだけで乗り換えられます。ゲーム側（`app.js`）の変更は不要です。

| プロバイダ | 費用 | Cookie | カスタムイベント | 備考 |
| --- | --- | --- | --- | --- |
| **自前コレクタ** ★採用中 | 無料枠内 | なし | ○ | Workers + D1。データを自分で持てる。上表参照 |
| GoatCounter | **個人利用のみ**無料 | なし | ○（パスとして記録） | 手軽。商用サイトは有料プラン（$5/月〜）が要る |
| Plausible | 有料（$9/月〜） | なし | ○（props 付き） | 見た目とダッシュボードが最良。セルフホストも可 |
| Umami Cloud | 無料枠あり | なし | ○（props 付き） | セルフホストも可 |
| Cloudflare Web Analytics | 無料 | なし | **×** | PV のみ。**プレイ回数もクリア数も取れない** |
| 自前エンドポイント | — | なし | ○ | `provider: "endpoint"` で JSON を POST |

**Cloudflare Web Analytics 単体では本ドキュメントの指標のうち PV しか取れません。** アクセス数だけで良いなら最も手軽ですが、プレイ率・突破率を見たいなら GoatCounter を推奨します（両方入れることも可能ですが、二重計測になるので通常は不要です）。

### 有効化の手順（GoatCounter の例）

1. <https://www.goatcounter.com/> でサイトを登録し、`<code>.goatcounter.com` のコード部分を控える
2. `prototype/analytics.js` の CONFIG を書き換える

   ```js
   provider: "goatcounter",
   goatcounterCode: "reactive-extream",   // 自分のコード
   ```

3. 公開サイトで開き、GoatCounter のダッシュボードにヒットが出ることを確認する

ローカルで動作確認したいときは `debug: true, allowLocalhost: true` にすると、送信内容が console に出ます（`provider: "none"` のままでも動きます）。

---

## 5. プライバシー方針

この設計は「同意バナーを出さなくてよい状態」を維持することを前提にしています。壊さないでください。

- Cookie / `localStorage` による**訪問者 ID を作らない**（重複抑止フラグは値が `"1"` のみで、送信もしない）
- **IP アドレスは保存しない。** User-Agent も文字列としては保存せず、`mobile` / `desktop` の 2 値にだけ落とす
- 流入元は**ホスト名だけ**に切り詰めて保存する（クエリ付き URL は個人を特定しうるため捨てる）
- 国コード（`request.cf.country`）は保存する。地域分布より粗い情報は取らない
- コレクタは自サイト以外の Origin からの送信を受け付けない（403）。イベント名もホワイトリスト方式
- `navigator.doNotTrack` / `navigator.globalPrivacyControl` が有効なら送信しない
- `localhost` / `*.local` / `file://` では送信しない（開発が数字を汚さないため）
- 1 セッションあたりの送信上限 300 件（暴走時のストッパー）
- 送信は best-effort。失敗してもゲームの動作には一切影響しない

---

## 6. 計測を足すとき

1. まず「その数字を見て**何を変えるのか**」を 1 行で書けるか確認する。書けないなら足さない。
2. `app.js` から `track(name, props)` / `trackOnce(key, name, props, scope)` を呼ぶ。プロバイダ固有の API は絶対に直接呼ばない。
3. カーディナリティを確認する。仮想パスが数百通りに散るイベントは、母数が小さすぎて読めません。
4. **ページ遷移を伴うクリックは、自前コレクタ構成でのみ計測してよい。** 現在の `endpoint` 送信は `fetch(..., { keepalive: true })` なので、遷移が始まっても送信は完了します（`outbound` / `contact` はこれに依存）。GoatCounter 等のピクセル GET に戻す場合は取りこぼすので、その時は計測をやめるか遷移を遅延させてください。
5. この表に 1 行追加する。
