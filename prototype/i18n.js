"use strict";

// ============================================================
// i18n — 日本語 / 英語の切り替え
//
// 既定は日本語。選択は localStorage に保存し、`?lang=en` でも指定できる。
// ステージ定義（STAGES）と CYCLES は日本語を原本として持ち、英語は
// このファイルの STAGES_EN / CYCLES_EN で id をキーに上書きする。
// こうすることで STAGES 側は純データのまま（JSON 外出し可能）を保てる。
//
// 文字列キーは `t(key, params)` で引く。値に {name} 形式のプレースホルダを
// 置ける。未翻訳のキーは日本語にフォールバックする。
// ============================================================

const I18N = (() => {
  const KEY = "rx-pipeline-puzzle/lang";
  const SUPPORTED = ["ja", "en"];

  function detect() {
    const q = new URLSearchParams(location.search).get("lang");
    if (SUPPORTED.includes(q)) return q;
    try {
      const saved = localStorage.getItem(KEY);
      if (SUPPORTED.includes(saved)) return saved;
    } catch { /* 続行 */ }
    return "ja";
  }

  let lang = detect();

  const UI = {
    ja: {
      // --- 共通 / ヘッダー ---
      "app.stage": "ステージ",
      "app.play": "再生 / 一時停止",
      "app.rewind": "先頭に戻す",
      "app.audio": "サウンド設定",
      "audio.muteAll": "すべてミュート",
      "audio.master": "全体",
      "audio.music": "BGM",
      "audio.sfx": "効果音",
      "audio.note": "BGM は既定でオフです。スライダーを上げると再生します。",
      // --- ゲーム画面 ---
      "hint.button": "💡 ヒント",
      "hint.more": "💡 ヒント {n}/3 — もう一段",
      "hint.max": "💡 ヒント 3/3",
      "lane.input": "入力ストリーム",
      "lane.inputWith": "入力ストリーム（{label}）",
      "lane.inputA": "入力ストリーム A",
      "lane.inputB": "入力ストリーム B",
      "lane.inputALabeled": "入力 A: {label}",
      "lane.inputBLabeled": "入力 B: {label}",
      "lane.output": "現在の出力",
      "lane.goal": "正解ストリーム",
      "lane.goalSub": "これと一致させる",
      "lane.goalSpec": "スペックモード — 最初の検査後に表示",
      "lane.goalHidden": "❓ まずは説明文だけを頼りに組んでみよう。最初の検査が終わると正解が現れる。",
      "legend.match": "一致",
      "legend.extra": "余分 / 値違い",
      "legend.missing": "不足（正解のみ）",
      "legend.complete": "完了",
      "stream.empty": "(イベントなし)",
      "stream.desc": "{values} → complete",
      // --- パイプライン ---
      "pipe.title": "パイプライン",
      "pipe.titleA": "パイプライン A",
      "pipe.titleB": "パイプライン B",
      "pipe.hintA": "— A がここを流れる。青いパーツの位置でパイプライン B の出力が合流",
      "pipe.hintB": "— 合流前に B を加工（未接続なら原本のまま）",
      "pipe.addParts": "パーツを追加:",
      "pipe.count": "合計 {n} / {max} パーツ",
      "pipe.emptyA": "パーツ未接続（出力 = 入力のまま）",
      "pipe.emptyB": "パーツ未接続（B は原本のまま合流）",
      "node.combinesB": "⤵ パイプライン B と合成",
      "node.noParams": "パラメータなし",
      "node.moveLeft": "左へ移動",
      "node.moveRight": "右へ移動",
      "node.remove": "削除",
      // --- 判定バッジ ---
      "judge.checking": "検査中…",
      "judge.ok": "✔ 正解と一致",
      "judge.missing": "不足 {n}",
      "judge.extra": "余分 {n}",
      "judge.wrong": "値違い {n}",
      "judge.completeShift": "完了位置ずれ",
      "judge.terminalShift": "終端種別ずれ（✕/｜）",
      "judge.sep": " ・ ",
      // --- クリア ---
      "clear.title": "🎉 ステージクリア！",
      "clear.matched": "出力が正解ストリームと完全に一致しました。",
      "clear.all": "全ステージクリア！おつかれさまでした。",
      "clear.hideLearn": "この解説をもう表示しない",
      "clear.next": "次のステージへ",
      "clear.close": "閉じる",
      "clear.showLearnAgain": "クリア時の解説を再び表示する",
      "cycle.start": "はじめる",
      // --- ヒント本文 ---
      "hint.l1": "パーツは合計 {n} 個で解ける。まず入力と正解の「イベントの個数・値・完了位置」のどこが違うかを見比べよう。",
      "hint.l2": "使うのは: {names}{bNote}。順序とパラメータは自分で。",
      "hint.l2b": "（うち {n} 個はパイプライン B 側）",
      "hint.l3": "完全解の一例: {solution}",
      "hint.node": "{label}（{desc}）",
      "hint.l3b": "B側: {b} ／ A側: {a}",
      // --- オペレータの describe ---
      "op.map": "x {sym} {k}",
      "op.filter": "x {sym} {k}",
      "op.take": "先頭 {n} 個",
      "op.skip": "先頭 {n} 個を捨てる",
      "op.scan": "{expr}・初期 {seed}",
      "op.distinctUntilChanged": "直前と同じ値を捨てる",
      "op.takeWhile": "x {sym} {k} の間",
      "op.startWith": "t=0 に {v} を追加",
      "op.delay": "全体を +{d} ずらす",
      "op.throttleTime": "発火後 {d} の間は無視",
      "op.debounceTime": "{d} 静かになったら発火",
      "op.reduce": "{expr}・初期 {seed}",
      "op.mapTo": "すべて {v} に置き換え",
      "op.index": "値を通し番号 0,1,2,… に",
      "op.timestamp": "値を発生時刻に置き換え",
      "op.last": "完了時に最後の値を1個",
      "op.takeLast": "末尾 {n} 個",
      "op.skipLast": "末尾 {n} 個を捨てる",
      "op.elementAt": "{n} 番目だけ",
      "op.defaultIfEmpty": "空なら {v} を1個",
      "op.distinct": "一度出た値は二度と通さない",
      "op.takeUntil": "t={t} で打ち切り",
      "op.skipUntil": "t={t} から通す",
      "op.auditTime": "{d} 様子見て最新値",
      "op.merge": "B と時系列で合流",
      "op.zip": "k番目同士を {expr}",
      "op.combineLatest": "最新同士を {expr}",
      "op.withLatestFrom": "B の最新値と {expr}",
      "op.sample": "B の合図で最新値を放出",
      "op.takeUntilB": "B が来たら打ち切り",
      "op.skipUntilB": "B が来てから通す",
      "op.race": "先に値を出した方だけ",
      "op.mergeMap": "{d} 間隔×{n} 回・全並行",
      "op.concatMap": "{d} 間隔×{n} 回・順番待ち",
      "op.switchMap": "{d} 間隔×{n} 回・乗り換え",
      "op.exhaustMap": "{d} 間隔×{n} 回・展開中は無視",
      "op.catchError": "エラーを {v} に変えて正常完了",
      "op.retry": "エラー時 {n} 回まで再購読",
      "op.timeout": "無音が {d} を超えたら ✕",
      // --- ツールチップ ---
      "tip.example": "例: {desc}",
      "tip.in": "in ",
      "tip.b": "B  ",
      "tip.out": "out",
      // --- トップページ ---
      "landing.sub": "マーブル図を「読む」から「組み立てる」へ。",
      "landing.tagline": "流れてくるイベントを、関数パイプラインで組み替えるパズルゲーム。<br>コードを書く代わりに、マーブル図の上で <code>map</code> / <code>debounceTime</code> / <code>switchMap</code> の効果を試そう。",
      "landing.step1.h": "1. 観察する",
      "landing.step1.p": "入力ストリームと正解ストリームをタイムライン（マーブル図）で見比べて、何が起きればよいか考える。",
      "landing.step2.h": "2. 組み立てる",
      "landing.step2.p": "<code>map</code> / <code>filter</code> / <code>scan</code> / <code>debounceTime</code> / <code>switchMap</code> など <strong>39 種類</strong>のオペレータをつなぎ、パラメータを調整する。",
      "landing.step3.h": "3. 差分を見る",
      "landing.step3.p": "出力は即座に再計算され、正解との不足・余分・値違い・完了位置ずれが色で見える。一致すればクリア！",
      "landing.start": "ゲームをはじめる ▶",
      "landing.stats": "94 ステージ / 12 サイクル / 39 オペレータ ・ インストール不要 ・ 依存ゼロ ・ クリア時に RxJS コードを自動生成",
      "landing.resetDone": "✓ 保存データをリセットしました。最初から遊べます。",
      "landing.repo": "GitHub リポジトリ",
      "landing.concept": "コンセプト",
      "landing.contribute": "ステージを投稿する",
      "landing.resetLink": "進行状況をリセット",
      "landing.resetNote": "（クリア記録・音量設定・解説の表示設定を消します）",
      "landing.disclaimer": "ReactiveExtream は RxJS を学ぶための<strong>非公式</strong>のファンプロジェクトです。 ReactiveX / RxJS の公式プロジェクトおよびその関係者とは一切関係がありません。 オペレータの挙動は学習しやすさのため一部簡略化しています（ゲーム内で注記します）。",
      "footer.top": "トップ",
      "footer.note": "— ReactiveExtream は RxJS を学ぶための<strong>非公式</strong>のファンプロジェクトで、 ReactiveX / RxJS 公式とは関係ありません。オペレータの挙動は学習用に一部簡略化しています。",
      "lang.label": "言語",
    },

    en: {
      "app.stage": "Stage",
      "app.play": "Play / pause",
      "app.rewind": "Back to start",
      "app.audio": "Sound settings",
      "audio.muteAll": "Mute everything",
      "audio.master": "Master",
      "audio.music": "Music",
      "audio.sfx": "SFX",
      "audio.note": "Music is off by default. Raise the slider to start it.",
      "hint.button": "💡 Hint",
      "hint.more": "💡 Hint {n}/3 — one more",
      "hint.max": "💡 Hint 3/3",
      "lane.input": "Input stream",
      "lane.inputWith": "Input stream ({label})",
      "lane.inputA": "Input stream A",
      "lane.inputB": "Input stream B",
      "lane.inputALabeled": "Input A: {label}",
      "lane.inputBLabeled": "Input B: {label}",
      "lane.output": "Your output",
      "lane.goal": "Goal stream",
      "lane.goalSub": "match this",
      "lane.goalSpec": "Spec mode — shown after the first check",
      "lane.goalHidden": "❓ Build it from the description alone. The goal appears once the first check finishes.",
      "legend.match": "match",
      "legend.extra": "extra / wrong value",
      "legend.missing": "missing (goal only)",
      "legend.complete": "complete",
      "stream.empty": "(no events)",
      "stream.desc": "{values} → complete",
      "pipe.title": "Pipeline",
      "pipe.titleA": "Pipeline A",
      "pipe.titleB": "Pipeline B",
      "pipe.hintA": "— A flows through here. Pipeline B's output joins at the blue part",
      "pipe.hintB": "— shape B before it joins (untouched if empty)",
      "pipe.addParts": "Add a part:",
      "pipe.count": "{n} / {max} parts total",
      "pipe.emptyA": "No parts (output = input)",
      "pipe.emptyB": "No parts (B joins unchanged)",
      "node.combinesB": "⤵ combines with pipeline B",
      "node.noParams": "no parameters",
      "node.moveLeft": "Move left",
      "node.moveRight": "Move right",
      "node.remove": "Remove",
      "judge.checking": "checking…",
      "judge.ok": "✔ matches the goal",
      "judge.missing": "{n} missing",
      "judge.extra": "{n} extra",
      "judge.wrong": "{n} wrong value",
      "judge.completeShift": "completion misplaced",
      "judge.terminalShift": "wrong terminal (✕/｜)",
      "judge.sep": " · ",
      "clear.title": "🎉 Stage clear!",
      "clear.matched": "Your output matches the goal stream exactly.",
      "clear.all": "All stages cleared. Nicely done!",
      "clear.hideLearn": "Don't show this explanation again",
      "clear.next": "Next stage",
      "clear.close": "Close",
      "clear.showLearnAgain": "Show the post-clear explanation again",
      "cycle.start": "Start",
      "hint.l1": "It can be solved with {n} part(s) in total. Start by comparing the input and the goal: the number of events, their values, and where completion lands.",
      "hint.l2": "Use: {names}{bNote}. Order and parameters are up to you.",
      "hint.l2b": " ({n} of them on pipeline B)",
      "hint.l3": "One full solution: {solution}",
      "hint.node": "{label} ({desc})",
      "hint.l3b": "B side: {b} / A side: {a}",
      "op.map": "x {sym} {k}",
      "op.filter": "x {sym} {k}",
      "op.take": "first {n}",
      "op.skip": "drop first {n}",
      "op.scan": "{expr}, seed {seed}",
      "op.distinctUntilChanged": "drop repeats of the previous value",
      "op.takeWhile": "while x {sym} {k}",
      "op.startWith": "prepend {v} at t=0",
      "op.delay": "shift everything by +{d}",
      "op.throttleTime": "ignore for {d} after firing",
      "op.debounceTime": "fire after {d} of silence",
      "op.reduce": "{expr}, seed {seed}",
      "op.mapTo": "replace every value with {v}",
      "op.index": "value → running index 0,1,2,…",
      "op.timestamp": "value → its own timestamp",
      "op.last": "last value once, at completion",
      "op.takeLast": "last {n}",
      "op.skipLast": "drop last {n}",
      "op.elementAt": "only #{n}",
      "op.defaultIfEmpty": "if empty, emit {v}",
      "op.distinct": "never repeat a value already seen",
      "op.takeUntil": "cut off at t={t}",
      "op.skipUntil": "pass from t={t}",
      "op.auditTime": "watch {d}, then latest",
      "op.merge": "interleave with B",
      "op.zip": "pair k-th with k-th: {expr}",
      "op.combineLatest": "latest of each: {expr}",
      "op.withLatestFrom": "with B's latest: {expr}",
      "op.sample": "emit latest on B's cue",
      "op.takeUntilB": "cut off when B fires",
      "op.skipUntilB": "pass once B has fired",
      "op.race": "keep whichever emits first",
      "op.mergeMap": "{n}× every {d}, all in parallel",
      "op.concatMap": "{n}× every {d}, queued",
      "op.switchMap": "{n}× every {d}, switch over",
      "op.exhaustMap": "{n}× every {d}, ignore while busy",
      "op.catchError": "turn the error into {v} and complete",
      "op.retry": "resubscribe up to {n}× on error",
      "op.timeout": "✕ if silence exceeds {d}",
      "tip.example": "e.g. {desc}",
      "tip.in": "in ",
      "tip.b": "B  ",
      "tip.out": "out",
      "landing.sub": "From reading marble diagrams to building them.",
      "landing.tagline": "A puzzle game where you rebuild streams of events with a pipeline of functions.<br>Instead of writing code, try out <code>map</code> / <code>debounceTime</code> / <code>switchMap</code> right on the marble diagram.",
      "landing.step1.h": "1. Observe",
      "landing.step1.p": "Compare the input stream and the goal stream on the timeline (a marble diagram) and work out what has to happen.",
      "landing.step2.h": "2. Build",
      "landing.step2.p": "Chain <strong>39 operators</strong> — <code>map</code>, <code>filter</code>, <code>scan</code>, <code>debounceTime</code>, <code>switchMap</code> and more — then tune their parameters.",
      "landing.step3.h": "3. Read the diff",
      "landing.step3.p": "Your output is recomputed instantly, and anything missing, extra, wrong-valued or mis-completed shows up in colour. Match the goal to clear the stage.",
      "landing.start": "Start the game ▶",
      "landing.stats": "94 stages / 12 cycles / 39 operators · no install · zero dependencies · your solution becomes real RxJS code",
      "landing.resetDone": "✓ Saved data cleared. You can start over.",
      "landing.repo": "GitHub repository",
      "landing.concept": "Concept",
      "landing.contribute": "Contribute a stage",
      "landing.resetLink": "Reset progress",
      "landing.resetNote": " (clears cleared-stage records, volume settings and explanation preferences)",
      "landing.disclaimer": "ReactiveExtream is an <strong>unofficial</strong> fan project for learning RxJS. It is not affiliated with the ReactiveX / RxJS projects or their maintainers in any way. Some operator behaviour is simplified for teaching purposes (noted inside the game).",
      "footer.top": "Home",
      "footer.note": "— ReactiveExtream is an <strong>unofficial</strong> fan project for learning RxJS, not affiliated with ReactiveX / RxJS. Some operator behaviour is simplified for teaching.",
      "lang.label": "Language",
    },
  };

  // {name} を params で置換する
  function format(str, params) {
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
  }

  function t(key, params) {
    const dict = UI[lang] ?? UI.ja;
    const str = dict[key] ?? UI.ja[key] ?? key;
    return format(str, params);
  }

  function set(next) {
    if (!SUPPORTED.includes(next)) return;
    lang = next;
    try { localStorage.setItem(KEY, next); } catch { /* 続行 */ }
    document.documentElement.lang = next;
  }

  // ステージ / サイクルの翻訳を引く。未翻訳なら日本語の原本を返す
  function stage(stageObj, field) {
    if (lang === "ja") return stageObj[field];
    return I18N_STAGES_EN[stageObj.id]?.[field] ?? stageObj[field];
  }

  function cycle(cycleObj, index, field) {
    if (lang === "ja") return cycleObj[field];
    return I18N_CYCLES_EN[index]?.[field] ?? cycleObj[field];
  }

  function opDoc(type) {
    if (lang === "ja") return null; // 呼び出し側の日本語辞書を使う
    return I18N_OPDOCS_EN[type] ?? null;
  }

  function rxNote(type) {
    if (lang === "ja") return null;
    return I18N_RXNOTES_EN[type] ?? null;
  }

  // HTML 側の data-i18n / data-i18n-title / data-i18n-html を差し替える。
  // 原文（日本語）はマークアップに書いたままにしておき、ここで上書きする
  // ことで、JS が動かない環境でも日本語では読める状態を保つ。
  function applyStatic(root = document) {
    for (const el of root.querySelectorAll("[data-i18n]")) {
      el.textContent = t(el.dataset.i18n);
    }
    for (const el of root.querySelectorAll("[data-i18n-html]")) {
      el.innerHTML = t(el.dataset.i18nHtml);
    }
    for (const el of root.querySelectorAll("[data-i18n-title]")) {
      el.title = t(el.dataset.i18nTitle);
    }
  }

  // 起動時に <html lang> を合わせる
  document.documentElement.lang = lang;

  return {
    t,
    set,
    get: () => lang,
    stage,
    cycle,
    opDoc,
    rxNote,
    applyStatic,
    supported: SUPPORTED,
  };
})();

const t = (key, params) => I18N.t(key, params);
