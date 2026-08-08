"use strict";

// ============================================================
// Stage definitions
// 純粋な構造化データとして分離してある。将来はこのまま JSON に
// 外出しできる形（関数・DOM 参照を含めない）を維持すること。
// 制約: v0 では 1 ストリームにつき同時刻イベントは最大 1 個。
//
// 構成: 「4つ新関数 → 4つ応用」×4サイクル = 全32ステージ。
//   Cycle 1 (1-8):   基礎編  map / filter / take / skip
//   Cycle 2 (9-16):  状態編  scan / distinctUntilChanged / takeWhile / startWith
//   Cycle 3 (17-24): 時間編  delay / throttleTime / debounceTime / reduce
//   Cycle 4 (25-32): 変換編  mapTo / index / timestamp / last
// パラメータなしオペレータの導入ステージ（9,10,26,27,28）は
// 「複数の候補から正しいオペレータを選ぶ」ことが課題になる。
// ============================================================

// size: サイクル内のステージ数（前半4問が導入、残りが応用）
// opsThrough: このサイクル終了時点で解放済みのオペレータ数
//             （ALL_OPERATOR_TYPES の先頭からこの個数。キー順は登場順の契約）
// intro: サイクル開始時に1度だけ見せるカードの本文と新パーツ
const CYCLES = [
  { title: "Cycle 1: 基礎編", size: 8, opsThrough: 4,
    intro: "ストリームは「時間軸に並んだ値」と、その終わりを告げる「完了（縦棒 ｜）」でできている。完了も位置を合わせる対象。まずは値を変え、選び、切り出す4つの基本から。",
    parts: "map / filter / take / skip" },
  { title: "Cycle 2: 状態編", size: 8, opsThrough: 8,
    intro: "「これまでに何が来たか」を覚えるオペレータたち。累積・変化検出・条件打ち切り・先頭挿入。",
    parts: "scan / distinctUntilChanged / takeWhile / startWith" },
  { title: "Cycle 3: 時間編", size: 8, opsThrough: 12,
    intro: "イベントの「いつ」を操る。ずらす・間引く・待つ・締めに集計。UIイベント処理の主戦場。",
    parts: "delay / throttleTime / debounceTime / reduce" },
  { title: "Cycle 4: 変換編", size: 8, opsThrough: 16,
    intro: "値の中身ではなく「順序・時刻・存在」というメタ情報を値に変える。",
    parts: "mapTo / index / timestamp / last" },
  { title: "Cycle 5: 位置編", size: 8, opsThrough: 20,
    intro: "末尾から数える・n番目だけ・空のときの代役。位置と境界の道具箱。",
    parts: "takeLast / skipLast / elementAt / defaultIfEmpty" },
  { title: "Cycle 6: 選別編", size: 8, opsThrough: 24,
    intro: "履歴で選ぶ・時刻で切る・様子を見る。選別の上級編。",
    parts: "distinct / takeUntil / skipUntil / auditTime" },
  { title: "Cycle 7: 合流編", size: 8, opsThrough: 28,
    intro: "ここから入力が2本になる。合流のしかたで意味が変わる——時系列・ペア・最新同士・主従。",
    parts: "merge / zip / combineLatest / withLatestFrom" },
  { title: "Cycle 8: 制御編", size: 8, opsThrough: 32,
    intro: "片方のストリームで、もう片方を制御する。合図・打ち切り・開始・競争。",
    parts: "sample / takeUntil(B) / skipUntil(B) / race" },
  { title: "Cycle 9: 実践編", size: 8, opsThrough: 32,
    intro: "新しいパーツはなし。実務で本当に起きる問題を、正解を見ずに（スペックモード）組み立てる。",
    parts: "全パーツ開放 ／ 正解ストリームは最初の検査後に表示" },
  { title: "Cycle 10: 分岐編", size: 6, opsThrough: 32,
    intro: "パイプラインは A / B の2本。「B をきれいにしてから合流する」——ストリーム設計で最も大切な判断。",
    parts: "全パーツ開放（B 側の前処理が鍵）" },
  { title: "Cycle 11: 展開編", size: 8, opsThrough: 36,
    intro: "1つのイベントが小さなストリームに化ける。重なりをどう捌くかが merge/concat/switch/exhaust の分かれ道。",
    parts: "mergeMap / concatMap / switchMap / exhaustMap" },
  { title: "Cycle 12: エラー編", size: 8, opsThrough: 39,
    intro: "ストリームは ✕（エラー）でも終わる。受け止める・やり直す・見切りをつける。",
    parts: "catchError / retry / timeout" },
];

// index → { c: サイクル番号, pos: サイクル内位置 }
function cycleOfIndex(index) {
  let acc = 0;
  for (let c = 0; c < CYCLES.length; c++) {
    acc += CYCLES[c].size;
    if (index < acc) return { c, pos: index - (acc - CYCLES[c].size) };
  }
  return { c: CYCLES.length - 1, pos: 0 };
}

const STAGES = [
  // ---------- Cycle 1: 基礎編 ----------
  {
    id: "stage-01",
    title: "Stage 1: 2倍の世界",
    goal: "map を使って、各値を 2 倍にした正解ストリームを作ろう。（縦棒 ｜ はストリームの終わり。ここも正解と揃える必要がある）",
    duration: 8,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 2 },
        { t: 5, value: 3 },
      ],
      completeAt: 6,
    },
    expected: {
      events: [
        { t: 1, value: 2 },
        { t: 3, value: 4 },
        { t: 5, value: 6 },
      ],
      completeAt: 6,
    },
    availableOperators: ["map"],
    maxNodes: 2,
  },
  {
    id: "stage-02",
    title: "Stage 2: 3以上だけ通す",
    goal: "filter を使って、3 以上の値だけを通そう。",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 4 },
        { t: 5, value: 2 },
        { t: 7, value: 5 },
        { t: 9, value: 3 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 3, value: 4 },
        { t: 7, value: 5 },
        { t: 9, value: 3 },
      ],
      completeAt: 11,
    },
    availableOperators: ["filter"],
    maxNodes: 2,
  },
  {
    id: "stage-03",
    title: "Stage 3: 先頭だけ取る",
    goal: "take で先頭 3 個だけを通そう。take は完了時刻も前倒しすることに注目。",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 7 },
        { t: 3, value: 8 },
        { t: 5, value: 9 },
        { t: 7, value: 10 },
        { t: 9, value: 11 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 1, value: 7 },
        { t: 3, value: 8 },
        { t: 5, value: 9 },
      ],
      completeAt: 5,
    },
    availableOperators: ["take"],
    maxNodes: 2,
  },
  {
    id: "stage-04",
    title: "Stage 4: 先頭を捨てる",
    goal: "skip で先頭 2 個を捨てよう。take と違って完了時刻は動かない。",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 2 },
        { t: 5, value: 3 },
        { t: 7, value: 4 },
        { t: 9, value: 5 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 5, value: 3 },
        { t: 7, value: 4 },
        { t: 9, value: 5 },
      ],
      completeAt: 11,
    },
    availableOperators: ["skip"],
    maxNodes: 2,
  },
  {
    id: "stage-05",
    title: "Stage 5: 余りの世界",
    goal: "map の % を使って、3 で割った余りに変換しよう。",
    duration: 10,
    input: {
      events: [
        { t: 1, value: 3 },
        { t: 3, value: 5 },
        { t: 5, value: 8 },
        { t: 7, value: 10 },
      ],
      completeAt: 9,
    },
    expected: {
      events: [
        { t: 1, value: 0 },
        { t: 3, value: 2 },
        { t: 5, value: 2 },
        { t: 7, value: 1 },
      ],
      completeAt: 9,
    },
    availableOperators: ["map"],
    maxNodes: 2,
  },
  {
    id: "stage-06",
    title: "Stage 6: 偶数を探せ",
    goal: "偶数のイベントだけを、値 0 として取り出そう。2 で割った余りが鍵。",
    insight: "「判定用の値を map で先に作り、filter で選ぶ」2段分解の最小例。実務でも先に特徴量を作ると条件式が単純になります。",
    duration: 14,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 2 },
        { t: 5, value: 3 },
        { t: 7, value: 4 },
        { t: 9, value: 5 },
        { t: 11, value: 6 },
      ],
      completeAt: 13,
    },
    expected: {
      events: [
        { t: 3, value: 0 },
        { t: 7, value: 0 },
        { t: 11, value: 0 },
      ],
      completeAt: 13,
    },
    availableOperators: ["map", "filter"],
    maxNodes: 2,
  },
  {
    id: "stage-07",
    title: "Stage 7: 真ん中を切り出す",
    goal: "skip と take で真ん中の 3 個を切り出そう。完了時刻にも注意。",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 10 },
        { t: 3, value: 20 },
        { t: 5, value: 30 },
        { t: 7, value: 40 },
        { t: 9, value: 50 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 3, value: 20 },
        { t: 5, value: 30 },
        { t: 7, value: 40 },
      ],
      completeAt: 7,
    },
    availableOperators: ["map", "filter", "take", "skip"],
    maxNodes: 3,
  },
  {
    id: "stage-08",
    title: "Stage 8: 完了だけ早める",
    goal: "値は 1 つも変えずに、完了時刻だけを早めるには？",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 2 },
        { t: 3, value: 4 },
        { t: 5, value: 6 },
        { t: 7, value: 8 },
        { t: 9, value: 10 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 1, value: 2 },
        { t: 3, value: 4 },
        { t: 5, value: 6 },
        { t: 7, value: 8 },
        { t: 9, value: 10 },
      ],
      completeAt: 9,
    },
    availableOperators: ["map", "filter", "take", "skip"],
    maxNodes: 2,
  },

  // ---------- Cycle 2: 状態編 ----------
  {
    id: "stage-09",
    title: "Stage 9: 積み上げ",
    goal: "ここまでの合計を流すオペレータはどれ？（scan は累積値を毎回出す）",
    duration: 10,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 2 },
        { t: 5, value: 3 },
        { t: 7, value: 4 },
      ],
      completeAt: 9,
    },
    expected: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 3 },
        { t: 5, value: 6 },
        { t: 7, value: 10 },
      ],
      completeAt: 9,
    },
    availableOperators: ["scan", "map", "filter"],
    maxNodes: 2,
  },
  {
    id: "stage-10",
    title: "Stage 10: 変化だけを見る",
    goal: "同じ値が続いたら 1 回だけにしたい。どのオペレータを選ぶ？",
    duration: 14,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 1 },
        { t: 5, value: 2 },
        { t: 7, value: 2 },
        { t: 9, value: 2 },
        { t: 11, value: 3 },
      ],
      completeAt: 13,
    },
    expected: {
      events: [
        { t: 1, value: 1 },
        { t: 5, value: 2 },
        { t: 11, value: 3 },
      ],
      completeAt: 13,
    },
    availableOperators: ["distinctUntilChanged", "filter", "skip"],
    maxNodes: 2,
  },
  {
    id: "stage-11",
    title: "Stage 11: 破れるまで",
    goal: "5 未満「の間だけ」通そう。条件が破れた瞬間に完了する。filter との違いに注目。",
    duration: 10,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 3 },
        { t: 5, value: 7 },
        { t: 7, value: 2 },
      ],
      completeAt: 9,
    },
    expected: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 3 },
      ],
      completeAt: 5,
    },
    availableOperators: ["takeWhile", "filter", "take"],
    maxNodes: 2,
  },
  {
    id: "stage-12",
    title: "Stage 12: 最初のひと声",
    goal: "t=0 に 1 を差し込もう。startWith はストリームの先頭に値を足す。",
    duration: 9,
    input: {
      events: [
        { t: 2, value: 2 },
        { t: 4, value: 4 },
        { t: 6, value: 8 },
      ],
      completeAt: 8,
    },
    expected: {
      events: [
        { t: 0, value: 1 },
        { t: 2, value: 2 },
        { t: 4, value: 4 },
        { t: 6, value: 8 },
      ],
      completeAt: 8,
    },
    availableOperators: ["startWith", "map", "scan"],
    maxNodes: 2,
  },
  {
    id: "stage-13",
    title: "Stage 13: 合計が6に達したら",
    goal: "累積和が 6 以上になってからのイベントだけを通そう。出力の値は累積値になる。",
    insight: "累積値にしきい値を掛ける形は、課金量・スクロール量・進捗など「合計がここを超えたら」系の実装そのものです。",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 2 },
        { t: 5, value: 3 },
        { t: 7, value: 4 },
        { t: 9, value: 5 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 5, value: 6 },
        { t: 7, value: 10 },
        { t: 9, value: 15 },
      ],
      completeAt: 11,
    },
    availableOperators: ["scan", "filter", "map", "take"],
    maxNodes: 3,
  },
  {
    id: "stage-14",
    title: "Stage 14: 記録更新だけ速報",
    goal: "「これまでの最大値」が更新された瞬間だけを流そう。",
    insight: "scan(max)+distinctUntilChanged は「最高記録の更新速報」。株価の高値更新やハイスコア通知で使う定番です。",
    duration: 14,
    input: {
      events: [
        { t: 1, value: 3 },
        { t: 3, value: 1 },
        { t: 5, value: 4 },
        { t: 7, value: 4 },
        { t: 9, value: 2 },
        { t: 11, value: 5 },
      ],
      completeAt: 13,
    },
    expected: {
      events: [
        { t: 1, value: 3 },
        { t: 5, value: 4 },
        { t: 11, value: 5 },
      ],
      completeAt: 13,
    },
    availableOperators: ["scan", "distinctUntilChanged", "filter", "map"],
    maxNodes: 3,
  },
  {
    id: "stage-15",
    title: "Stage 15: 種を仕込む",
    goal: "掛け算で積み上げたいが、最初の種が足りない。t=0 から始まる正解をよく見て。",
    duration: 7,
    input: {
      events: [
        { t: 2, value: 3 },
        { t: 4, value: 4 },
      ],
      completeAt: 6,
    },
    expected: {
      events: [
        { t: 0, value: 2 },
        { t: 2, value: 6 },
        { t: 4, value: 24 },
      ],
      completeAt: 6,
    },
    availableOperators: ["startWith", "scan", "map"],
    maxNodes: 3,
  },
  {
    id: "stage-16",
    title: "Stage 16: 偶奇の切り替わり",
    goal: "偶数の並びから奇数の並びに変わった瞬間（またはその逆）だけを検出しよう。出力の値は 2 で割った余り（0/1）で表す。",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 2 },
        { t: 3, value: 4 },
        { t: 5, value: 1 },
        { t: 7, value: 3 },
        { t: 9, value: 6 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 1, value: 0 },
        { t: 5, value: 1 },
        { t: 9, value: 0 },
      ],
      completeAt: 11,
    },
    availableOperators: ["map", "distinctUntilChanged", "filter"],
    maxNodes: 3,
  },

  // ---------- Cycle 3: 時間編 ----------
  {
    id: "stage-17",
    title: "Stage 17: 2秒遅れの世界",
    goal: "delay で全イベントを 2 ずらそう。完了時刻も一緒に動く。",
    duration: 10,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 2 },
        { t: 5, value: 3 },
      ],
      completeAt: 7,
    },
    expected: {
      events: [
        { t: 3, value: 1 },
        { t: 5, value: 2 },
        { t: 7, value: 3 },
      ],
      completeAt: 9,
    },
    availableOperators: ["delay"],
    maxNodes: 2,
  },
  {
    id: "stage-18",
    title: "Stage 18: 連打お断り",
    goal: "throttleTime は発火したら一定時間、後続を無視する（先頭側が残る）。",
    insight: "throttleTime は連打対策の第一候補。「最初の1回を即時に通す」のが debounce との違いで、ボタンの二重送信防止はこちらです。",
    duration: 11,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 2, value: 2 },
        { t: 3, value: 3 },
        { t: 5, value: 4 },
        { t: 8, value: 5 },
      ],
      completeAt: 10,
    },
    expected: {
      events: [
        { t: 1, value: 1 },
        { t: 5, value: 4 },
        { t: 8, value: 5 },
      ],
      completeAt: 10,
    },
    availableOperators: ["throttleTime", "debounceTime"],
    maxNodes: 2,
  },
  {
    id: "stage-19",
    title: "Stage 19: 落ち着いてから",
    goal: "debounceTime は静かになるまで待ってから最後の値を出す。発火時刻がずれることに注目。",
    insight: "debounceTime は「入力が落ち着いてから」の定番。検索ボックス、ウィンドウリサイズ、自動保存で毎日使われています。",
    duration: 11,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 2, value: 2 },
        { t: 3, value: 3 },
        { t: 7, value: 4 },
      ],
      completeAt: 10,
    },
    expected: {
      events: [
        { t: 5, value: 3 },
        { t: 9, value: 4 },
      ],
      completeAt: 10,
    },
    availableOperators: ["debounceTime", "throttleTime"],
    maxNodes: 2,
  },
  {
    id: "stage-20",
    title: "Stage 20: 全部かけ算",
    goal: "reduce は完了時に畳み込んだ結果を 1 個だけ出す。全部掛け合わせよう（初期値に注意）。",
    duration: 8,
    input: {
      events: [
        { t: 1, value: 5 },
        { t: 3, value: 3 },
        { t: 5, value: 2 },
      ],
      completeAt: 7,
    },
    expected: {
      events: [
        { t: 7, value: 30 },
      ],
      completeAt: 7,
    },
    availableOperators: ["reduce", "scan", "take"],
    maxNodes: 2,
  },
  {
    id: "stage-21",
    title: "Stage 21: どっちの間引き？",
    goal: "throttleTime か debounceTime、正解になるのは片方だけ。正解ストリームから見分けよう。",
    duration: 9,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 2, value: 2 },
        { t: 5, value: 3 },
      ],
      completeAt: 8,
    },
    expected: {
      events: [
        { t: 4, value: 2 },
        { t: 7, value: 3 },
      ],
      completeAt: 8,
    },
    availableOperators: ["throttleTime", "debounceTime"],
    maxNodes: 2,
  },
  {
    id: "stage-22",
    title: "Stage 22: 間引いてから合計",
    goal: "間引いてから reduce で合計する。答えの 1 個の値から間引き方を逆算しよう。",
    duration: 11,
    input: {
      events: [
        { t: 1, value: 5 },
        { t: 2, value: 1 },
        { t: 3, value: 1 },
        { t: 5, value: 2 },
        { t: 8, value: 3 },
      ],
      completeAt: 10,
    },
    expected: {
      events: [
        { t: 10, value: 11 },
      ],
      completeAt: 10,
    },
    availableOperators: ["throttleTime", "debounceTime", "reduce"],
    maxNodes: 2,
  },
  {
    id: "stage-23",
    title: "Stage 23: 選んで、数えて、ずらす",
    goal: "5 以上の先頭 2 個を、2 遅らせて届けよう。3 枚のパーツの順番が鍵。",
    duration: 14,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 5 },
        { t: 5, value: 2 },
        { t: 7, value: 6 },
        { t: 9, value: 3 },
        { t: 11, value: 7 },
      ],
      completeAt: 13,
    },
    expected: {
      events: [
        { t: 5, value: 5 },
        { t: 9, value: 6 },
      ],
      completeAt: 9,
    },
    availableOperators: ["filter", "take", "skip", "delay"],
    maxNodes: 3,
  },
  {
    id: "stage-24",
    title: "Stage 24: 落ち着いたら10倍",
    goal: "静かになってから届いた値を 10 倍しよう。",
    duration: 10,
    input: {
      events: [
        { t: 1, value: 7 },
        { t: 2, value: 8 },
        { t: 6, value: 9 },
      ],
      completeAt: 9,
    },
    expected: {
      events: [
        { t: 4, value: 80 },
        { t: 8, value: 90 },
      ],
      completeAt: 9,
    },
    availableOperators: ["debounceTime", "throttleTime", "map"],
    maxNodes: 2,
  },

  // ---------- Cycle 4: 変換編 ----------
  {
    id: "stage-25",
    title: "Stage 25: 全部同じに",
    goal: "mapTo は値を捨てて全部同じ値に置き換える。残る情報はタイミングだけ。",
    duration: 10,
    input: {
      events: [
        { t: 1, value: 3 },
        { t: 4, value: 1 },
        { t: 7, value: 4 },
      ],
      completeAt: 9,
    },
    expected: {
      events: [
        { t: 1, value: 7 },
        { t: 4, value: 7 },
        { t: 7, value: 7 },
      ],
      completeAt: 9,
    },
    availableOperators: ["mapTo", "map", "filter"],
    maxNodes: 2,
  },
  {
    id: "stage-26",
    title: "Stage 26: 通し番号",
    goal: "値を「何番目か」（0 始まり）に置き換えるオペレータはどれ？",
    duration: 10,
    input: {
      events: [
        { t: 1, value: 5 },
        { t: 3, value: 5 },
        { t: 5, value: 5 },
        { t: 7, value: 5 },
      ],
      completeAt: 9,
    },
    expected: {
      events: [
        { t: 1, value: 0 },
        { t: 3, value: 1 },
        { t: 5, value: 2 },
        { t: 7, value: 3 },
      ],
      completeAt: 9,
    },
    availableOperators: ["index", "mapTo", "timestamp"],
    maxNodes: 2,
  },
  {
    id: "stage-27",
    title: "Stage 27: 時は値なり",
    goal: "値がその発生時刻と同じになっている。値を時刻に置き換えるオペレータはどれ？",
    duration: 11,
    input: {
      events: [
        { t: 2, value: 7 },
        { t: 5, value: 7 },
        { t: 8, value: 7 },
      ],
      completeAt: 10,
    },
    expected: {
      events: [
        { t: 2, value: 2 },
        { t: 5, value: 5 },
        { t: 8, value: 8 },
      ],
      completeAt: 10,
    },
    availableOperators: ["timestamp", "index", "mapTo"],
    maxNodes: 2,
  },
  {
    id: "stage-28",
    title: "Stage 28: 最後だけ",
    goal: "完了時に最後の値だけを届けたい。どのオペレータを選ぶ？",
    duration: 9,
    input: {
      events: [
        { t: 1, value: 4 },
        { t: 3, value: 8 },
        { t: 5, value: 6 },
      ],
      completeAt: 8,
    },
    expected: {
      events: [
        { t: 8, value: 6 },
      ],
      completeAt: 8,
    },
    availableOperators: ["last", "reduce", "take"],
    maxNodes: 2,
  },
  {
    id: "stage-29",
    title: "Stage 29: アクセス時刻の記録",
    goal: "アクセスの内容ではなく発生時刻だけをログに残したい。ただし残すのは t=5 以降の分だけ。",
    insight: "timestamp で時間を値に変えると、時刻の条件を filter など普通の値の道具で書けます。ログ処理で頻出の発想です。",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 7 },
        { t: 3, value: 2 },
        { t: 5, value: 9 },
        { t: 7, value: 4 },
        { t: 9, value: 6 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 5, value: 5 },
        { t: 7, value: 7 },
        { t: 9, value: 9 },
      ],
      completeAt: 11,
    },
    availableOperators: ["timestamp", "filter", "take", "skip"],
    maxNodes: 2,
  },
  {
    id: "stage-30",
    title: "Stage 30: 番号で切る",
    goal: "最初の 2 個だけ通したいが、完了は動かしたくない。take では無理。さて？",
    duration: 10,
    input: {
      events: [
        { t: 1, value: 8 },
        { t: 3, value: 6 },
        { t: 5, value: 4 },
        { t: 7, value: 2 },
      ],
      completeAt: 9,
    },
    expected: {
      events: [
        { t: 1, value: 0 },
        { t: 3, value: 1 },
      ],
      completeAt: 9,
    },
    availableOperators: ["index", "filter", "takeWhile", "take"],
    maxNodes: 2,
  },
  {
    id: "stage-31",
    title: "Stage 31: イベントカウンター",
    goal: "「今何個目？」（1 始まり）を流すカウンターを作ろう。作り方は 1 つではない。",
    duration: 10,
    input: {
      events: [
        { t: 1, value: 4 },
        { t: 3, value: 7 },
        { t: 5, value: 1 },
        { t: 7, value: 8 },
      ],
      completeAt: 9,
    },
    expected: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 2 },
        { t: 5, value: 3 },
        { t: 7, value: 4 },
      ],
      completeAt: 9,
    },
    availableOperators: ["mapTo", "scan", "index", "map"],
    maxNodes: 2,
  },
  {
    id: "stage-32",
    title: "Stage 32: 最終問題",
    goal: "変換し、選び、時を値に変え、遅らせる——ただしこの順ではない。4 枚をつなぐ総合問題。順番がすべて。",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 3 },
        { t: 3, value: 1 },
        { t: 7, value: 4 },
      ],
      completeAt: 9,
    },
    expected: {
      events: [
        { t: 5, value: 10 },
        { t: 9, value: 18 },
      ],
      completeAt: 11,
    },
    availableOperators: ["delay", "timestamp", "filter", "map", "scan", "take"],
    maxNodes: 4,
  },

  // ---------- Cycle 5: 位置編 ----------
  {
    id: "stage-33",
    title: "Stage 33: 終わり良ければ",
    goal: "末尾から数えて 2 個だけを残そう。",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 2 },
        { t: 5, value: 3 },
        { t: 7, value: 4 },
        { t: 9, value: 5 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 7, value: 4 },
        { t: 9, value: 5 },
      ],
      completeAt: 11,
    },
    availableOperators: ["takeLast", "take", "elementAt"],
    maxNodes: 2,
  },
  {
    id: "stage-34",
    title: "Stage 34: 最後は見なかったことに",
    goal: "末尾の 2 個を捨てよう。take と違って完了は動かない。",
    duration: 10,
    input: {
      events: [
        { t: 1, value: 5 },
        { t: 3, value: 6 },
        { t: 5, value: 7 },
        { t: 7, value: 8 },
      ],
      completeAt: 9,
    },
    expected: {
      events: [
        { t: 1, value: 5 },
        { t: 3, value: 6 },
      ],
      completeAt: 9,
    },
    availableOperators: ["skipLast", "take", "takeWhile"],
    maxNodes: 2,
  },
  {
    id: "stage-35",
    title: "Stage 35: 3番目の男",
    goal: "0 始まりで 2 番目（=3個目）だけを通そう。出した瞬間に完了する。",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 4 },
        { t: 3, value: 8 },
        { t: 5, value: 15 },
        { t: 7, value: 16 },
        { t: 9, value: 23 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 5, value: 15 },
      ],
      completeAt: 5,
    },
    availableOperators: ["elementAt", "take", "filter"],
    maxNodes: 2,
  },
  {
    id: "stage-36",
    title: "Stage 36: 何も来なかった日",
    goal: "空のストリームに、完了時の代役を 1 人立てよう。",
    duration: 6,
    input: {
      events: [],
      completeAt: 5,
    },
    expected: {
      events: [
        { t: 5, value: 7 },
      ],
      completeAt: 5,
    },
    availableOperators: ["defaultIfEmpty", "startWith", "mapTo"],
    maxNodes: 2,
  },
  {
    id: "stage-37",
    title: "Stage 37: 狙い撃ち",
    goal: "0 始まりで 3 番目の値 1 個だけを、その時刻で完了させて届けよう。解き方は 1 つではない。",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 3 },
        { t: 3, value: 1 },
        { t: 5, value: 4 },
        { t: 7, value: 1 },
        { t: 9, value: 5 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 7, value: 1 },
      ],
      completeAt: 7,
    },
    availableOperators: ["takeLast", "take", "skip", "elementAt"],
    maxNodes: 2,
  },
  {
    id: "stage-38",
    title: "Stage 38: 真ん中だけ・改",
    goal: "Stage 7 と同じ真ん中 3 個。ただし今回は完了を動かしてはいけない。",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 10 },
        { t: 3, value: 20 },
        { t: 5, value: 30 },
        { t: 7, value: 40 },
        { t: 9, value: 50 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 3, value: 20 },
        { t: 5, value: 30 },
        { t: 7, value: 40 },
      ],
      completeAt: 11,
    },
    availableOperators: ["skip", "skipLast", "take", "takeLast"],
    maxNodes: 2,
  },
  {
    id: "stage-39",
    title: "Stage 39: 全滅からの復活",
    goal: "まず全部を消し、それから代役を 1 個立てる。",
    duration: 8,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 2 },
        { t: 5, value: 3 },
      ],
      completeAt: 7,
    },
    expected: {
      events: [
        { t: 7, value: 9 },
      ],
      completeAt: 7,
    },
    availableOperators: ["filter", "defaultIfEmpty", "mapTo", "take"],
    maxNodes: 2,
  },
  {
    id: "stage-40",
    title: "Stage 40: 最後の一個",
    goal: "最後の値 1 個。ただし完了はその値の時刻で。last では完了が動かないことに注意。",
    duration: 9,
    input: {
      events: [
        { t: 1, value: 2 },
        { t: 3, value: 4 },
        { t: 5, value: 6 },
      ],
      completeAt: 8,
    },
    expected: {
      events: [
        { t: 5, value: 6 },
      ],
      completeAt: 5,
    },
    availableOperators: ["elementAt", "last", "take", "takeLast"],
    maxNodes: 2,
  },

  // ---------- Cycle 6: 選別編 ----------
  {
    id: "stage-41",
    title: "Stage 41: 二度目はなし",
    goal: "一度出た値は二度と通さない。distinctUntilChanged との違いは？",
    duration: 14,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 2 },
        { t: 5, value: 1 },
        { t: 7, value: 3 },
        { t: 9, value: 2 },
        { t: 11, value: 4 },
      ],
      completeAt: 13,
    },
    expected: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 2 },
        { t: 7, value: 3 },
        { t: 11, value: 4 },
      ],
      completeAt: 13,
    },
    availableOperators: ["distinct", "distinctUntilChanged", "filter"],
    maxNodes: 2,
  },
  {
    id: "stage-42",
    title: "Stage 42: タイムリミット",
    goal: "t=5 になったら打ち切り。イベントの個数ではなく、時刻で切る。",
    duration: 11,
    input: {
      events: [
        { t: 2, value: 3 },
        { t: 4, value: 6 },
        { t: 6, value: 9 },
        { t: 8, value: 12 },
      ],
      completeAt: 10,
    },
    expected: {
      events: [
        { t: 2, value: 3 },
        { t: 4, value: 6 },
      ],
      completeAt: 5,
    },
    availableOperators: ["takeUntil", "take", "takeWhile"],
    maxNodes: 2,
  },
  {
    id: "stage-43",
    title: "Stage 43: 開店は5時",
    goal: "t=5 より前のイベントは受け付けない。filter では値の並びを選べないはず。",
    duration: 11,
    input: {
      events: [
        { t: 2, value: 9 },
        { t: 4, value: 7 },
        { t: 6, value: 2 },
        { t: 8, value: 8 },
      ],
      completeAt: 10,
    },
    expected: {
      events: [
        { t: 6, value: 2 },
        { t: 8, value: 8 },
      ],
      completeAt: 10,
    },
    availableOperators: ["skipUntil", "filter", "takeUntil"],
    maxNodes: 2,
  },
  {
    id: "stage-44",
    title: "Stage 44: 様子見してから",
    goal: "最初のイベントから一定時間だけ様子を見て、その間の最新値を出す。audit の窓は debounce と違って延長されない。",
    duration: 9,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 2, value: 2 },
        { t: 3, value: 3 },
      ],
      completeAt: 8,
    },
    expected: {
      events: [
        { t: 4, value: 3 },
      ],
      completeAt: 8,
    },
    availableOperators: ["auditTime", "debounceTime", "throttleTime"],
    maxNodes: 2,
  },
  {
    id: "stage-45",
    title: "Stage 45: 値札は一度だけ",
    goal: "3 で割った余りのうち、初登場だけを通そう。",
    duration: 10,
    input: {
      events: [
        { t: 1, value: 3 },
        { t: 3, value: 5 },
        { t: 5, value: 6 },
        { t: 7, value: 8 },
      ],
      completeAt: 9,
    },
    expected: {
      events: [
        { t: 1, value: 0 },
        { t: 3, value: 2 },
      ],
      completeAt: 9,
    },
    availableOperators: ["map", "distinct", "distinctUntilChanged", "filter"],
    maxNodes: 2,
  },
  {
    id: "stage-46",
    title: "Stage 46: 営業時間",
    goal: "t=3 開店、t=8 閉店。営業時間内のイベントだけを通し、完了は閉店時刻。",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 5 },
        { t: 3, value: 6 },
        { t: 5, value: 7 },
        { t: 7, value: 8 },
        { t: 9, value: 9 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 3, value: 6 },
        { t: 5, value: 7 },
        { t: 7, value: 8 },
      ],
      completeAt: 8,
    },
    availableOperators: ["skipUntil", "takeUntil", "skip", "take"],
    maxNodes: 2,
  },
  {
    id: "stage-47",
    title: "Stage 47: 間引き三兄弟",
    goal: "throttle / debounce / audit のうち正解になるのは 1 つだけ。挙動の違いを見抜こう。",
    insight: "throttle=先頭優先で間引く／debounce=静けさを待つ／audit=窓の最後にまとめる。UI イベントの間引き選定ミスは実務の定番バグです。",
    duration: 11,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 2, value: 2 },
        { t: 3, value: 3 },
        { t: 7, value: 4 },
      ],
      completeAt: 10,
    },
    expected: {
      events: [
        { t: 3, value: 2 },
        { t: 5, value: 3 },
        { t: 9, value: 4 },
      ],
      completeAt: 10,
    },
    availableOperators: ["throttleTime", "debounceTime", "auditTime"],
    maxNodes: 2,
  },
  {
    id: "stage-48",
    title: "Stage 48: 卒業試験",
    goal: "重複を除き、t=10 で打ち切り、その合計を完了時に 1 個だけ届けよう。",
    duration: 14,
    input: {
      events: [
        { t: 1, value: 2 },
        { t: 3, value: 3 },
        { t: 5, value: 2 },
        { t: 7, value: 5 },
        { t: 9, value: 3 },
        { t: 11, value: 7 },
      ],
      completeAt: 13,
    },
    expected: {
      events: [
        { t: 10, value: 10 },
      ],
      completeAt: 10,
    },
    availableOperators: ["distinct", "takeUntil", "scan", "last", "reduce", "filter"],
    maxNodes: 4,
  },

  // ---------- Cycle 7: 合流編（2入力） ----------
  {
    id: "stage-49",
    title: "Stage 49: 通知を一本に",
    goal: "メール(A)とチャット(B)、2つの通知チャネルを時系列で1本にまとめよう。",
    inputLabel: "メール通知",
    inputBLabel: "チャット通知",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 5, value: 4 },
        { t: 9, value: 6 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 3, value: 2 },
        { t: 7, value: 5 },
      ],
      completeAt: 9,
    },
    expected: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 2 },
        { t: 5, value: 4 },
        { t: 7, value: 5 },
        { t: 9, value: 6 },
      ],
      completeAt: 11,
    },
    availableOperators: ["merge", "zip", "combineLatest"],
    maxNodes: 2,
  },
  {
    id: "stage-50",
    title: "Stage 50: ペアで足す",
    goal: "A と B の k 番目同士を組にして足そう。組が揃った瞬間（遅い方）に発火する。",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 5, value: 2 },
        { t: 9, value: 3 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 3, value: 10 },
        { t: 7, value: 20 },
      ],
      completeAt: 9,
    },
    expected: {
      events: [
        { t: 3, value: 11 },
        { t: 7, value: 22 },
      ],
      completeAt: 9,
    },
    availableOperators: ["zip", "merge", "combineLatest"],
    maxNodes: 2,
  },
  {
    id: "stage-51",
    title: "Stage 51: 合計金額ボード",
    goal: "単価(A)×数量(B)。どちらが更新されても、最新同士の積を出し直そう。",
    inputLabel: "単価",
    inputBLabel: "数量",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 100 },
        { t: 7, value: 200 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 3, value: 1 },
        { t: 5, value: 2 },
        { t: 9, value: 3 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 3, value: 100 },
        { t: 5, value: 200 },
        { t: 7, value: 400 },
        { t: 9, value: 600 },
      ],
      completeAt: 11,
    },
    availableOperators: ["combineLatest", "zip", "withLatestFrom"],
    maxNodes: 2,
  },
  {
    id: "stage-52",
    title: "Stage 52: 押した瞬間の値",
    goal: "クリック(A、値は0)のたびに、フォーム(B)の最新値を読み取ろう。B側の更新では発火しない。",
    inputLabel: "クリック",
    inputBLabel: "フォーム入力",
    duration: 12,
    input: {
      events: [
        { t: 2, value: 0 },
        { t: 6, value: 0 },
        { t: 10, value: 0 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 1, value: 3 },
        { t: 4, value: 5 },
        { t: 8, value: 8 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 2, value: 3 },
        { t: 6, value: 5 },
        { t: 10, value: 8 },
      ],
      completeAt: 11,
    },
    availableOperators: ["withLatestFrom", "combineLatest", "merge"],
    maxNodes: 2,
  },
  {
    id: "stage-53",
    title: "Stage 53: 保存ボタンは2回まで",
    goal: "保存クリック(A)のたびに草稿(B)の最新版を保存。ただし保存できるのは先頭の 2 回だけ。",
    insight: "クリックを主役に最新フォーム値を添える withLatestFrom は「保存ボタン」の実装そのもの。combineLatest だと入力のたびに保存されてしまいます。",
    inputLabel: "保存クリック",
    inputBLabel: "草稿の更新",
    duration: 12,
    input: {
      events: [
        { t: 2, value: 0 },
        { t: 5, value: 0 },
        { t: 9, value: 0 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 1, value: 10 },
        { t: 4, value: 20 },
        { t: 8, value: 30 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 2, value: 10 },
        { t: 5, value: 20 },
      ],
      completeAt: 5,
    },
    availableOperators: ["withLatestFrom", "combineLatest", "take", "throttleTime"],
    maxNodes: 2,
  },
  {
    id: "stage-54",
    title: "Stage 54: 高額アラート",
    goal: "単価(A)×数量(B)を常に再計算し、1000 以上になったときだけ警告を出そう。",
    insight: "combineLatest は複数の入力値から派生値を再計算する UI の心臓部。フォームの合計欄やダッシュボードはこれです。",
    inputLabel: "単価",
    inputBLabel: "数量",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 100 },
        { t: 5, value: 300 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 3, value: 2 },
        { t: 7, value: 4 },
        { t: 9, value: 5 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 7, value: 1200 },
        { t: 9, value: 1500 },
      ],
      completeAt: 11,
    },
    availableOperators: ["combineLatest", "zip", "filter"],
    maxNodes: 2,
  },
  {
    id: "stage-55",
    title: "Stage 55: 請求と支払の差額",
    goal: "請求(A)と支払(B)を伝票順に突き合わせ、差額 a - b を出そう。",
    insight: "zip は「k 番目同士」の突き合わせ。順序が保証されたペアリング専用で、保証がない相手に使うと事故になります。",
    inputLabel: "請求書",
    inputBLabel: "支払い",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 5 },
        { t: 3, value: 3 },
        { t: 5, value: 7 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 2, value: 5 },
        { t: 6, value: 4 },
        { t: 10, value: 7 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 2, value: 0 },
        { t: 6, value: -1 },
        { t: 10, value: 0 },
      ],
      completeAt: 11,
    },
    availableOperators: ["zip", "combineLatest", "withLatestFrom"],
    maxNodes: 2,
  },
  {
    id: "stage-56",
    title: "Stage 56: カウンターの心臓部",
    goal: "＋1ボタン(A)と −1ボタン(B)を合流させ、現在のカウント値を流そう（Redux の reducer と同じ形）。",
    insight: "merge+scan は Redux の dispatch+reducer と同型。イベントを1本に合流して畳み込む——状態管理の核はこれだけです。",
    inputLabel: "+1 ボタン",
    inputBLabel: "−1 ボタン",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 5, value: 1 },
        { t: 7, value: 1 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 3, value: -1 },
        { t: 9, value: -1 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 0 },
        { t: 5, value: 1 },
        { t: 7, value: 2 },
        { t: 9, value: 1 },
      ],
      completeAt: 11,
    },
    availableOperators: ["merge", "scan", "zip", "map"],
    maxNodes: 2,
  },

  // ---------- Cycle 8: 制御編（2入力） ----------
  {
    id: "stage-57",
    title: "Stage 57: 毎時の検針",
    goal: "メーター(A)は不規則に動く。クロック(B)が鳴った瞬間の最新値を記録しよう。",
    inputLabel: "メーター値",
    inputBLabel: "検針クロック",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 2 },
        { t: 2, value: 5 },
        { t: 4, value: 3 },
        { t: 8, value: 8 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 3, value: 0 },
        { t: 6, value: 0 },
        { t: 9, value: 0 },
      ],
      completeAt: 10,
    },
    expected: {
      events: [
        { t: 3, value: 5 },
        { t: 6, value: 3 },
        { t: 9, value: 8 },
      ],
      completeAt: 11,
    },
    availableOperators: ["sample", "withLatestFrom", "debounceTime"],
    maxNodes: 2,
  },
  {
    id: "stage-58",
    title: "Stage 58: 停止シグナル",
    goal: "B の停止シグナルが来た瞬間に、データ(A)を打ち切って完了しよう。",
    inputLabel: "データ",
    inputBLabel: "停止シグナル",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 2 },
        { t: 5, value: 3 },
        { t: 7, value: 4 },
        { t: 9, value: 5 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 6, value: 0 },
      ],
      completeAt: 8,
    },
    expected: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 2 },
        { t: 5, value: 3 },
      ],
      completeAt: 6,
    },
    availableOperators: ["takeUntilB", "skipUntilB", "take"],
    maxNodes: 2,
  },
  {
    id: "stage-59",
    title: "Stage 59: 開始の合図",
    goal: "B の開始シグナルが来るまでのデータ(A)は捨てよう。filter では値の並びを選べないはず。",
    inputLabel: "データ",
    inputBLabel: "開始シグナル",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 9 },
        { t: 3, value: 7 },
        { t: 5, value: 2 },
        { t: 7, value: 8 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 4, value: 0 },
      ],
      completeAt: 6,
    },
    expected: {
      events: [
        { t: 5, value: 2 },
        { t: 7, value: 8 },
      ],
      completeAt: 11,
    },
    availableOperators: ["skipUntilB", "takeUntilB", "filter"],
    maxNodes: 2,
  },
  {
    id: "stage-60",
    title: "Stage 60: 早い者勝ち",
    goal: "A と B、先に値を出した方のストリームだけを丸ごと採用しよう。",
    inputLabel: "サーバー1の応答",
    inputBLabel: "サーバー2の応答",
    duration: 9,
    input: {
      events: [
        { t: 2, value: 10 },
        { t: 6, value: 20 },
      ],
      completeAt: 8,
    },
    inputB: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 2 },
        { t: 5, value: 3 },
      ],
      completeAt: 7,
    },
    expected: {
      events: [
        { t: 1, value: 1 },
        { t: 3, value: 2 },
        { t: 5, value: 3 },
      ],
      completeAt: 7,
    },
    availableOperators: ["race", "merge", "zip"],
    maxNodes: 2,
  },
  {
    id: "stage-61",
    title: "Stage 61: 検索ボックス",
    goal: "type-ahead の定番。入力が落ち着いたときだけ、しかも検索語が変わったときだけ、検索を飛ばしたい。",
    insight: "debounceTime+distinctUntilChanged は type-ahead 検索の定番前処理。実務ではこの後ろに switchMap で API 呼び出しをつなぎます。",
    inputLabel: "キー入力の文字数",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 2, value: 2 },
        { t: 3, value: 3 },
        { t: 6, value: 3 },
        { t: 8, value: 4 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 5, value: 3 },
        { t: 10, value: 4 },
      ],
      completeAt: 11,
    },
    availableOperators: ["debounceTime", "distinctUntilChanged", "throttleTime", "filter"],
    maxNodes: 2,
  },
  {
    id: "stage-62",
    title: "Stage 62: タイムアウト",
    goal: "応答(A)とタイマー(B)を競争させる。今回はタイマーが勝つので、エラーコード 404 に変換して返そう。",
    insight: "race によるタイムアウトは Rx の古典。実務では timeout()+catchError() で書くことが多いですが、原理はこの競争です。",
    inputLabel: "サーバー応答",
    inputBLabel: "タイムアウトタイマー",
    duration: 10,
    input: {
      events: [
        { t: 7, value: 200 },
      ],
      completeAt: 9,
    },
    inputB: {
      events: [
        { t: 4, value: 0 },
      ],
      completeAt: 5,
    },
    expected: {
      events: [
        { t: 4, value: 404 },
      ],
      completeAt: 5,
    },
    availableOperators: ["race", "mapTo", "merge", "map"],
    maxNodes: 2,
  },
  {
    id: "stage-63",
    title: "Stage 63: 変化したときだけ記録",
    goal: "温度計(A)をクロック(B)で定点観測し、前回の記録と同じ値ならログに残さない。",
    insight: "sample+distinctUntilChanged は「定点観測して変化だけ記録」。メトリクス収集やポーリング結果の差分通知で使います。",
    inputLabel: "温度計",
    inputBLabel: "記録クロック",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 20 },
        { t: 3, value: 20 },
        { t: 5, value: 21 },
        { t: 8, value: 21 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 2, value: 0 },
        { t: 4, value: 0 },
        { t: 6, value: 0 },
        { t: 9, value: 0 },
      ],
      completeAt: 10,
    },
    expected: {
      events: [
        { t: 2, value: 20 },
        { t: 6, value: 21 },
      ],
      completeAt: 11,
    },
    availableOperators: ["sample", "distinctUntilChanged", "withLatestFrom", "filter"],
    maxNodes: 2,
  },
  {
    id: "stage-64",
    title: "Stage 64: ドラッグ&ドロップ",
    goal: "移動量(A)をマウスアップ(B)まで積算し、ドロップ位置（合計）をその瞬間に 1 個だけ届けよう。",
    insight: "ドラッグ&ドロップは Rx が最も鮮やかに解く問題として有名。takeUntil で「終わり」を宣言的に書けるのが肝です。",
    inputLabel: "マウス移動量",
    inputBLabel: "マウスアップ",
    duration: 12,
    input: {
      events: [
        { t: 1, value: 4 },
        { t: 4, value: 1 },
        { t: 6, value: 3 },
        { t: 9, value: 9 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 7, value: 0 },
      ],
      completeAt: 9,
    },
    expected: {
      events: [
        { t: 7, value: 8 },
      ],
      completeAt: 7,
    },
    availableOperators: ["takeUntilB", "skipUntilB", "scan", "last", "reduce", "merge"],
    maxNodes: 4,
  },

  // ---------- Cycle 9: 実践編（新パーツなし・実務の定番アルゴリズム） ----------
  {
    id: "stage-65",
    title: "Stage 65: 時計ずれの補正",
    goal: "センサーAの時計は 2 だけ早い。補正してから B と合流し、正しい時系列に直そう（分散システムのイベント時刻補正）。",
    insight: "分散システムではノードごとに時計がずれます。合流前に delay で補正する発想は、イベント時刻の正規化（watermark 処理）の入り口です。",
    inputLabel: "時計が2早いセンサー",
    inputBLabel: "正常なセンサー",
    openAll: true,
    specMode: true,
    duration: 10,
    input: {
      events: [
        { t: 1, value: 1 },
        { t: 5, value: 3 },
      ],
      completeAt: 7,
    },
    inputB: {
      events: [
        { t: 4, value: 2 },
        { t: 8, value: 4 },
      ],
      completeAt: 9,
    },
    expected: {
      events: [
        { t: 3, value: 1 },
        { t: 4, value: 2 },
        { t: 7, value: 3 },
        { t: 8, value: 4 },
      ],
      completeAt: 9,
    },
    maxNodes: 2,
  },
  {
    id: "stage-66",
    title: "Stage 66: 二重配信の排除",
    goal: "同じ通知が2つのチャネルから重複して届く（at-least-once 配信）。合流してから重複を取り除こう。",
    insight: "at-least-once 配信のメッセージ基盤では重複が前提。merge 後の distinct は冪等化処理の最小形です。",
    inputLabel: "通知チャネル1",
    inputBLabel: "通知チャネル2",
    openAll: true,
    specMode: true,
    duration: 12,
    input: {
      events: [
        { t: 1, value: 7 },
        { t: 5, value: 9 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 3, value: 7 },
        { t: 7, value: 8 },
        { t: 9, value: 9 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 1, value: 7 },
        { t: 5, value: 9 },
        { t: 7, value: 8 },
      ],
      completeAt: 11,
    },
    maxNodes: 2,
  },
  {
    id: "stage-67",
    title: "Stage 67: フラッピング抑制",
    goal: "監視対象の状態(1=正常,0=障害)がばたつく。変化を拾い、2 静かなままだった確定値だけ通知しよう（アラートのフラッピング対策）。",
    insight: "監視アラートの「フラッピング抑制」。変化を検出してから安定を待つ——通知システムの抑制ロジックはこの合成でできています。",
    inputLabel: "ヘルスチェック結果",
    openAll: true,
    specMode: true,
    duration: 13,
    input: {
      events: [
        { t: 1, value: 0 },
        { t: 2, value: 1 },
        { t: 3, value: 0 },
        { t: 5, value: 0 },
        { t: 8, value: 1 },
        { t: 10, value: 1 },
      ],
      completeAt: 12,
    },
    expected: {
      events: [
        { t: 5, value: 0 },
        { t: 10, value: 1 },
      ],
      completeAt: 12,
    },
    maxNodes: 2,
  },
  {
    id: "stage-68",
    title: "Stage 68: ログイン失敗ロック",
    goal: "失敗が 3 回目（0 始まりで 2 番目）に達した瞬間、ロックコード 999 を出して監視を終了しよう。",
    insight: "ログイン失敗のロックアウト。elementAt の「n 番目が来た瞬間に完了」は、しきい値到達で監視を終える処理と同型です。",
    inputLabel: "ログイン失敗",
    openAll: true,
    specMode: true,
    duration: 12,
    input: {
      events: [
        { t: 2, value: 1 },
        { t: 5, value: 1 },
        { t: 7, value: 1 },
        { t: 9, value: 1 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 7, value: 999 },
      ],
      completeAt: 7,
    },
    maxNodes: 3,
  },
  {
    id: "stage-69",
    title: "Stage 69: クォータ警告",
    goal: "API 使用量を積算し、合計が 100 以上に達した最初の瞬間だけ警告して監視を終了しよう（従量課金の上限アラート）。",
    insight: "従量課金のクォータ警告。scan で累積し filter でしきい値、take(1) で「最初の1回だけ」——アラートの重複抑制まで含んだ実務の型です。",
    inputLabel: "API 使用量",
    openAll: true,
    specMode: true,
    duration: 12,
    input: {
      events: [
        { t: 1, value: 30 },
        { t: 3, value: 20 },
        { t: 5, value: 40 },
        { t: 7, value: 25 },
        { t: 9, value: 10 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 7, value: 115 },
      ],
      completeAt: 7,
    },
    maxNodes: 3,
  },
  {
    id: "stage-70",
    title: "Stage 70: SLA フォールバック",
    goal: "t=6 までに応答が来なければ打ち切り、既定値 -1 を返そう（タイムアウト付きフォールバック）。",
    insight: "takeUntil+defaultIfEmpty は「期限までに来なければ既定値」。SLA フォールバックやキャッシュ代替応答の骨格です。",
    inputLabel: "サーバー応答",
    openAll: true,
    specMode: true,
    duration: 11,
    input: {
      events: [
        { t: 8, value: 200 },
      ],
      completeAt: 10,
    },
    expected: {
      events: [
        { t: 6, value: -1 },
      ],
      completeAt: 6,
    },
    maxNodes: 2,
  },
  {
    id: "stage-71",
    title: "Stage 71: プログレスバー",
    goal: "4 つのタスクの完了イベントから進捗率(%)を作ろう。値の中身は捨ててよい。",
    insight: "mapTo(1)+scan は「イベントを数える」最小イディオム。進捗バー、既読カウント、リトライ回数などあらゆる場所に現れます。",
    inputLabel: "タスク完了",
    openAll: true,
    specMode: true,
    duration: 12,
    input: {
      events: [
        { t: 2, value: 7 },
        { t: 4, value: 3 },
        { t: 7, value: 9 },
        { t: 9, value: 5 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 2, value: 25 },
        { t: 4, value: 50 },
        { t: 7, value: 75 },
        { t: 9, value: 100 },
      ],
      completeAt: 11,
    },
    maxNodes: 3,
  },
  {
    id: "stage-72",
    title: "Stage 72: 営業時間の売上集計",
    goal: "開店 t=3 から閉店 t=9 までの売上だけを合計し、閉店時に 1 個だけ報告しよう（時間窓の集計）。",
    insight: "skipUntil+takeUntil+reduce は時間窓の集計（tumbling window の1窓分）。Kafka Streams や Flink のウィンドウ集計と同じ考え方です。",
    inputLabel: "売上",
    openAll: true,
    specMode: true,
    duration: 13,
    input: {
      events: [
        { t: 1, value: 5 },
        { t: 4, value: 10 },
        { t: 6, value: 20 },
        { t: 8, value: 15 },
        { t: 10, value: 30 },
      ],
      completeAt: 12,
    },
    expected: {
      events: [
        { t: 9, value: 45 },
      ],
      completeAt: 9,
    },
    maxNodes: 3,
  },

  // ---------- Cycle 10: 分岐編（パイプライン B の加工が鍵になる題材） ----------
  {
    id: "stage-73",
    title: "Stage 73: ノイズ越しの合流",
    goal: "センサー2(B)にはノイズ(999)が混じる。取り除いて2系統を1本にまとめよう。合流の前後どちらで除くかは自由。",
    insight: "合流の前後どちらで filter しても同じ——この等価性に気づくと、パイプラインの並び替えで性能や責務を調整できるようになります。",
    inputLabel: "センサー1",
    inputBLabel: "センサー2（ノイズ入り）",
    openAll: true,
    duration: 12,
    input: {
      events: [
        { t: 1, value: 3 },
        { t: 5, value: 5 },
        { t: 9, value: 6 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 3, value: 4 },
        { t: 4, value: 999 },
        { t: 7, value: 7 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 1, value: 3 },
        { t: 3, value: 4 },
        { t: 5, value: 5 },
        { t: 7, value: 7 },
        { t: 9, value: 6 },
      ],
      completeAt: 11,
    },
    maxNodes: 3,
  },
  {
    id: "stage-74",
    title: "Stage 74: ダース換算",
    goal: "B はダース単位の注文（1ダース=12個）。全注文を「個」の 1 本のストリームにまとめよう。",
    insight: "単位系の正規化は合流の前に。合流後に map すると両方の系に掛かってしまう——スキーマ変換をソースの近くでやる理由です。",
    inputLabel: "バラ注文（個）",
    inputBLabel: "ダース注文",
    openAll: true,
    duration: 12,
    input: {
      events: [
        { t: 2, value: 3 },
        { t: 8, value: 5 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 4, value: 1 },
        { t: 6, value: 2 },
      ],
      completeAt: 9,
    },
    expected: {
      events: [
        { t: 2, value: 3 },
        { t: 4, value: 12 },
        { t: 6, value: 24 },
        { t: 8, value: 5 },
      ],
      completeAt: 11,
    },
    maxNodes: 3,
  },
  {
    id: "stage-75",
    title: "Stage 75: ズレた突き合わせ",
    goal: "支払データ(B)の 1 件目はテスト行。除いてから伝票順に差額 a − b を取ろう。",
    insight: "zip は位置合わせがすべて。先頭のゴミ（ヘッダ行・テストデータ）は上流で落とすのが突き合わせ処理の鉄則です。",
    inputLabel: "請求書",
    inputBLabel: "支払い（先頭はテスト行）",
    openAll: true,
    duration: 12,
    input: {
      events: [
        { t: 1, value: 5 },
        { t: 5, value: 3 },
        { t: 9, value: 7 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 2, value: 0 },
        { t: 3, value: 5 },
        { t: 7, value: 4 },
        { t: 10, value: 7 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 3, value: 0 },
        { t: 7, value: -1 },
        { t: 10, value: 0 },
      ],
      completeAt: 11,
    },
    maxNodes: 3,
  },
  {
    id: "stage-76",
    title: "Stage 76: 誤検知を無視",
    goal: "停止シグナル(B)のうち 0 は誤検知、1 が本物。本物が来たときだけ監視を打ち切ろう。",
    insight: "notifier ストリーム自体を前処理する発想。誤検知シグナルでの誤停止は監視系の実バグで、シグナル側の filter が正解です。",
    inputLabel: "監視データ",
    inputBLabel: "停止シグナル（誤検知あり）",
    openAll: true,
    duration: 12,
    input: {
      events: [
        { t: 1, value: 2 },
        { t: 3, value: 4 },
        { t: 5, value: 6 },
        { t: 7, value: 8 },
        { t: 9, value: 9 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 2, value: 0 },
        { t: 6, value: 1 },
      ],
      completeAt: 8,
    },
    expected: {
      events: [
        { t: 1, value: 2 },
        { t: 3, value: 4 },
        { t: 5, value: 6 },
      ],
      completeAt: 6,
    },
    maxNodes: 3,
  },
  {
    id: "stage-77",
    title: "Stage 77: 検針は4刻みで",
    goal: "クロック(B)が細かすぎて、このままでは検針記録が多すぎる。ちょうどよく間引いてから検針しよう。",
    insight: "サンプリングクロックの間引き。計測系では「クロックを加工する」ほうがデータ側を加工するより安全なことが多いです。",
    inputLabel: "メーター値",
    inputBLabel: "毎刻クロック",
    openAll: true,
    duration: 12,
    input: {
      events: [
        { t: 1, value: 3 },
        { t: 2, value: 5 },
        { t: 4, value: 6 },
        { t: 6, value: 8 },
        { t: 8, value: 9 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 2, value: 0 },
        { t: 3, value: 0 },
        { t: 5, value: 0 },
        { t: 6, value: 0 },
        { t: 9, value: 0 },
      ],
      completeAt: 10,
    },
    expected: {
      events: [
        { t: 2, value: 5 },
        { t: 6, value: 8 },
      ],
      completeAt: 11,
    },
    maxNodes: 3,
  },
  {
    id: "stage-78",
    title: "Stage 78: 誤入力ガード",
    goal: "数量(B)に 999 の誤入力が混じる。10 以下だけを信じて単価×数量を再計算しよう。合流後に弾いても手遅れなのはなぜ？",
    insight: "答え: combineLatest は最新値を保持し続けるため、汚染された値が次の更新まで再計算に使われ続けます。だから検証は合流前（上流）で——ストリーム設計の鉄則です。",
    inputLabel: "単価",
    inputBLabel: "数量（誤入力あり）",
    openAll: true,
    duration: 12,
    input: {
      events: [
        { t: 1, value: 50 },
        { t: 7, value: 80 },
      ],
      completeAt: 11,
    },
    inputB: {
      events: [
        { t: 3, value: 2 },
        { t: 5, value: 999 },
        { t: 9, value: 4 },
      ],
      completeAt: 11,
    },
    expected: {
      events: [
        { t: 3, value: 100 },
        { t: 7, value: 160 },
        { t: 9, value: 320 },
      ],
      completeAt: 11,
    },
    maxNodes: 3,
  },
  // ---------- Cycle 11: 展開編（高階ストリーム） ----------
  {
    id: "stage-79",
    title: "Stage 79: 全部並行",
    goal: "イベントごとに「2 間隔×3 回のエコー」に展開し、すべて並行で流そう。",
    duration: 14,
    input: { events: [{ t: 1, value: 1 }, { t: 2, value: 2 }], completeAt: 11 },
    expected: { events: [{ t: 3, value: 1 }, { t: 4, value: 2 }, { t: 5, value: 1 }, { t: 6, value: 2 }, { t: 7, value: 1 }, { t: 8, value: 2 }], completeAt: 11 },
    availableOperators: ["mergeMap", "concatMap", "switchMap"],
    maxNodes: 2,
  },
  {
    id: "stage-80",
    title: "Stage 80: 順番待ち",
    goal: "同じ展開（2 間隔×3 回）を、前の展開が終わるまで順番待ちで。",
    duration: 14,
    input: { events: [{ t: 1, value: 1 }, { t: 2, value: 2 }], completeAt: 11 },
    expected: { events: [{ t: 3, value: 1 }, { t: 5, value: 1 }, { t: 7, value: 1 }, { t: 9, value: 2 }, { t: 11, value: 2 }, { t: 13, value: 2 }], completeAt: 13 },
    availableOperators: ["concatMap", "mergeMap", "exhaustMap"],
    maxNodes: 2,
  },
  {
    id: "stage-81",
    title: "Stage 81: 乗り換え",
    goal: "同じ展開で、新しいイベントが来たら前の展開は打ち切って乗り換える。",
    duration: 14,
    input: { events: [{ t: 1, value: 1 }, { t: 2, value: 2 }], completeAt: 11 },
    expected: { events: [{ t: 4, value: 2 }, { t: 6, value: 2 }, { t: 8, value: 2 }], completeAt: 11 },
    availableOperators: ["switchMap", "exhaustMap", "mergeMap"],
    maxNodes: 2,
  },
  {
    id: "stage-82",
    title: "Stage 82: 取り込み中",
    goal: "同じ展開で、展開の最中に来たイベントは無視する。81 との違いは「どちらが生き残るか」。",
    duration: 14,
    input: { events: [{ t: 1, value: 1 }, { t: 2, value: 2 }], completeAt: 11 },
    expected: { events: [{ t: 3, value: 1 }, { t: 5, value: 1 }, { t: 7, value: 1 }], completeAt: 11 },
    availableOperators: ["exhaustMap", "switchMap", "concatMap"],
    maxNodes: 2,
  },
  {
    id: "stage-83",
    title: "Stage 83: 検索ボックス・完全版",
    goal: "入力が落ち着いて、検索語が変わったときだけ、2 後に結果（元の値）が 1 個返る検索を張り替え式で走らせよう。",
    insight: "switchMap による「古い検索のキャンセル」が type-ahead の核心。debounceTime → distinctUntilChanged → switchMap は実務イディオムの代表格です。",
    inputLabel: "キー入力の文字数",
    duration: 16,
    input: { events: [{ t: 1, value: 1 }, { t: 2, value: 2 }, { t: 3, value: 3 }, { t: 6, value: 3 }, { t: 8, value: 4 }], completeAt: 13 },
    expected: { events: [{ t: 7, value: 3 }, { t: 12, value: 4 }], completeAt: 13 },
    maxNodes: 3,
  },
  {
    id: "stage-84",
    title: "Stage 84: 二重送信ガード・展開版",
    goal: "クリックごとに「1 間隔×2 回」の処理が走る。処理中の再クリックは受け付けない。",
    insight: "exhaustMap は「処理中は新規を無視」。二重送信防止の最も宣言的な書き方で、disabled フラグの管理が丸ごと消えます。",
    inputLabel: "送信クリック",
    duration: 14,
    input: { events: [{ t: 1, value: 1 }, { t: 2, value: 1 }, { t: 6, value: 1 }], completeAt: 11 },
    expected: { events: [{ t: 2, value: 1 }, { t: 3, value: 1 }, { t: 7, value: 1 }, { t: 8, value: 1 }], completeAt: 11 },
    maxNodes: 2,
  },
  {
    id: "stage-85",
    title: "Stage 85: ジョブキュー",
    goal: "ジョブごとに「1 間隔×2 回」の処理。同時実行は 1 本だけ、投入順に。",
    insight: "concatMap は順序保証つきの直列実行キュー。書き込み系 API のように順序が大事な処理はこれ一択です。",
    inputLabel: "ジョブ投入",
    duration: 17,
    input: { events: [{ t: 1, value: 5 }, { t: 2, value: 7 }, { t: 3, value: 9 }], completeAt: 13 },
    expected: { events: [{ t: 2, value: 5 }, { t: 3, value: 5 }, { t: 4, value: 7 }, { t: 5, value: 7 }, { t: 6, value: 9 }, { t: 7, value: 9 }], completeAt: 13 },
    maxNodes: 2,
  },
  {
    id: "stage-86",
    title: "Stage 86: ポーリングの張り替え",
    goal: "設定が変わるたびに「2 間隔×3 回」のポーリングを張り替える。無効な設定（0）は無視。",
    insight: "「設定変更で購読を張り替える」は switchMap の代表用途。古いポーリングの残骸が残らないのが filter+switchMap の力です。",
    inputLabel: "設定変更（0=無効）",
    duration: 17,
    input: { events: [{ t: 1, value: 3 }, { t: 4, value: 0 }, { t: 6, value: 5 }], completeAt: 13 },
    expected: { events: [{ t: 3, value: 3 }, { t: 5, value: 3 }, { t: 8, value: 5 }, { t: 10, value: 5 }, { t: 12, value: 5 }], completeAt: 13 },
    maxNodes: 3,
  },

  // ---------- Cycle 12: エラー編 ----------
  {
    id: "stage-87",
    title: "Stage 87: エラーを受け止める",
    goal: "ストリームが t=6 で ✕（エラー終了）してしまう。エラーを値 9 に変えて、正常完了（｜）に直そう。",
    inputLabel: "壊れた配信",
    duration: 8,
    input: { events: [{ t: 1, value: 1 }, { t: 3, value: 2 }], completeAt: 6, error: true },
    expected: { events: [{ t: 1, value: 1 }, { t: 3, value: 2 }, { t: 6, value: 9 }], completeAt: 6 },
    availableOperators: ["catchError", "defaultIfEmpty", "mapTo"],
    maxNodes: 2,
  },
  {
    id: "stage-88",
    title: "Stage 88: 見切りをつける",
    goal: "無音が 4 を超えたら見切りをつけて ✕ にしたい。正常完了で切る takeUntil との違いは終端の種類。",
    duration: 11,
    input: { events: [{ t: 1, value: 5 }, { t: 8, value: 7 }], completeAt: 10 },
    expected: { events: [{ t: 1, value: 5 }], completeAt: 5, error: true },
    availableOperators: ["timeout", "takeUntil", "take"],
    maxNodes: 2,
  },
  {
    id: "stage-89",
    title: "Stage 89: 諦めの悪い購読",
    goal: "エラーで切れる線を 2 回まで再購読（リトライ）しよう。それでもダメなら ✕ のまま。",
    duration: 8,
    input: { events: [{ t: 1, value: 3 }], completeAt: 2, error: true },
    expected: { events: [{ t: 1, value: 3 }, { t: 3, value: 3 }, { t: 5, value: 3 }], completeAt: 6, error: true },
    availableOperators: ["retry", "catchError", "timeout"],
    maxNodes: 2,
  },
  {
    id: "stage-90",
    title: "Stage 90: 粘って、保険",
    goal: "1 回だけやり直し、それでもダメなら 0 を返して正常終了。本番コードの定番コンボ。",
    duration: 10,
    input: { events: [{ t: 1, value: 4 }], completeAt: 3, error: true },
    expected: { events: [{ t: 1, value: 4 }, { t: 4, value: 4 }, { t: 6, value: 0 }], completeAt: 6 },
    availableOperators: ["retry", "catchError", "timeout"],
    maxNodes: 2,
  },
  {
    id: "stage-91",
    title: "Stage 91: SLA フォールバック・本物",
    goal: "t=4 までに応答がなければ見切りをつけ、既定値 -1 を返そう。Stage 70 と同じ要件を、今度はエラー経由で。",
    insight: "timeout()+catchError() が実務のタイムアウト処理の第一選択。Stage 70 の takeUntil+defaultIfEmpty と見比べると、エラーチャネルを持つ意味が分かります。",
    inputLabel: "サーバー応答",
    duration: 10,
    input: { events: [{ t: 7, value: 200 }], completeAt: 9 },
    expected: { events: [{ t: 4, value: -1 }], completeAt: 4 },
    maxNodes: 2,
  },
  {
    id: "stage-92",
    title: "Stage 92: 変換してから保険",
    goal: "値を 10 倍しつつ、エラーは 5 に変えて拾いたい。保険はどこに掛ける？",
    insight: "catchError の位置で「何が保護されるか」が変わります。変換の後ろに置けばフォールバック値は変換を受けない——エラーハンドラの置き場所は実コードでも頻出の議論です。",
    duration: 8,
    input: { events: [{ t: 1, value: 1 }, { t: 3, value: 2 }], completeAt: 5, error: true },
    expected: { events: [{ t: 1, value: 10 }, { t: 3, value: 20 }, { t: 5, value: 5 }], completeAt: 5 },
    maxNodes: 2,
  },
  {
    id: "stage-93",
    title: "Stage 93: 心拍が止まったら",
    goal: "心拍が 3 を超えて途絶えたらダウン扱い。ダウンは 0 として記録し、そこで監視を終える。",
    insight: "デッドマン判定（heartbeat timeout）は監視の基本形。timeout がエラーを投げ、catchError がダウンイベントに変換します。",
    inputLabel: "心拍",
    duration: 11,
    input: { events: [{ t: 1, value: 1 }, { t: 2, value: 1 }, { t: 4, value: 1 }], completeAt: 10 },
    expected: { events: [{ t: 1, value: 1 }, { t: 2, value: 1 }, { t: 4, value: 1 }, { t: 7, value: 0 }], completeAt: 7 },
    maxNodes: 2,
  },
  {
    id: "stage-94",
    title: "Stage 94: フレーキー卒業試験",
    goal: "不安定なソースを 2 回まで再試行し、2 個取れた時点で満足して正常終了しよう。",
    insight: "retry で粘り、take で「十分取れたら成功扱い」に変換する——エラーを完了に変えるこの形は、不安定なセンサーやネットワークの実戦テクニックです。",
    duration: 8,
    input: { events: [{ t: 1, value: 7 }], completeAt: 2, error: true },
    expected: { events: [{ t: 1, value: 7 }, { t: 3, value: 7 }], completeAt: 3 },
    maxNodes: 2,
  },
];

// ============================================================
// Operator catalog
// createParams の初期値は原則「追加しただけではストリームが変化
// しない中立値」にする（初期値がステージの答えと一致して1クリック
// で解けてしまうのを防ぐ）。scan/reduce のように中立値が存在しない
// ものは、導入ステージ側で複数オペレータから選ばせて対処する。
// ============================================================

const MAP_OPS = {
  add: { symbol: "+", fn: (x, k) => x + k },
  sub: { symbol: "-", fn: (x, k) => x - k },
  mul: { symbol: "×", fn: (x, k) => x * k },
  mod: { symbol: "%", fn: (x, k) => (k === 0 ? x : x % k) },
};

// 「偶数のみ」のような組み込み条件は置かない。
// 偶数抽出は map(x % 2) + filter(= 0) の組み合わせで解かせる。
const FILTER_CMPS = {
  gte: { symbol: "≥", fn: (x, k) => x >= k },
  gt: { symbol: ">", fn: (x, k) => x > k },
  lte: { symbol: "≤", fn: (x, k) => x <= k },
  lt: { symbol: "<", fn: (x, k) => x < k },
  eq: { symbol: "=", fn: (x, k) => x === k },
  neq: { symbol: "≠", fn: (x, k) => x !== k },
};

const SCAN_OPS = {
  add: { expr: "acc + x", fn: (a, x) => a + x },
  mul: { expr: "acc × x", fn: (a, x) => a * x },
  max: { expr: "max(acc, x)", fn: (a, x) => Math.max(a, x) },
  min: { expr: "min(acc, x)", fn: (a, x) => Math.min(a, x) },
};

// 2入力オペレータ（zip / combineLatest / withLatestFrom）の合成関数
const COMBINE_OPS = {
  add: { expr: "a + b", fn: (a, b) => a + b },
  sub: { expr: "a - b", fn: (a, b) => a - b },
  mul: { expr: "a × b", fn: (a, b) => a * b },
  max: { expr: "max(a, b)", fn: (a, b) => Math.max(a, b) },
};

const OPERATOR_DEFS = {
  map: {
    label: "map",
    createParams: () => ({ op: "mul", operand: 1 }),
    describe: (p) => t("op.map", { sym: MAP_OPS[p.op].symbol, k: p.operand }),
    apply: (stream, p) => ({
      events: stream.events.map((e) => ({ ...e, value: MAP_OPS[p.op].fn(e.value, p.operand) })),
      completeAt: stream.completeAt,
    }),
  },
  filter: {
    label: "filter",
    createParams: () => ({ cmp: "gte", operand: 0 }),
    describe: (p) => t("op.filter", { sym: FILTER_CMPS[p.cmp].symbol, k: p.operand }),
    apply: (stream, p) => ({
      events: stream.events.filter((e) => FILTER_CMPS[p.cmp].fn(e.value, p.operand)),
      completeAt: stream.completeAt,
    }),
  },
  take: {
    label: "take",
    createParams: () => ({ count: 1 }),
    describe: (p) => t("op.take", { n: p.count }),
    // count 個目のイベントが来た時点で完了が前倒しになる（Rx の take 即時完了に対応）
    apply: (stream, p) => {
      const n = Math.max(0, Math.floor(p.count));
      const events = stream.events.slice(0, n);
      const completeAt =
        n > 0 && stream.events.length >= n ? events[n - 1].t : stream.completeAt;
      return { events, completeAt: n === 0 ? 0 : completeAt };
    },
  },
  skip: {
    label: "skip",
    createParams: () => ({ count: 1 }),
    describe: (p) => t("op.skip", { n: p.count }),
    apply: (stream, p) => ({
      events: stream.events.slice(Math.max(0, Math.floor(p.count))),
      completeAt: stream.completeAt,
    }),
  },
  scan: {
    label: "scan",
    createParams: () => ({ op: "add", seed: 0 }),
    describe: (p) => t("op.scan", { expr: SCAN_OPS[p.op].expr, seed: p.seed }),
    apply: (stream, p) => {
      let acc = p.seed;
      return {
        events: stream.events.map((e) => {
          acc = SCAN_OPS[p.op].fn(acc, e.value);
          return { t: e.t, value: acc };
        }),
        completeAt: stream.completeAt,
      };
    },
  },
  distinctUntilChanged: {
    label: "distinctUntilChanged",
    createParams: () => ({}),
    describe: () => t("op.distinctUntilChanged"),
    apply: (stream) => {
      const events = [];
      let prev;
      for (const e of stream.events) {
        if (events.length === 0 || e.value !== prev) {
          events.push({ ...e });
          prev = e.value;
        }
      }
      return { events, completeAt: stream.completeAt };
    },
  },
  takeWhile: {
    label: "takeWhile",
    createParams: () => ({ cmp: "gte", operand: 0 }),
    describe: (p) => t("op.takeWhile", { sym: FILTER_CMPS[p.cmp].symbol, k: p.operand }),
    // 条件が破れたイベントは出さず、その時刻で完了する
    apply: (stream, p) => {
      const events = [];
      for (const e of stream.events) {
        if (!FILTER_CMPS[p.cmp].fn(e.value, p.operand)) {
          return { events, completeAt: e.t };
        }
        events.push({ ...e });
      }
      return { events, completeAt: stream.completeAt };
    },
  },
  startWith: {
    label: "startWith",
    createParams: () => ({ value: 0 }),
    describe: (p) => t("op.startWith", { v: p.value }),
    apply: (stream, p) => ({
      events: [{ t: 0, value: p.value }, ...stream.events.map((e) => ({ ...e }))],
      completeAt: stream.completeAt,
    }),
  },
  delay: {
    label: "delay",
    createParams: () => ({ d: 0 }),
    describe: (p) => t("op.delay", { d: p.d }),
    apply: (stream, p) => {
      const d = Math.max(0, p.d);
      return {
        events: stream.events.map((e) => ({ t: e.t + d, value: e.value })),
        completeAt: stream.completeAt + d,
        error: stream.error,
      };
    },
  },
  throttleTime: {
    label: "throttleTime",
    createParams: () => ({ d: 0 }),
    describe: (p) => t("op.throttleTime", { d: p.d }),
    apply: (stream, p) => {
      const d = Math.max(0, p.d);
      const events = [];
      let gate = -Infinity;
      for (const e of stream.events) {
        if (e.t >= gate) {
          events.push({ ...e });
          gate = e.t + d;
        }
      }
      return { events, completeAt: stream.completeAt };
    },
  },
  debounceTime: {
    label: "debounceTime",
    createParams: () => ({ d: 0 }),
    describe: (p) => t("op.debounceTime", { d: p.d }),
    // 各イベントは t+d に発火予約。次のイベントが予約時刻より前に
    // 来たら上書き。完了時に保留があれば完了時刻に放出（Rx 準拠）。
    apply: (stream, p) => {
      const d = Math.max(0, p.d);
      const events = [];
      stream.events.forEach((e, i) => {
        const fireAt = e.t + d;
        const next = stream.events[i + 1];
        if (next && next.t < fireAt) return;
        if (stream.error && fireAt > stream.completeAt) return; // エラー時は保留分を捨てる
        events.push({ t: Math.min(fireAt, stream.completeAt), value: e.value });
      });
      return { events, completeAt: stream.completeAt };
    },
  },
  reduce: {
    label: "reduce",
    createParams: () => ({ op: "add", seed: 0 }),
    describe: (p) => t("op.scan", { expr: SCAN_OPS[p.op].expr, seed: p.seed }),
    apply: (stream, p) => {
      if (stream.error) return { events: [], completeAt: stream.completeAt, error: true };
      let acc = p.seed;
      for (const e of stream.events) acc = SCAN_OPS[p.op].fn(acc, e.value);
      return {
        events: [{ t: stream.completeAt, value: acc }],
        completeAt: stream.completeAt,
      };
    },
  },
  mapTo: {
    label: "mapTo",
    createParams: () => ({ value: 0 }),
    describe: (p) => t("op.mapTo", { v: p.value }),
    apply: (stream, p) => ({
      events: stream.events.map((e) => ({ t: e.t, value: p.value })),
      completeAt: stream.completeAt,
    }),
  },
  index: {
    label: "index",
    createParams: () => ({}),
    describe: () => t("op.index"),
    apply: (stream) => ({
      events: stream.events.map((e, i) => ({ t: e.t, value: i })),
      completeAt: stream.completeAt,
    }),
  },
  timestamp: {
    label: "timestamp",
    createParams: () => ({}),
    describe: () => t("op.timestamp"),
    apply: (stream) => ({
      events: stream.events.map((e) => ({ t: e.t, value: e.t })),
      completeAt: stream.completeAt,
    }),
  },
  last: {
    label: "last",
    createParams: () => ({}),
    describe: () => t("op.last"),
    apply: (stream) => (stream.error ? { events: [], completeAt: stream.completeAt, error: true } : {
      events: stream.events.length
        ? [{ t: stream.completeAt, value: stream.events[stream.events.length - 1].value }]
        : [],
      completeAt: stream.completeAt,
    }),
  },
  // takeLast / skipLast は Rx では完了時に一括放出だが、同時刻1イベント制約と
  // 表示のため「元の時刻のまま末尾 n 個を残す/捨てる」位置ベース仕様にしている
  takeLast: {
    label: "takeLast",
    createParams: () => ({ count: 1 }),
    describe: (p) => t("op.takeLast", { n: p.count }),
    apply: (stream, p) => {
      const n = Math.max(0, Math.floor(p.count));
      return {
        events: n === 0 ? [] : stream.events.slice(-n).map((e) => ({ ...e })),
        completeAt: stream.completeAt,
      };
    },
  },
  skipLast: {
    label: "skipLast",
    createParams: () => ({ count: 0 }),
    describe: (p) => t("op.skipLast", { n: p.count }),
    apply: (stream, p) => {
      const n = Math.max(0, Math.floor(p.count));
      return {
        events: stream.events.slice(0, Math.max(0, stream.events.length - n)).map((e) => ({ ...e })),
        completeAt: stream.completeAt,
      };
    },
  },
  elementAt: {
    label: "elementAt",
    createParams: () => ({ n: 0 }),
    describe: (p) => t("op.elementAt", { n: p.n }),
    // 対象イベントを出した瞬間に完了する（Rx の elementAt 即時完了に対応）
    apply: (stream, p) => {
      const e = stream.events[Math.max(0, Math.floor(p.n))];
      return e
        ? { events: [{ ...e }], completeAt: e.t }
        : { events: [], completeAt: stream.completeAt };
    },
  },
  defaultIfEmpty: {
    label: "defaultIfEmpty",
    createParams: () => ({ value: 0 }),
    describe: (p) => t("op.defaultIfEmpty", { v: p.value }),
    apply: (stream, p) => (stream.error ? { events: stream.events.map((e) => ({ ...e })), completeAt: stream.completeAt, error: true } : {
      events: stream.events.length
        ? stream.events.map((e) => ({ ...e }))
        : [{ t: stream.completeAt, value: p.value }],
      completeAt: stream.completeAt,
    }),
  },
  distinct: {
    label: "distinct",
    createParams: () => ({}),
    describe: () => t("op.distinct"),
    apply: (stream) => {
      const seen = new Set();
      const events = [];
      for (const e of stream.events) {
        if (!seen.has(e.value)) {
          seen.add(e.value);
          events.push({ ...e });
        }
      }
      return { events, completeAt: stream.completeAt };
    },
  },
  takeUntil: {
    label: "takeUntil",
    createParams: () => ({ time: 99 }),
    describe: (p) => t("op.takeUntil", { t: p.time }),
    // t 以降のイベントは出さず、完了も t に前倒し（Rx の takeUntil(timer(t)) に対応）
    apply: (stream, p) => ({
      events: stream.events.filter((e) => e.t < p.time).map((e) => ({ ...e })),
      completeAt: Math.min(stream.completeAt, p.time),
    }),
  },
  skipUntil: {
    label: "skipUntil",
    createParams: () => ({ time: 0 }),
    describe: (p) => t("op.skipUntil", { t: p.time }),
    apply: (stream, p) => ({
      events: stream.events.filter((e) => e.t >= p.time).map((e) => ({ ...e })),
      completeAt: stream.completeAt,
    }),
  },
  auditTime: {
    label: "auditTime",
    createParams: () => ({ d: 0 }),
    describe: (p) => t("op.auditTime", { d: p.d }),
    // イベント到着で窓 [t, t+d] を開き、窓が閉じた時刻に窓内の最新値を出す。
    // debounce と違い窓は延長されない。完了時にまだ窓が開いていて
    // 閉じる時刻が完了より後なら、その保留分は捨てる（Rx の audit に対応）。
    apply: (stream, p) => {
      const d = Math.max(0, p.d);
      const events = [];
      let pending = null; // {end, value}
      for (const e of stream.events) {
        if (pending && e.t >= pending.end) {
          events.push({ t: pending.end, value: pending.value });
          pending = null;
        }
        if (pending) pending.value = e.value;
        else pending = { end: e.t + d, value: e.value };
      }
      if (pending && pending.end <= stream.completeAt && !stream.error) {
        events.push({ t: pending.end, value: pending.value });
      }
      return { events, completeAt: stream.completeAt };
    },
  },

  // ---------- 2入力オペレータ ----------
  // binary: true のオペレータは、メインパイプラインを流れる現在のストリームと
  // 「パイプライン B の出力」（B パイプラインが空なら B の原本）を合成する。
  merge: {
    label: "merge",
    binary: true,
    createParams: () => ({}),
    describe: () => t("op.merge"),
    // 同時刻に衝突した場合はパイプライン側（A側）を残す（ステージデータでは衝突を避ける）
    apply: (stream, p, b) => {
      const events = stream.events.map((e) => ({ ...e }));
      const taken = new Set(events.map((e) => e.t));
      for (const e of b.events) {
        if (!taken.has(e.t)) events.push({ ...e });
      }
      events.sort((x, y) => x.t - y.t);
      return { events, completeAt: Math.max(stream.completeAt, b.completeAt) };
    },
  },
  zip: {
    label: "zip",
    binary: true,
    createParams: () => ({ op: "add" }),
    describe: (p) => t("op.zip", { expr: COMBINE_OPS[p.op].expr }),
    // k 組目は両方の k 番目が揃った時刻（遅い方）に発火。
    // 完了は「短い方の完了」と「最後の組の発火」の遅い方。
    apply: (stream, p, b) => {
      const n = Math.min(stream.events.length, b.events.length);
      const events = [];
      for (let i = 0; i < n; i++) {
        const ea = stream.events[i];
        const eb = b.events[i];
        events.push({ t: Math.max(ea.t, eb.t), value: COMBINE_OPS[p.op].fn(ea.value, eb.value) });
      }
      const lastT = events.length ? events[events.length - 1].t : 0;
      return {
        events,
        completeAt: Math.max(Math.min(stream.completeAt, b.completeAt), lastT),
      };
    },
  },
  combineLatest: {
    label: "combineLatest",
    binary: true,
    createParams: () => ({ op: "add" }),
    describe: (p) => t("op.combineLatest", { expr: COMBINE_OPS[p.op].expr }),
    // 両方が一度でも値を出した後は、どちらかが更新されるたびに発火。
    // 同時刻に両方が更新された場合は 1 回だけ発火する。
    apply: (stream, p, b) => {
      const times = [...new Set([
        ...stream.events.map((e) => e.t),
        ...b.events.map((e) => e.t),
      ])].sort((x, y) => x - y);
      const events = [];
      let la, lb;
      for (const t of times) {
        const ea = stream.events.find((e) => e.t === t);
        if (ea) la = ea.value;
        const eb = b.events.find((e) => e.t === t);
        if (eb) lb = eb.value;
        if (la !== undefined && lb !== undefined) {
          events.push({ t, value: COMBINE_OPS[p.op].fn(la, lb) });
        }
      }
      return { events, completeAt: Math.max(stream.completeAt, b.completeAt) };
    },
  },
  withLatestFrom: {
    label: "withLatestFrom",
    binary: true,
    createParams: () => ({ op: "add" }),
    describe: (p) => t("op.withLatestFrom", { expr: COMBINE_OPS[p.op].expr }),
    // A（パイプライン側）のイベントでのみ発火。B の最新値（同時刻含む）を添える。
    // B がまだ値を出していなければそのイベントは捨てる。
    apply: (stream, p, b) => {
      const events = [];
      for (const ea of stream.events) {
        const lb = b.events.filter((e) => e.t <= ea.t).pop();
        if (lb) events.push({ t: ea.t, value: COMBINE_OPS[p.op].fn(ea.value, lb.value) });
      }
      return { events, completeAt: stream.completeAt };
    },
  },
  sample: {
    label: "sample",
    binary: true,
    createParams: () => ({}),
    describe: () => t("op.sample"),
    // B のイベント時刻に、A の最新値を出す。前回の合図から A に新しい
    // 発行がなければ何も出さない（Rx の sample に対応）。
    apply: (stream, p, b) => {
      const events = [];
      let lastIdx = -1;
      for (const eb of b.events) {
        if (eb.t > stream.completeAt) break;
        let idx = -1;
        stream.events.forEach((ea, i) => { if (ea.t <= eb.t) idx = i; });
        if (idx > lastIdx) {
          events.push({ t: eb.t, value: stream.events[idx].value });
          lastIdx = idx;
        }
      }
      return { events, completeAt: stream.completeAt };
    },
  },
  takeUntilB: {
    label: "takeUntil(B)",
    binary: true,
    createParams: () => ({}),
    describe: () => t("op.takeUntilB"),
    // B の最初のイベント時刻で完了する。B が空なら素通し。
    apply: (stream, p, b) => {
      const first = b.events[0];
      if (!first) return { events: stream.events.map((e) => ({ ...e })), completeAt: stream.completeAt };
      return {
        events: stream.events.filter((e) => e.t < first.t).map((e) => ({ ...e })),
        completeAt: Math.min(stream.completeAt, first.t),
      };
    },
  },
  skipUntilB: {
    label: "skipUntil(B)",
    binary: true,
    createParams: () => ({}),
    describe: () => t("op.skipUntilB"),
    // B の最初のイベント以降（同時刻含む）だけ通す。B が空なら何も通さない。
    apply: (stream, p, b) => {
      const first = b.events[0];
      return {
        events: first
          ? stream.events.filter((e) => e.t >= first.t).map((e) => ({ ...e }))
          : [],
        completeAt: stream.completeAt,
      };
    },
  },
  race: {
    label: "race",
    binary: true,
    createParams: () => ({}),
    describe: () => t("op.race"),
    // 最初のイベントが早い方のストリームを丸ごと採用（同時刻は A 優先。両方空なら A）
    apply: (stream, p, b) => {
      const aFirst = stream.events[0]?.t ?? Infinity;
      const bFirst = b.events[0]?.t ?? Infinity;
      const winner = aFirst <= bFirst ? stream : b;
      return {
        events: winner.events.map((e) => ({ ...e })),
        completeAt: winner.completeAt,
      };
    },
  },

  // ---------- 高階ストリーム（展開）オペレータ ----------
  // 各イベント (t, v) から「d 間隔で v を count 回放出する」内部ストリームを
  // 展開する。重なりの捌き方だけが4つの違い。初期値 count=1, d=0 は恒等変換。
  mergeMap: {
    label: "mergeMap",
    createParams: () => ({ count: 1, d: 0 }),
    describe: (p) => t("op.mergeMap", { d: p.d, n: p.count }),
    apply: (stream, p) => {
      const events = [];
      for (const e of stream.events) events.push(...expandInner(e.t, e.value, p));
      events.sort((x, y) => x.t - y.t);
      const lastT = events.length ? events[events.length - 1].t : 0;
      return { events, completeAt: Math.max(stream.completeAt, lastT) };
    },
  },
  concatMap: {
    label: "concatMap",
    createParams: () => ({ count: 1, d: 0 }),
    describe: (p) => t("op.concatMap", { d: p.d, n: p.count }),
    apply: (stream, p) => {
      const events = [];
      let cursor = -Infinity;
      for (const e of stream.events) {
        const start = Math.max(e.t, cursor);
        events.push(...expandInner(start, e.value, p));
        cursor = start + innerSpan(p);
      }
      const lastT = events.length ? events[events.length - 1].t : 0;
      return { events, completeAt: Math.max(stream.completeAt, lastT) };
    },
  },
  switchMap: {
    label: "switchMap",
    createParams: () => ({ count: 1, d: 0 }),
    describe: (p) => t("op.switchMap", { d: p.d, n: p.count }),
    // 次のイベントが来た時点で、前の展開の残りは打ち切り
    apply: (stream, p) => {
      const events = [];
      stream.events.forEach((e, i) => {
        const next = stream.events[i + 1];
        for (const ie of expandInner(e.t, e.value, p)) {
          if (!next || ie.t < next.t) events.push(ie);
        }
      });
      const last = stream.events[stream.events.length - 1];
      const lastEnd = last ? last.t + innerSpan(p) : 0;
      return { events, completeAt: Math.max(stream.completeAt, lastEnd) };
    },
  },
  exhaustMap: {
    label: "exhaustMap",
    createParams: () => ({ count: 1, d: 0 }),
    describe: (p) => t("op.exhaustMap", { d: p.d, n: p.count }),
    apply: (stream, p) => {
      const events = [];
      let activeEnd = -Infinity;
      for (const e of stream.events) {
        if (e.t < activeEnd) continue;
        events.push(...expandInner(e.t, e.value, p));
        activeEnd = e.t + innerSpan(p);
      }
      return {
        events,
        completeAt: Math.max(stream.completeAt, activeEnd === -Infinity ? 0 : activeEnd),
      };
    },
  },

  // ---------- エラー系オペレータ ----------
  // ストリームの終端は complete（｜）か error（✕）。error は stream.error で表す。
  catchError: {
    label: "catchError",
    createParams: () => ({ value: 0 }),
    describe: (p) => t("op.catchError", { v: p.value }),
    apply: (stream, p) => {
      if (!stream.error) {
        return { events: stream.events.map((e) => ({ ...e })), completeAt: stream.completeAt, error: false };
      }
      return {
        events: [...stream.events.map((e) => ({ ...e })), { t: stream.completeAt, value: p.value }],
        completeAt: stream.completeAt,
        error: false,
      };
    },
  },
  retry: {
    label: "retry",
    createParams: () => ({ count: 1 }),
    // 録画済みタイムラインの再購読 = エラー時刻から同じ内容を繰り返す
    describe: (p) => t("op.retry", { n: p.count }),
    apply: (stream, p) => {
      if (!stream.error) {
        return { events: stream.events.map((e) => ({ ...e })), completeAt: stream.completeAt, error: false };
      }
      const n = Math.max(0, Math.floor(p.count));
      const period = stream.completeAt;
      const events = [];
      for (let i = 0; i <= n; i++) {
        for (const e of stream.events) events.push({ t: e.t + i * period, value: e.value });
      }
      return { events, completeAt: (n + 1) * period, error: true };
    },
  },
  timeout: {
    label: "timeout",
    createParams: () => ({ d: 99 }),
    describe: (p) => t("op.timeout", { d: p.d }),
    apply: (stream, p) => {
      const d = Math.max(0, p.d);
      let prev = 0; // 購読開始(t=0)からの無音も数える
      for (const e of stream.events) {
        if (e.t - prev > d) {
          return {
            events: stream.events.filter((x) => x.t < prev + d).map((e2) => ({ ...e2 })),
            completeAt: prev + d,
            error: true,
          };
        }
        prev = e.t;
      }
      if (stream.completeAt - prev > d) {
        return { events: stream.events.map((e) => ({ ...e })), completeAt: prev + d, error: true };
      }
      return { events: stream.events.map((e) => ({ ...e })), completeAt: stream.completeAt, error: stream.error };
    },
  },
};

function expandInner(t0, v, p) {
  const count = Math.max(0, Math.floor(p.count));
  const d = Math.max(0, p.d);
  const out = [];
  for (let i = 1; i <= count; i++) out.push({ t: t0 + i * d, value: v });
  return out;
}

function innerSpan(p) {
  return Math.max(0, Math.floor(p.count)) * Math.max(0, p.d);
}

// ============================================================
// ホバーツールチップ用のミニマーブル図
// marble test 記法 (-1-2--3-|) で各オペレータの before/after を見せる
// ============================================================

const TIP_EXAMPLE_A = { events: [{ t: 1, value: 1 }, { t: 2, value: 2 }, { t: 4, value: 2 }, { t: 7, value: 1 }], completeAt: 9 };
const TIP_EXAMPLE_B = { events: [{ t: 3, value: 5 }, { t: 6, value: 6 }], completeAt: 8 };
const TIP_EXAMPLE_EMPTY = { events: [], completeAt: 9 };
const TIP_EXAMPLE_ERR = { events: [{ t: 1, value: 1 }, { t: 2, value: 2 }], completeAt: 4, error: true };

// 例示用パラメータ（中立初期値では変化が見えないため）
const TIP_PARAMS = {
  map: { op: "mul", operand: 2 },
  filter: { cmp: "gte", operand: 2 },
  take: { count: 2 },
  skip: { count: 2 },
  scan: { op: "add", seed: 0 },
  takeWhile: { cmp: "lt", operand: 2 },
  startWith: { value: 0 },
  delay: { d: 2 },
  throttleTime: { d: 2 },
  debounceTime: { d: 2 },
  auditTime: { d: 2 },
  reduce: { op: "add", seed: 0 },
  mapTo: { value: 7 },
  elementAt: { n: 1 },
  takeLast: { count: 2 },
  skipLast: { count: 2 },
  defaultIfEmpty: { value: 9 },
  takeUntil: { time: 5 },
  skipUntil: { time: 5 },
  zip: { op: "add" },
  combineLatest: { op: "add" },
  withLatestFrom: { op: "add" },
  mergeMap: { count: 2, d: 1 },
  concatMap: { count: 2, d: 1 },
  switchMap: { count: 2, d: 1 },
  exhaustMap: { count: 2, d: 1 },
  catchError: { value: 9 },
  retry: { count: 1 },
  timeout: { d: 2 },
};

function marbleString(stream, len) {
  const cells = Array(len + 1).fill("-");
  for (const e of stream.events) {
    if (e.t <= len) cells[e.t] = String(Math.abs(e.value) % 10);
  }
  let trailing = "";
  const term = stream.error ? "#" : "|";
  const c = stream.completeAt;
  if (c <= len) {
    if (cells[c] !== "-") trailing = term;
    else cells[c] = term;
  }
  return cells.join("") + trailing;
}

function buildOperatorTip(type) {
  const def = OPERATOR_DEFS[type];
  const params = TIP_PARAMS[type] ?? def.createParams();
  const input = type === "defaultIfEmpty" ? TIP_EXAMPLE_EMPTY
    : (type === "catchError" || type === "retry") ? TIP_EXAMPLE_ERR
    : TIP_EXAMPLE_A;
  const out = def.binary ? def.apply(input, params, TIP_EXAMPLE_B) : def.apply(input, params);
  const L = 12;
  const lines = [
    I18N.opDoc(type) ?? OPERATOR_DOCS[type],
    "",
    t("tip.example", { desc: def.describe(params) }),
    `${t("tip.in")}: ${marbleString(input, L)}`,
  ];
  if (def.binary) lines.push(`${t("tip.b")}: ${marbleString(TIP_EXAMPLE_B, L)}`);
  lines.push(`${t("tip.out")}: ${marbleString(out, L)}`);
  return lines.join("\n");
}

// OPERATOR_DOCS より前に定義されるため、初回参照時に遅延生成する
const OPERATOR_TIPS = {};
function operatorTip(type) {
  return (OPERATOR_TIPS[type] ??= buildOperatorTip(type));
}

// ============================================================
// 正準解（ヒント生成と機械検証に使う。別解の存在は妨げない）
// ============================================================

const sol = (type, params = {}) => ({ type, params });
const SOLUTIONS = {
  "stage-01": { a: [sol("map",{op:"mul",operand:2})] },
  "stage-02": { a: [sol("filter",{cmp:"gte",operand:3})] },
  "stage-03": { a: [sol("take",{count:3})] },
  "stage-04": { a: [sol("skip",{count:2})] },
  "stage-05": { a: [sol("map",{op:"mod",operand:3})] },
  "stage-06": { a: [sol("map",{op:"mod",operand:2}), sol("filter",{cmp:"eq",operand:0})] },
  "stage-07": { a: [sol("skip",{count:1}), sol("take",{count:3})] },
  "stage-08": { a: [sol("take",{count:5})] },
  "stage-09": { a: [sol("scan",{op:"add",seed:0})] },
  "stage-10": { a: [sol("distinctUntilChanged")] },
  "stage-11": { a: [sol("takeWhile",{cmp:"lt",operand:5})] },
  "stage-12": { a: [sol("startWith",{value:1})] },
  "stage-13": { a: [sol("scan",{op:"add",seed:0}), sol("filter",{cmp:"gte",operand:6})] },
  "stage-14": { a: [sol("scan",{op:"max",seed:0}), sol("distinctUntilChanged")] },
  "stage-15": { a: [sol("startWith",{value:2}), sol("scan",{op:"mul",seed:1})] },
  "stage-16": { a: [sol("map",{op:"mod",operand:2}), sol("distinctUntilChanged")] },
  "stage-17": { a: [sol("delay",{d:2})] },
  "stage-18": { a: [sol("throttleTime",{d:3})] },
  "stage-19": { a: [sol("debounceTime",{d:2})] },
  "stage-20": { a: [sol("reduce",{op:"mul",seed:1})] },
  "stage-21": { a: [sol("debounceTime",{d:2})] },
  "stage-22": { a: [sol("throttleTime",{d:2}), sol("reduce",{op:"add",seed:0})] },
  "stage-23": { a: [sol("filter",{cmp:"gte",operand:5}), sol("take",{count:2}), sol("delay",{d:2})] },
  "stage-24": { a: [sol("debounceTime",{d:2}), sol("map",{op:"mul",operand:10})] },
  "stage-25": { a: [sol("mapTo",{value:7})] },
  "stage-26": { a: [sol("index")] },
  "stage-27": { a: [sol("timestamp")] },
  "stage-28": { a: [sol("last")] },
  "stage-29": { a: [sol("timestamp"), sol("filter",{cmp:"gte",operand:5})] },
  "stage-30": { a: [sol("index"), sol("filter",{cmp:"lte",operand:1})] },
  "stage-31": { a: [sol("mapTo",{value:1}), sol("scan",{op:"add",seed:0})] },
  "stage-32": { a: [sol("delay",{d:2}), sol("timestamp"), sol("filter",{cmp:"gte",operand:5}), sol("map",{op:"mul",operand:2})] },
  "stage-33": { a: [sol("takeLast",{count:2})] },
  "stage-34": { a: [sol("skipLast",{count:2})] },
  "stage-35": { a: [sol("elementAt",{n:2})] },
  "stage-36": { a: [sol("defaultIfEmpty",{value:7})] },
  "stage-37": { a: [sol("elementAt",{n:3})] },
  "stage-38": { a: [sol("skip",{count:1}), sol("skipLast",{count:1})] },
  "stage-39": { a: [sol("filter",{cmp:"gte",operand:10}), sol("defaultIfEmpty",{value:9})] },
  "stage-40": { a: [sol("elementAt",{n:2})] },
  "stage-41": { a: [sol("distinct")] },
  "stage-42": { a: [sol("takeUntil",{time:5})] },
  "stage-43": { a: [sol("skipUntil",{time:5})] },
  "stage-44": { a: [sol("auditTime",{d:3})] },
  "stage-45": { a: [sol("map",{op:"mod",operand:3}), sol("distinct")] },
  "stage-46": { a: [sol("skipUntil",{time:3}), sol("takeUntil",{time:8})] },
  "stage-47": { a: [sol("auditTime",{d:2})] },
  "stage-48": { a: [sol("distinct"), sol("takeUntil",{time:10}), sol("scan",{op:"add",seed:0}), sol("last")] },
  "stage-49": { a: [sol("merge")] },
  "stage-50": { a: [sol("zip",{op:"add"})] },
  "stage-51": { a: [sol("combineLatest",{op:"mul"})] },
  "stage-52": { a: [sol("withLatestFrom",{op:"add"})] },
  "stage-53": { a: [sol("withLatestFrom",{op:"add"}), sol("take",{count:2})] },
  "stage-54": { a: [sol("combineLatest",{op:"mul"}), sol("filter",{cmp:"gte",operand:1000})] },
  "stage-55": { a: [sol("zip",{op:"sub"})] },
  "stage-56": { a: [sol("merge"), sol("scan",{op:"add",seed:0})] },
  "stage-57": { a: [sol("sample")] },
  "stage-58": { a: [sol("takeUntilB")] },
  "stage-59": { a: [sol("skipUntilB")] },
  "stage-60": { a: [sol("race")] },
  "stage-61": { a: [sol("debounceTime",{d:2}), sol("distinctUntilChanged")] },
  "stage-62": { a: [sol("race"), sol("mapTo",{value:404})] },
  "stage-63": { a: [sol("sample"), sol("distinctUntilChanged")] },
  "stage-64": { a: [sol("takeUntilB"), sol("scan",{op:"add",seed:0}), sol("last")] },
  "stage-65": { a: [sol("delay",{d:2}), sol("merge")] },
  "stage-66": { a: [sol("merge"), sol("distinct")] },
  "stage-67": { a: [sol("distinctUntilChanged"), sol("debounceTime",{d:2})] },
  "stage-68": { a: [sol("elementAt",{n:2}), sol("mapTo",{value:999})] },
  "stage-69": { a: [sol("scan",{op:"add",seed:0}), sol("filter",{cmp:"gte",operand:100}), sol("take",{count:1})] },
  "stage-70": { a: [sol("takeUntil",{time:6}), sol("defaultIfEmpty",{value:-1})] },
  "stage-71": { a: [sol("mapTo",{value:1}), sol("scan",{op:"add",seed:0}), sol("map",{op:"mul",operand:25})] },
  "stage-72": { a: [sol("skipUntil",{time:3}), sol("takeUntil",{time:9}), sol("reduce",{op:"add",seed:0})] },
  "stage-73": { a: [sol("merge")], b: [sol("filter",{cmp:"lt",operand:100})] },
  "stage-74": { a: [sol("merge")], b: [sol("map",{op:"mul",operand:12})] },
  "stage-75": { a: [sol("zip",{op:"sub"})], b: [sol("skip",{count:1})] },
  "stage-76": { a: [sol("takeUntilB")], b: [sol("filter",{cmp:"gte",operand:1})] },
  "stage-77": { a: [sol("sample")], b: [sol("throttleTime",{d:4})] },
  "stage-78": { a: [sol("combineLatest",{op:"mul"})], b: [sol("filter",{cmp:"lte",operand:10})] },
  "stage-79": { a: [sol("mergeMap",{count:3,d:2})] },
  "stage-80": { a: [sol("concatMap",{count:3,d:2})] },
  "stage-81": { a: [sol("switchMap",{count:3,d:2})] },
  "stage-82": { a: [sol("exhaustMap",{count:3,d:2})] },
  "stage-83": { a: [sol("debounceTime",{d:2}), sol("distinctUntilChanged"), sol("switchMap",{count:1,d:2})] },
  "stage-84": { a: [sol("exhaustMap",{count:2,d:1})] },
  "stage-85": { a: [sol("concatMap",{count:2,d:1})] },
  "stage-86": { a: [sol("filter",{cmp:"gte",operand:1}), sol("switchMap",{count:3,d:2})] },
  "stage-87": { a: [sol("catchError",{value:9})] },
  "stage-88": { a: [sol("timeout",{d:4})] },
  "stage-89": { a: [sol("retry",{count:2})] },
  "stage-90": { a: [sol("retry",{count:1}), sol("catchError",{value:0})] },
  "stage-91": { a: [sol("timeout",{d:4}), sol("catchError",{value:-1})] },
  "stage-92": { a: [sol("map",{op:"mul",operand:10}), sol("catchError",{value:5})] },
  "stage-93": { a: [sol("timeout",{d:3}), sol("catchError",{value:0})] },
  "stage-94": { a: [sol("retry",{count:2}), sol("take",{count:2})] },
};

// ============================================================
// Pure evaluation & diff
// ============================================================

function evaluatePipeline(input, nodes, inputB) {
  let stream = {
    events: input.events.map((e) => ({ ...e })),
    completeAt: input.completeAt,
    error: Boolean(input.error),
  };
  const b = inputB ?? { events: [], completeAt: 0 };
  for (const node of nodes) {
    const def = OPERATOR_DEFS[node.type];
    const before = stream;
    stream = def.binary ? def.apply(stream, node.params, b) : def.apply(stream, node.params);
    // エラー終端の既定伝播: オペレータが明示しない場合、完了時刻を動かして
    // いなければ終端種別を引き継ぎ、前倒し等で動かしていれば正常完了になる
    if (stream.error === undefined) {
      stream.error = stream.completeAt === before.completeAt ? Boolean(before.error) : false;
    }
  }
  return stream;
}

// 時刻ごとに出力と正解を突き合わせて分類する。
// v0 の前提: 同時刻イベントは各ストリーム最大 1 個。
function diffStreams(output, expected) {
  const times = [...new Set([
    ...output.events.map((e) => e.t),
    ...expected.events.map((e) => e.t),
  ])].sort((a, b) => a - b);

  const outputMarks = []; // {t, value, status: 'match'|'wrong'|'extra'}
  const ghostMarks = [];  // 正解側にしかない、または値違いの正解値
  const counts = { match: 0, extra: 0, missing: 0, wrong: 0 };

  for (const t of times) {
    const out = output.events.find((e) => e.t === t);
    const exp = expected.events.find((e) => e.t === t);
    if (out && exp) {
      if (out.value === exp.value) {
        outputMarks.push({ t, value: out.value, status: "match" });
        counts.match += 1;
      } else {
        outputMarks.push({ t, value: out.value, status: "wrong" });
        ghostMarks.push({ t, value: exp.value });
        counts.wrong += 1;
      }
    } else if (out) {
      outputMarks.push({ t, value: out.value, status: "extra" });
      counts.extra += 1;
    } else {
      ghostMarks.push({ t, value: exp.value });
      counts.missing += 1;
    }
  }

  const completeMatch = output.completeAt === expected.completeAt;
  const errorMatch = Boolean(output.error) === Boolean(expected.error);
  const isClear =
    counts.extra === 0 && counts.missing === 0 && counts.wrong === 0 &&
    completeMatch && errorMatch;
  return { outputMarks, ghostMarks, counts, completeMatch, errorMatch, isClear };
}

// ============================================================
// Stage operator availability
// 各サイクルの前半4問（導入）はステージ定義の availableOperators
// （「正しいオペレータを選ぶ」課題のための絞り込み）を使い、
// 後半4問（応用）は全パーツを開放する。使えるパーツの一覧が
// 答えのヒントにならないようにするため。
// 2入力オペレータは入力 B があるステージでのみ提供する。
// ============================================================

// OPERATOR_DEFS のキー順は「サイクルごとに4個ずつ、登場順」という契約。
// stageOperators() の累積アンロックがこの順序に依存している。
const ALL_OPERATOR_TYPES = Object.keys(OPERATOR_DEFS);

// 「パーツを追加」ボタンのホバー説明（describe はパラメータ依存なので別に持つ）
const OPERATOR_DOCS = {
  map: "各イベントの値を計算で変換する（x × 2 など）",
  filter: "条件を満たす値だけ通す",
  take: "先頭 n 個だけ通し、n 個目で完了する",
  skip: "先頭 n 個を捨てる",
  scan: "累積値（合計・最大など）を毎回出す",
  distinctUntilChanged: "直前と同じ値を捨てる",
  takeWhile: "条件を満たす間だけ通し、破れた瞬間に完了する",
  startWith: "t=0 に値を1個追加する",
  delay: "全イベントと完了を後ろにずらす",
  throttleTime: "発火したら d の間、後続を無視する（先頭側が残る）",
  debounceTime: "d 静かになるまで待ち、最後の値を遅れて出す",
  reduce: "完了時に畳み込んだ結果を1個だけ出す",
  mapTo: "すべての値を同じ値に置き換える",
  index: "値を通し番号 0,1,2,… に置き換える",
  timestamp: "値をその発生時刻に置き換える",
  last: "完了時に最後の値を1個だけ出す",
  takeLast: "末尾 n 個だけ残す（時刻はそのまま）",
  skipLast: "末尾 n 個を捨てる",
  elementAt: "n 番目（0始まり）だけ通し、その瞬間に完了する",
  defaultIfEmpty: "イベントが1個もなければ完了時に代わりの値を出す",
  distinct: "一度出た値は二度と通さない",
  takeUntil: "時刻 t で打ち切り、完了も t に前倒しする",
  skipUntil: "時刻 t より前のイベントを捨てる",
  auditTime: "イベントが来たら d の間様子を見て、窓が閉じた時刻に最新値を出す",
  merge: "B と時系列で1本に合流する",
  zip: "A と B の k 番目同士を組にして合成する（遅い方の時刻に発火）",
  combineLatest: "どちらかが更新されるたびに、最新同士を合成する",
  withLatestFrom: "A のイベント時に、B の最新値を添えて合成する",
  sample: "B の合図の時刻に、A の最新値を出す",
  takeUntilB: "B の最初のイベントで打ち切り、そこで完了する",
  skipUntilB: "B の最初のイベントが来るまで捨てる",
  race: "先に値を出した方のストリームだけを丸ごと採用する",
  mergeMap: "イベントごとに小さなストリームを展開し、すべて並行で流す",
  concatMap: "イベントごとに展開し、前の展開が終わるまで次を待たせる",
  switchMap: "イベントごとに展開し、新しいイベントが来たら前の展開を打ち切る",
  exhaustMap: "イベントごとに展開するが、展開中に来たイベントは無視する",
  catchError: "エラー（✕）を受け止めて代わりの値を流し、正常完了（｜）にする",
  retry: "エラーで終わったら最初から再購読する（最大 n 回）",
  timeout: "無音が d を超えたらエラー（✕）にする",
};

function stageOperators(index) {
  const stage = STAGES[index];
  const { c, pos } = cycleOfIndex(index);
  // openAll: 実践編など「新パーツ導入なし」のステージは常に全開放
  if (!stage.openAll && pos < 4) return stage.availableOperators;
  // 応用: そのサイクルまでに登場した全パーツを開放（未登場のパーツは出さない）
  return ALL_OPERATOR_TYPES.slice(0, CYCLES[c].opsThrough)
    .filter((t) => !OPERATOR_DEFS[t].binary || stage.inputB);
}

// ============================================================
// App state
// ============================================================

// ============================================================
// RxJS コード生成（クリア時にプレイヤーの解を本物のコードで見せる）
// ============================================================

const CMP_JS = { gte: ">=", gt: ">", lte: "<=", lt: "<", eq: "===", neq: "!==" };
const MAP_JS = { add: "+", sub: "-", mul: "*", mod: "%" };
const SCAN_JS = { add: "acc + x", mul: "acc * x", max: "Math.max(acc, x)", min: "Math.min(acc, x)" };
const COMBINE_JS = { add: "a + b", sub: "a - b", mul: "a * b", max: "Math.max(a, b)" };

function rxSnippet(node) {
  const p = node.params;
  switch (node.type) {
    case "map": return `map(x => x ${MAP_JS[p.op]} ${p.operand})`;
    case "filter": return `filter(x => x ${CMP_JS[p.cmp]} ${p.operand})`;
    case "take": return `take(${p.count})`;
    case "skip": return `skip(${p.count})`;
    case "scan": return `scan((acc, x) => ${SCAN_JS[p.op]}, ${p.seed})`;
    case "distinctUntilChanged": return "distinctUntilChanged()";
    case "takeWhile": return `takeWhile(x => x ${CMP_JS[p.cmp]} ${p.operand})`;
    case "startWith": return `startWith(${p.value})`;
    case "delay": return `delay(${p.d})`;
    case "throttleTime": return `throttleTime(${p.d})`;
    case "debounceTime": return `debounceTime(${p.d})`;
    case "auditTime": return `auditTime(${p.d})`;
    case "reduce": return `reduce((acc, x) => ${SCAN_JS[p.op]}, ${p.seed})`;
    case "mapTo": return `map(() => ${p.value})`;
    case "index": return "map((_, i) => i)";
    case "timestamp": return "timestamp(), map(t => t.timestamp)";
    case "last": return "last()";
    case "takeLast": return `takeLast(${p.count})`;
    case "skipLast": return `skipLast(${p.count})`;
    case "elementAt": return `elementAt(${p.n})`;
    case "defaultIfEmpty": return `defaultIfEmpty(${p.value})`;
    case "distinct": return "distinct()";
    case "takeUntil": return `takeUntil(timer(${p.time}))`;
    case "skipUntil": return `skipUntil(timer(${p.time}))`;
    case "merge": return "mergeWith(b$)";
    case "zip": return `zipWith(b$), map(([a, b]) => ${COMBINE_JS[p.op]})`;
    case "combineLatest": return `combineLatestWith(b$), map(([a, b]) => ${COMBINE_JS[p.op]})`;
    case "withLatestFrom": return `withLatestFrom(b$), map(([a, b]) => ${COMBINE_JS[p.op]})`;
    case "sample": return "sample(b$)";
    case "takeUntilB": return "takeUntil(b$)";
    case "skipUntilB": return "skipUntil(b$)";
    case "race": return "raceWith(b$)";
    case "mergeMap": return `mergeMap(x => timer(${p.d}, ${p.d}).pipe(take(${p.count}), map(() => x)))`;
    case "concatMap": return `concatMap(x => timer(${p.d}, ${p.d}).pipe(take(${p.count}), map(() => x)))`;
    case "switchMap": return `switchMap(x => timer(${p.d}, ${p.d}).pipe(take(${p.count}), map(() => x)))`;
    case "exhaustMap": return `exhaustMap(x => timer(${p.d}, ${p.d}).pipe(take(${p.count}), map(() => x)))`;
    case "catchError": return `catchError(() => of(${p.value}))`;
    case "retry": return `retry(${p.count})`;
    case "timeout": return `timeout(${p.d})`;
    default: return node.type + "()";
  }
}

// v0 の簡略化が実 Rx と異なるオペレータへの注記
const RX_NOTES = {
  takeLast: "実際の takeLast は完了時にまとめて放出します（本ゲームは表示の都合で元の時刻を保持）",
  skipLast: "実際の skipLast は n 個遅れで放出されます",
  timestamp: "実際の timestamp は {value, timestamp} のペアを流します（本ゲームは値を時刻に置き換える簡略版）",
  mapTo: "mapTo は RxJS で非推奨のため map(() => c) を使います",
  takeUntil: "実際の takeUntil / skipUntil は時刻ではなく Observable（例: timer(t)）を受け取ります",
  skipUntil: "実際の takeUntil / skipUntil は時刻ではなく Observable（例: timer(t)）を受け取ります",
  merge: "衝突時の順序は実 Rx では購読順に依存します",
  retry: "実際の retry はコールド Observable の再購読。ソースが毎回同じ内容とは限りません",
  timeout: "実際の timeout はエラーを投げるので catchError とセットで使うのが定石です",
};

function buildRxCode() {
  const usesB = state.nodesB.length > 0 ||
    state.nodes.some((n) => OPERATOR_DEFS[n.type].binary);
  const lines = [];
  if (usesB) {
    lines.push(state.nodesB.length
      ? `const b$ = inputB$.pipe(${state.nodesB.map(rxSnippet).join(", ")});`
      : "const b$ = inputB$;");
  }
  const src = usesB ? "inputA$" : "input$";
  lines.push(`${src}.pipe(${state.nodes.map(rxSnippet).join(", ")})`);
  const notes = [...new Set(
    [...state.nodes, ...state.nodesB].map((n) => I18N.rxNote(n.type) ?? RX_NOTES[n.type]).filter(Boolean),
  )];
  return { code: lines.join("\n"), notes };
}

// ============================================================
// 計測フック
// ------------------------------------------------------------
// 実体は analytics.js（未読み込み・未設定なら完全に無反応）。
// 送るのは「どこまで進んだか」だけで、個人を識別する値は一切送らない。
// 何をなぜ測るかは docs/metrics.md を参照。
// ============================================================

// 計測が落ちてもゲームは絶対に止めない
function track(name, props) {
  try { window.RxTrack?.event(name, props); } catch { /* 無視 */ }
}

function trackOnce(key, name, props, scope) {
  try { window.RxTrack?.once(key, name, props, scope); } catch { /* 無視 */ }
}

// 94 ステージ分のクリアを毎回送るとノイズになるので、
// 到達人数を見たい節目だけを「端末で一度きり」で送る。
const PROGRESS_MILESTONES = [1, 3, 8, 16, 32, 48, 64, 80];

function trackProgress() {
  const n = state.cleared.size;
  if (n === STAGES.length) {
    trackOnce("progress-all", "all-clear");
    return;
  }
  if (!PROGRESS_MILESTONES.includes(n)) return;
  trackOnce(`progress-${n}`, "progress", { count: n });
}

const TICKS_PER_SECOND = 1.5;
const HIDE_LEARN_KEY = "rx-pipeline-puzzle/hide-learn";
const SEEN_CYCLES_KEY = "rx-pipeline-puzzle/seen-cycles";

// サイクル開始カード: 各サイクルの初回訪問時に1度だけテーマを見せる
function loadSeenCycles() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_CYCLES_KEY) ?? "[]")); } catch { return new Set(); }
}

function maybeShowCycleIntro(index) {
  const { c, pos } = cycleOfIndex(index);
  if (pos !== 0) return;
  const seen = loadSeenCycles();
  if (seen.has(c)) return;
  seen.add(c);
  try { localStorage.setItem(SEEN_CYCLES_KEY, JSON.stringify([...seen])); } catch { /* 続行 */ }
  // 初回訪問の分岐に相乗り: サイクル到達を1度だけ記録する
  track("cycle-reach", { cycle: c + 1 });
  const cycle = CYCLES[c];
  dom.cycleTitle.textContent = I18N.cycle(cycle, c, "title");
  dom.cycleBody.textContent = I18N.cycle(cycle, c, "intro");
  dom.cycleParts.textContent = I18N.cycle(cycle, c, "parts");
  dom.cycleOverlay.hidden = false;
  // カードを読んでいる間は動かさない。「はじめる」で先頭から流し始める
  state.playing = false;
  state.playhead = 0;
  updatePlayhead();
  GameAudio.play("cycle-card", { duck: 2 });
}
// 32ステージ再編（v2）で番号と内容が変わったため、キーを切り替えて記録をリセット
const CLEARED_STORAGE_KEY = "rx-pipeline-puzzle/cleared-v2";

function loadClearedIds() {
  try {
    const raw = localStorage.getItem(CLEARED_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveClearedIds() {
  try {
    localStorage.setItem(CLEARED_STORAGE_KEY, JSON.stringify([...state.cleared]));
  } catch {
    // file:// などで localStorage が使えない環境では記録なしで続行
  }
}

const state = {
  stageIndex: 0,
  nodes: [],       // メインパイプライン（A を処理。2入力パーツを置ける）
  nodesB: [],      // パイプライン B（合流前に B を加工。単入力パーツのみ）
  nextNodeId: 1,
  playhead: 0,     // 現在の再生位置 (t)
  playing: false,
  speed: 1,
  output: null,
  diff: null,
  judging: false,  // 編集後、ゴールライン到達までは判定未確定（検査中）
  goalRevealed: true, // specMode のステージでは最初の判定確定まで正解レーンを隠す
  hintLevel: 0,    // 0=未使用、1=考え方、2=パーツ名、3=完全解
  failStreak: 0,   // 不一致確定の連続回数（3回でヒントボタンを点滅）
  cleared: loadClearedIds(), // クリア済みステージ id
};

const $ = (id) => document.getElementById(id);
const dom = {
  stageSelect: $("stage-select"),
  stageTitle: $("stage-title"),
  stageGoal: $("stage-goal"),
  btnHint: $("btn-hint"),
  hintBox: $("hint-box"),
  inputLabelA: $("input-label-a"),
  inputDesc: $("input-desc"),
  trackInput: $("track-input"),
  laneInputB: $("lane-input-b"),
  inputLabelB: $("input-label-b"),
  inputDescB: $("input-desc-b"),
  trackInputB: $("track-input-b"),
  trackOutput: $("track-output"),
  trackGoal: $("track-goal"),
  goalSub: $("goal-sub"),
  pipelineNodes: $("pipeline-nodes"),
  pipelineTitle: $("pipeline-title"),
  pipelineHint: $("pipeline-hint"),
  addButtons: $("add-buttons"),
  pipelineB: $("pipeline-b"),
  pipelineNodesB: $("pipeline-nodes-b"),
  addButtonsB: $("add-buttons-b"),
  nodeCount: $("node-count"),
  statusBadge: $("status-badge"),
  btnPlay: $("btn-play"),
  btnReset: $("btn-reset"),
  speedButtons: $("speed-buttons"),
  clearOverlay: $("clear-overlay"),
  clearMessage: $("clear-message"),
  clearLearn: $("clear-learn"),
  clearCode: $("clear-code"),
  clearInsight: $("clear-insight"),
  clearNotes: $("clear-notes"),
  chkHideLearn: $("chk-hide-learn"),
  btnResetLearn: $("btn-reset-learn"),
  btnNext: $("btn-next"),
  btnCloseOverlay: $("btn-close-overlay"),
  cycleOverlay: $("cycle-overlay"),
  cycleTitle: $("cycle-title"),
  cycleBody: $("cycle-body"),
  cycleParts: $("cycle-parts"),
  btnCycleStart: $("btn-cycle-start"),
};

const currentStage = () => STAGES[state.stageIndex];

// ============================================================
// DOM helpers
// ============================================================

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value !== false && value != null) node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child != null) node.append(child);
  }
  return node;
}

const timeToPercent = (t, duration) => `${(t / duration) * 100}%`;

// track に 軸・目盛り・イベント・完了バー・再生ヘッド を描く。
// delay 実験などでタイムライン外（t > duration）に出たものは描画しない。
function renderTrack(trackEl, { marks, completes }) {
  const duration = currentStage().duration;
  trackEl.replaceChildren();
  trackEl.append(el("div", { class: "track-line" }));
  for (let t = 0; t <= duration; t += 1) {
    trackEl.append(
      el("span", { class: "tick", style: `left:${timeToPercent(t, duration)}` }),
      el("span", { class: "tick-label", style: `left:${timeToPercent(t, duration)}` }, String(t)),
    );
  }
  // 完了バーを先に描き、同時刻のイベント円が上に重なっても
  // バーの上下がはみ出して位置が読めるようにする
  for (const c of completes) {
    if (c.t > duration) continue;
    trackEl.append(
      el("span", {
        class: `complete-mark ${c.cls ?? ""}${c.x ? " complete-mark--x" : ""}`,
        style: `left:${timeToPercent(c.t, duration)}`,
        "data-ev-t": c.t,
        title: c.x ? t("mark.errorTip", { t: c.t }) : t("mark.completeTip", { t: c.t }),
      }),
    );
  }
  for (const mark of marks) {
    if (mark.t > duration) continue;
    trackEl.append(
      el("span", {
        class: `event ${mark.cls ?? ""}`,
        style: `left:${timeToPercent(mark.t, duration)}`,
        "data-ev-t": mark.t,
      }, String(mark.value)),
    );
  }
  trackEl.append(el("div", { class: "playhead" }));
}

// ============================================================
// Rendering
// ============================================================

function streamDesc(stream) {
  const values = stream.events.map((e) => e.value).join(", ");
  return t("stream.desc", { values: values || t("stream.empty") });
}

function renderStageInfo() {
  const stage = currentStage();
  dom.stageTitle.textContent = I18N.stage(stage, "title");
  dom.stageGoal.textContent = I18N.stage(stage, "goal");
  // 実世界パターンのステージでは、A/B ではなく信号の中身をレーン見出しに出す
  const hasB = Boolean(stage.inputB);
  const labelA = I18N.stage(stage, "inputLabel");
  dom.inputLabelA.textContent = hasB
    ? (labelA ? t("lane.inputALabeled", { label: labelA }) : t("lane.inputA"))
    : (labelA ? t("lane.inputWith", { label: labelA }) : t("lane.input"));
  dom.inputDesc.textContent = streamDesc(stage.input);
  dom.laneInputB.hidden = !hasB;
  if (hasB) {
    const labelB = I18N.stage(stage, "inputBLabel");
    dom.inputLabelB.textContent = labelB
      ? t("lane.inputBLabeled", { label: labelB })
      : t("lane.inputB");
    dom.inputDescB.textContent = streamDesc(stage.inputB);
  }
  dom.pipelineTitle.textContent = hasB ? t("pipe.titleA") : t("pipe.title");
  dom.pipelineHint.textContent = hasB ? t("pipe.hintA") : "";
}

function renderInputAndGoal() {
  const stage = currentStage();
  renderTrack(dom.trackInput, {
    marks: stage.input.events.map((e) => ({ ...e })),
    completes: [{ t: stage.input.completeAt, x: stage.input.error }],
  });
  if (stage.inputB) {
    renderTrack(dom.trackInputB, {
      marks: stage.inputB.events.map((e) => ({ ...e })),
      completes: [{ t: stage.inputB.completeAt }],
    });
  }
  renderGoalLane();
}

// specMode: 正解レーンは最初の判定確定（ゴールライン到達）まで隠す。
// 「要件文からストリームを設計する」順問題の訓練のため。
function renderGoalLane() {
  const stage = currentStage();
  if (!state.goalRevealed) {
    dom.goalSub.textContent = t("lane.goalSpec");
    dom.trackGoal.replaceChildren(
      el("div", { class: "goal-hidden" }, t("lane.goalHidden")),
    );
    return;
  }
  dom.goalSub.textContent = t("lane.goalSub");
  renderTrack(dom.trackGoal, {
    marks: stage.expected.events.map((e) => ({ ...e, cls: "event--match" })),
    completes: [{ t: stage.expected.completeAt, x: stage.expected.error }],
  });
}

function renderOutputLane() {
  const stage = currentStage();
  // specMode で正解が未開示の間は、差分の色分け・ゴーストを出さない（正解が漏れるため）
  if (!state.goalRevealed) {
    renderTrack(dom.trackOutput, {
      marks: state.output.events.map((e) => ({ ...e })),
      completes: [{ t: state.output.completeAt, x: state.output.error }],
    });
    return;
  }
  const { outputMarks, ghostMarks, completeMatch } = state.diff;
  // 値違いのゴースト（出力イベントと同時刻）は重ならないよう上にずらす
  const wrongTimes = new Set(
    outputMarks.filter((m) => m.status === "wrong").map((m) => m.t),
  );
  const marks = [
    ...outputMarks.map((m) => ({ t: m.t, value: m.value, cls: `event--${m.status}` })),
    ...ghostMarks.map((m) => ({
      t: m.t,
      value: m.value,
      cls: wrongTimes.has(m.t) ? "event--ghost event--ghost-paired" : "event--ghost",
    })),
  ];
  const termOk = completeMatch && state.diff.errorMatch;
  const completes = [
    { t: state.output.completeAt, cls: termOk ? "" : "complete-mark--bad", x: state.output.error },
  ];
  if (!termOk) {
    completes.push({ t: stage.expected.completeAt, cls: "complete-mark--ghost", x: stage.expected.error });
  }
  renderTrack(dom.trackOutput, { marks, completes });
}

function renderStatus() {
  dom.statusBadge.classList.remove("ok", "checking");
  if (state.judging) {
    dom.statusBadge.classList.add("checking");
    dom.statusBadge.textContent = t("judge.checking");
    return;
  }
  const { counts, completeMatch, errorMatch, isClear } = state.diff;
  if (isClear) {
    dom.statusBadge.classList.add("ok");
    dom.statusBadge.textContent = t("judge.ok");
    return;
  }
  const parts = [];
  if (counts.missing) parts.push(t("judge.missing", { n: counts.missing }));
  if (counts.extra) parts.push(t("judge.extra", { n: counts.extra }));
  if (counts.wrong) parts.push(t("judge.wrong", { n: counts.wrong }));
  if (!completeMatch) parts.push(t("judge.completeShift"));
  if (!errorMatch) parts.push(t("judge.terminalShift"));
  dom.statusBadge.textContent = parts.join(t("judge.sep"));
}

// maxNodes は A/B 両パイプラインの合計に対する上限
function totalNodes() {
  return state.nodes.length + state.nodesB.length;
}

function renderPipeline() {
  const stage = currentStage();
  const full = totalNodes() >= stage.maxNodes;

  renderNodePanel(
    dom.pipelineNodes, dom.addButtons, state.nodes,
    stageOperators(state.stageIndex), full,
    t("pipe.emptyA"),
  );
  dom.nodeCount.textContent = t("pipe.count", { n: totalNodes(), max: stage.maxNodes });

  // B パイプラインは応用ステージ（または openAll）のみ。導入ステージは
  // オペレータ学習に集中させるため B は常に原本のまま合流させる。
  const typesB = stageOperators(state.stageIndex).filter((t) => !OPERATOR_DEFS[t].binary);
  const showB = Boolean(stage.inputB) && typesB.length > 0 &&
    (stage.openAll || cycleOfIndex(state.stageIndex).pos >= 4);
  dom.pipelineB.hidden = !showB;
  if (showB) {
    renderNodePanel(
      dom.pipelineNodesB, dom.addButtonsB, state.nodesB,
      typesB,
      full,
      t("pipe.emptyB"),
    );
  }
}

function renderNodePanel(nodesEl, addButtonsEl, list, types, full, placeholder) {
  nodesEl.replaceChildren();
  if (list.length === 0) {
    nodesEl.append(el("div", { class: "node-placeholder" }, placeholder));
  }
  list.forEach((node, index) => {
    nodesEl.append(buildNodeCard(node, index, list));
  });
  addButtonsEl.replaceChildren();
  for (const type of types) {
    addButtonsEl.append(
      el("button", {
        disabled: full,
        "data-tip": operatorTip(type),
        onclick: () => addNode(list, type),
      }, `+ ${OPERATOR_DEFS[type].label}`),
    );
  }
}

// 時間系パラメータの上限。タイムラインの外に置いても意味がないので、
// ステージの長さで頭打ちにする。
function timeMax() {
  return currentStage()?.duration ?? 20;
}

function buildNodeCard(node, index, list) {
  const def = OPERATOR_DEFS[node.type];
  const desc = el("span", { class: "node-desc" }, def.describe(node.params));
  const refreshDesc = () => { desc.textContent = def.describe(node.params); };

  const params = el("div", { class: "node-params" });

  // 数値はキーボード入力させず、−/+ のボタンだけで動かす。
  // ネイティブの number スピナーは当たり判定が小さく、スマホでは
  // キーボードまで出てしまって操作にならないため。
  let lastStepSound = 0;
  const stepSound = () => {
    // 長押しの連射で音が機関銃にならないよう間引く
    const now = performance.now();
    if (now - lastStepSound < 110) return;
    lastStepSound = now;
    GameAudio.play("param-change", { db: -6 });
  };

  const holdRepeat = (btn, step) => {
    let delayTimer = null;
    let repeatTimer = null;
    const stop = () => {
      clearTimeout(delayTimer);
      clearInterval(repeatTimer);
      delayTimer = repeatTimer = null;
    };
    const tick = () => {
      // 再描画でボタンが外れたら連射も止める（外れた DOM に打ち続けない）
      if (!btn.isConnected) { stop(); return; }
      step();
    };
    btn.addEventListener("pointerdown", (ev) => {
      if (ev.button > 0) return;
      ev.preventDefault(); // 長押しでの選択・スクロールを抑える
      stop(); // 連打で前回のタイマーが残ると、離しても止まらなくなる
      step();
      delayTimer = setTimeout(() => { repeatTimer = setInterval(tick, 90); }, 400);
      const release = () => {
        stop();
        window.removeEventListener("pointerup", release);
        window.removeEventListener("pointercancel", release);
      };
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", release);
    });
  };

  const numberInput = (key, min, max = 99) => {
    let dec = null;
    let inc = null;

    const value = el("span", {
      class: "stepper-value",
      role: "spinbutton", tabindex: "0",
      "aria-valuemin": String(min), "aria-valuemax": String(max),
      "aria-valuenow": String(node.params[key]),
    }, String(node.params[key]));

    const apply = (next) => {
      const v = Math.min(max, Math.max(min, next));
      dec.disabled = v <= min;
      inc.disabled = v >= max;
      if (v === node.params[key]) return;
      node.params[key] = v;
      value.textContent = String(v);
      value.setAttribute("aria-valuenow", String(v));
      refreshDesc();
      stepSound();
      recompute();
    };

    dec = el("button", { type: "button", class: "stepper-btn", "aria-label": t("node.decrease") }, "−");
    inc = el("button", { type: "button", class: "stepper-btn", "aria-label": t("node.increase") }, "+");
    holdRepeat(dec, () => apply(node.params[key] - 1));
    holdRepeat(inc, () => apply(node.params[key] + 1));

    // キーボードでも動かせるようにする（矢印・PageUp/Down・Home/End）
    value.addEventListener("keydown", (ev) => {
      const by = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[ev.key];
      if (by !== undefined) apply(node.params[key] + by);
      else if (ev.key === "Home") apply(min);
      else if (ev.key === "End") apply(max);
      else return;
      ev.preventDefault();
    });

    dec.disabled = node.params[key] <= min;
    inc.disabled = node.params[key] >= max;
    return el("div", { class: "stepper" }, dec, value, inc);
  };

  const selectInput = (key, options) => {
    const select = el("select", {
      onchange: (e) => {
        node.params[key] = e.target.value;
        refreshDesc();
        GameAudio.play("param-change", { db: -6 });
        recompute();
      },
    });
    for (const [value, label] of options) {
      select.append(el("option", { value, selected: node.params[key] === value }, label));
    }
    return select;
  };

  if (node.type === "map") {
    params.append(
      selectInput("op", Object.entries(MAP_OPS).map(([k, v]) => [k, `x ${v.symbol} k`])),
      numberInput("operand", -99),
    );
  } else if (node.type === "filter" || node.type === "takeWhile") {
    params.append(
      selectInput("cmp", Object.entries(FILTER_CMPS).map(([k, v]) => [k, `x ${v.symbol} k`])),
      numberInput("operand", -99),
    );
  } else if (node.type === "scan" || node.type === "reduce") {
    params.append(
      selectInput("op", Object.entries(SCAN_OPS).map(([k, v]) => [k, v.expr])),
      numberInput("seed", -99),
    );
  } else if (["take", "skip", "takeLast", "skipLast", "retry"].includes(node.type)) {
    const countMax = node.type === "retry" ? 5 : 20;
    params.append(numberInput("count", node.type === "take" || node.type === "takeLast" ? 1 : 0, countMax));
  } else if (node.type === "elementAt") {
    params.append(numberInput("n", 0, 20));
  } else if (["delay", "throttleTime", "debounceTime", "auditTime", "timeout"].includes(node.type)) {
    params.append(numberInput("d", 0, timeMax()));
  } else if (["startWith", "mapTo", "defaultIfEmpty", "catchError"].includes(node.type)) {
    params.append(numberInput("value", -99));
  } else if (node.type === "takeUntil" || node.type === "skipUntil") {
    params.append(numberInput("time", 0, timeMax()));
  } else if (["mergeMap", "concatMap", "switchMap", "exhaustMap"].includes(node.type)) {
    params.append(numberInput("count", 0, 6), numberInput("d", 0, timeMax()));
  } else if (["zip", "combineLatest", "withLatestFrom"].includes(node.type)) {
    params.append(
      selectInput("op", Object.entries(COMBINE_OPS).map(([k, v]) => [k, v.expr])),
    );
  } else {
    params.append(el("span", { class: "node-noparam" }, t("node.noParams")));
  }

  const tools = el("div", { class: "node-tools" },
    el("button", {
      title: t("node.moveLeft"), disabled: index === 0,
      onclick: () => moveNode(list, index, -1),
    }, "◀"),
    el("button", {
      title: t("node.moveRight"), disabled: index === list.length - 1,
      onclick: () => moveNode(list, index, +1),
    }, "▶"),
    el("button", {
      class: "remove", title: t("node.remove"),
      onclick: () => removeNode(list, index),
    }, "×"),
  );

  // 2入力パーツは「ここで B が合流する」ことが見えるように別スタイル＋バッジ
  return el("div", { class: def.binary ? "node node--binary" : "node" },
    def.binary ? el("div", { class: "node-b-badge" }, t("node.combinesB")) : null,
    el("div", { class: "node-head" }, el("strong", {}, def.label), desc),
    params,
    tools,
  );
}

// ============================================================
// Pipeline mutations
// ============================================================

function addNode(list, type) {
  if (totalNodes() >= currentStage().maxNodes) return;
  // 「開いただけ」と「実際に遊んだ」を分ける唯一の地点。
  // 最初の1個を置いた瞬間をプレイ回数として数える。
  trackOnce("played", "play", null, "session");
  list.push({
    id: `node-${state.nextNodeId++}`,
    type,
    params: OPERATOR_DEFS[type].createParams(),
  });
  GameAudio.play("part-add");
  renderPipeline();
  recompute();
}

function removeNode(list, index) {
  list.splice(index, 1);
  GameAudio.play("part-remove");
  renderPipeline();
  recompute();
}

function moveNode(list, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
  GameAudio.play("part-add", { db: -4 });
  renderPipeline();
  recompute();
}

// ============================================================
// Judgment & clear flow
// 出力の再計算は編集のたびに行うが、判定の「確定」は再生ヘッドが
// ゴールライン（タイムライン末尾）に到達した時点。それまでは
// バッジを「検査中…」として点滅させ、スイープを先頭からやり直す。
// ============================================================

function recompute() {
  const stage = currentStage();
  // B はまずパイプライン B を通り、その出力がメイン側の2入力パーツに渡る
  const bStream = stage.inputB
    ? evaluatePipeline(stage.inputB, state.nodesB)
    : undefined;
  state.output = evaluatePipeline(stage.input, state.nodes, bStream);
  state.diff = diffStreams(state.output, stage.expected);

  renderOutputLane();
  hideClearOverlay();

  state.judging = true;
  state.playhead = 0;
  state.playing = true;
  renderStatus();
  updatePlayhead();
}

// ============================================================
// 3段階ヒント（1=考え方、2=使うパーツ、3=完全解）
// 内容は SOLUTIONS（正準解）から自動生成する
// ============================================================

function hintText(level) {
  const stage = currentStage();
  const solution = SOLUTIONS[stage.id];
  const total = solution.a.length + (solution.b?.length ?? 0);
  if (level === 1) {
    return stage.hints?.[0] ?? t("hint.l1", { n: total });
  }
  if (level === 2) {
    const names = [...new Set([...solution.a, ...(solution.b ?? [])].map((n) => OPERATOR_DEFS[n.type].label))]
      .sort().join(", ");
    const bNote = solution.b?.length ? t("hint.l2b", { n: solution.b.length }) : "";
    return t("hint.l2", { names, bNote });
  }
  const fmt = (nodes) => nodes.map((n) => t("hint.node", { label: OPERATOR_DEFS[n.type].label, desc: OPERATOR_DEFS[n.type].describe(n.params) })).join(" → ");
  let text = fmt(solution.a);
  if (solution.b?.length) text = t("hint.l3b", { b: fmt(solution.b), a: text });
  return t("hint.l3", { solution: text });
}

function showHint() {
  state.hintLevel = Math.min(3, state.hintLevel + 1);
  // 難易度が破綻していないかの指標。段階ごとにセッション1回だけ。
  trackOnce(`hint-${state.hintLevel}`, "hint", { level: state.hintLevel }, "session");
  dom.hintBox.hidden = false;
  dom.hintBox.textContent = hintText(state.hintLevel);
  dom.btnHint.textContent = state.hintLevel >= 3 ? t("hint.max") : t("hint.more", { n: state.hintLevel });
  dom.btnHint.classList.remove("nudge");
}

function resetHintUI() {
  state.hintLevel = 0;
  state.failStreak = 0;
  dom.hintBox.hidden = true;
  dom.btnHint.textContent = t("hint.button");
  dom.btnHint.classList.remove("nudge");
}

// ゴールライン到達時に呼ばれ、判定を確定する
function finalizeJudgment() {
  if (!state.goalRevealed) {
    state.goalRevealed = true; // specMode: 最初の判定で正解を開示
    renderGoalLane();
    renderOutputLane();
    updatePlayhead();
  }
  if (state.judging) {
    state.judging = false;
    renderStatus();
    if (!state.diff?.isClear && totalNodes() > 0) {
      GameAudio.play(state.output?.error ? "error-x" : "judge-ng");
    }
    // 手詰まりの検知: パーツを置いた状態での不一致確定が続いたらヒントへ誘導
    if (!state.diff?.isClear && totalNodes() > 0) {
      state.failStreak += 1;
      if (state.failStreak >= 3 && state.hintLevel === 0) dom.btnHint.classList.add("nudge");
    } else if (state.diff?.isClear) {
      state.failStreak = 0;
    }
  }
  if (state.diff?.isClear) {
    markCleared(currentStage().id);
    showClearOverlay();
  }
}

function markCleared(stageId) {
  if (state.cleared.has(stageId)) return;
  state.cleared.add(stageId);
  saveClearedIds();
  refreshStageSelectLabels();
  // どのステージで詰まるかを見るため、ステージ単位のクリアは初回だけ送る
  trackOnce(`clear-${stageId}`, "stage-clear", { stage: stageId });
  trackProgress();
}

function learnHidden() {
  try { return localStorage.getItem(HIDE_LEARN_KEY) === "1"; } catch { return false; }
}

function setLearnHidden(hidden) {
  try {
    if (hidden) localStorage.setItem(HIDE_LEARN_KEY, "1");
    else localStorage.removeItem(HIDE_LEARN_KEY);
  } catch { /* 記録なしで続行 */ }
  dom.btnResetLearn.hidden = !hidden;
}

function showClearOverlay() {
  const stage = currentStage();
  const isLast = state.stageIndex === STAGES.length - 1;
  const allCleared = state.cleared.size === STAGES.length;
  dom.clearMessage.textContent = allCleared ? t("clear.all") : t("clear.matched");
  const hidden = learnHidden();
  dom.clearLearn.hidden = hidden;
  if (!hidden) {
    const { code, notes } = buildRxCode();
    dom.clearCode.textContent = code;
    const insight = I18N.stage(stage, "insight");
    dom.clearInsight.textContent = insight ?? "";
    dom.clearInsight.hidden = !insight;
    dom.clearNotes.textContent = notes.length ? "⚠ " + notes.join(" ／ ") : "";
    dom.clearNotes.hidden = notes.length === 0;
    dom.chkHideLearn.checked = false;
  }
  dom.btnNext.hidden = isLast;
  dom.clearOverlay.hidden = false;
  GameAudio.play(allCleared ? "all-clear" : "stage-clear", { duck: allCleared ? 4 : 2.5 });
}

function hideClearOverlay() {
  dom.clearOverlay.hidden = true;
}

// ============================================================
// Playback
// ============================================================

function updatePlayhead() {
  const duration = currentStage().duration;
  const left = timeToPercent(Math.min(state.playhead, duration), duration);
  for (const ph of document.querySelectorAll(".playhead")) {
    ph.style.left = left;
  }
  for (const evEl of document.querySelectorAll("[data-ev-t]")) {
    evEl.classList.toggle("future", Number(evEl.dataset.evT) > state.playhead + 1e-6);
  }
  dom.btnPlay.textContent = state.playing ? "Ⅱ" : "▶";
}

let lastStepTime = null;

// 絶対時刻ベースで進めるため、rAF と setInterval の両方から
// 呼ばれても二重に進むことはない。setInterval はウィンドウが
// 非表示で rAF が止まる環境（WKWebView 等）へのフォールバック。
// 通常はループ再生。ゴールライン到達時に判定を確定し、
// 一致していた場合のみ停止してクリア演出に入る。
function step(now) {
  if (state.playing && lastStepTime != null) {
    const dt = (now - lastStepTime) / 1000;
    state.playhead += dt * TICKS_PER_SECOND * state.speed;
    const duration = currentStage().duration;
    if (state.playhead >= duration) {
      if (state.diff?.isClear) {
        state.playhead = duration;
        state.playing = false;
        updatePlayhead();
        finalizeJudgment();
      } else {
        finalizeJudgment();
        state.playhead = state.playhead % duration;
        updatePlayhead();
      }
    } else {
      updatePlayhead();
    }
  }
  lastStepTime = now;
}

function frame(now) {
  step(now);
  requestAnimationFrame(frame);
}

// ============================================================
// Stage loading & wiring
// ============================================================

function loadStage(index) {
  state.stageIndex = index;
  state.nodes = [];
  state.nodesB = [];
  state.goalRevealed = !STAGES[index].specMode;
  state.playhead = 0;
  state.playing = true; // ステージ開始時からループ再生
  dom.stageSelect.value = String(index);
  resetHintUI();
  renderStageInfo();
  renderInputAndGoal();
  renderPipeline();
  recompute();
  maybeShowCycleIntro(index);
}

function stageOptionLabel(stage) {
  return (state.cleared.has(stage.id) ? "✔ " : "") + I18N.stage(stage, "title");
}

function refreshStageSelectLabels() {
  for (const option of dom.stageSelect.options) {
    option.textContent = stageOptionLabel(STAGES[Number(option.value)]);
  }
}

function initStageSelect() {
  dom.stageSelect.replaceChildren();
  let offset = 0;
  CYCLES.forEach((cycle, c) => {
    const group = el("optgroup", { label: I18N.cycle(cycle, c, "title") });
    STAGES.slice(offset, offset + cycle.size).forEach((stage, i) => {
      group.append(el("option", { value: String(offset + i) }, stageOptionLabel(stage)));
    });
    dom.stageSelect.append(group);
    offset += cycle.size;
  });
  dom.stageSelect.addEventListener("change", (e) => {
    GameAudio.play("stage-select");
    loadStage(Number(e.target.value));
  });
}

function initControls() {
  dom.btnPlay.addEventListener("click", () => {
    if (state.playing) {
      state.playing = false;
    } else {
      if (state.playhead >= currentStage().duration) state.playhead = 0;
      state.playing = true;
      GameAudio.play("sweep-start", { db: -3 });
    }
    updatePlayhead();
  });

  dom.btnReset.addEventListener("click", () => {
    state.playhead = 0; // 再生状態は保ったまま先頭へ
    hideClearOverlay();
    updatePlayhead();
  });

  dom.speedButtons.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-speed]");
    if (!button) return;
    state.speed = Number(button.dataset.speed);
    for (const b of dom.speedButtons.querySelectorAll("button")) {
      b.classList.toggle("active", b === button);
    }
  });

  dom.btnNext.addEventListener("click", () => {
    hideClearOverlay();
    if (state.stageIndex < STAGES.length - 1) {
      loadStage(state.stageIndex + 1);
    }
  });

  dom.btnCloseOverlay.addEventListener("click", hideClearOverlay);

  dom.chkHideLearn.addEventListener("change", (e) => {
    setLearnHidden(e.target.checked);
    if (e.target.checked) dom.clearLearn.hidden = true;
  });

  dom.btnResetLearn.addEventListener("click", () => setLearnHidden(false));

  dom.btnResetLearn.hidden = !learnHidden();

  dom.btnHint.addEventListener("click", () => { GameAudio.play("param-change"); showHint(); });

  dom.btnCycleStart.addEventListener("click", () => {
    dom.cycleOverlay.hidden = true;
    state.playhead = 0;
    state.playing = true;
    updatePlayhead();
  });
}

// ============================================================
// サウンド設定 UI
// ブラウザの自動再生規制があるため、最初のユーザー操作で
// AudioContext を resume してから音源をデコードする。
// ============================================================

function initAudio() {
  const panel = $("audio-panel");
  const btn = $("btn-audio");
  const sliders = { master: $("aud-master"), music: $("aud-music"), sfx: $("aud-sfx") };
  const mute = $("aud-mute");

  const sync = (s) => {
    for (const [key, el] of Object.entries(sliders)) el.value = String(s[key]);
    mute.checked = s.muted;
    btn.textContent = s.muted || s.master === 0 ? "🔇" : "🔊";
  };
  sync(GameAudio.get());
  GameAudio.onChange(sync);

  btn.addEventListener("click", () => {
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  });

  // パネル外クリックで閉じる
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) panel.hidden = true;
  });

  for (const [key, el] of Object.entries(sliders)) {
    el.addEventListener("input", (e) => GameAudio.set(key, Number(e.target.value)));
  }
  mute.addEventListener("change", (e) => GameAudio.set("muted", e.target.checked));

  const unlockOnce = () => {
    GameAudio.unlock();
    document.removeEventListener("pointerdown", unlockOnce);
    document.removeEventListener("keydown", unlockOnce);
  };
  document.addEventListener("pointerdown", unlockOnce);
  document.addEventListener("keydown", unlockOnce);
}

I18N.applyStatic();
initStageSelect();
initControls();
initAudio();
loadStage(0);
requestAnimationFrame(frame);
setInterval(() => step(performance.now()), 200);
