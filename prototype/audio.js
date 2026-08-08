"use strict";

// ============================================================
// GameAudio — バス構成のオーディオエンジン
//
// バス: Master ← { Music, Sfx }
//   - 音量スライダー(0..1)は dB カーブに変換して適用する（知覚が対数的なため）
//   - 効果音は再生ごとに微小なピッチ揺らぎを与え、連打時の機械的な反復を防ぐ
//   - ファンファーレ中は Music を一時的に下げる（ダッキング）
//
// 再生経路は 2 系統。file:// では fetch がブロックされ decodeAudioData が使えない
// ため、HTMLAudioElement による再生にフォールバックする。どちらの経路でも
// 音量・ピッチ揺らぎ・ダッキングは同じ挙動になるようにしている。
//   - "webaudio": http(s) 配信時。GainNode でバスを組む
//   - "element" : file:// で開いたとき。要素の volume / playbackRate で代替
//
// 設定は localStorage に保存。BGM・効果音とも既定オン。BGM は効果音より十分下げた
// 音量から始め、ヘッダーのスピーカーボタンで調整・ミュートできる。
// ============================================================

const GameAudio = (() => {
  const SETTINGS_KEY = "rx-pipeline-puzzle/audio";
  // 音源はドキュメントではなく「このスクリプトの位置」を基準に解決する。
  // /en/ の薄いコピーから ../audio.js を読み込んでも取り違えないため。
  const BASE = (() => {
    const self = document.currentScript?.src;
    return self ? new URL("assets/audio/", self).href : "assets/audio/";
  })();

  const SFX_IDS = [
    "part-add", "part-remove", "param-change", "sweep-start",
    "judge-ok", "judge-ng", "error-x", "stage-select",
    "cycle-card", "stage-clear", "all-clear",
  ];

  // 個別のトリム値（dB）。生成物ごとの体感差を吸収する
  const SFX_TRIM_DB = {
    "judge-ok": -2,
    "judge-ng": -2,
    "part-remove": -3,
    "stage-clear": -1,
    "all-clear": -1,
  };

  const defaults = { master: 0.8, music: 0.6, sfx: 0.8, muted: false };
  let settings = load();

  let mode = "idle";           // idle | webaudio | element | none
  let ctx = null;
  let buses = null;            // webaudio: { master, music, sfx }
  const buffers = new Map();   // webaudio: id -> AudioBuffer
  const elements = new Map();  // element : id -> HTMLAudioElement（複製元）
  let bgmSource = null;        // webaudio: AudioBufferSourceNode
  let bgmElement = null;       // element : HTMLAudioElement
  let duckTimer = null;
  let duckFactor = 1;
  const listeners = new Set();

  function load() {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
    } catch {
      return { ...defaults };
    }
  }

  function save() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* 続行 */ }
    listeners.forEach((fn) => fn(settings));
  }

  // スライダー値(0..1) → 振幅。-40dB〜0dB を対数カーブで割り当てる
  function gainOf(v) {
    if (v <= 0) return 0;
    return Math.pow(10, (-40 * (1 - v)) / 20);
  }

  const dbToGain = (db) => Math.pow(10, db / 20);
  const pitch = (variation) => 1 + (Math.random() - 0.5) * (variation ?? 0.06);
  const musicGain = () => (settings.muted ? 0 : gainOf(settings.master) * gainOf(settings.music) * duckFactor);
  const sfxGain = (db) => (settings.muted ? 0 : gainOf(settings.master) * gainOf(settings.sfx) * dbToGain(db));

  // ---------------- 初期化 ----------------

  function createContext() {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return null;
    const c = new AC();
    buses = { master: c.createGain(), music: c.createGain(), sfx: c.createGain() };
    buses.music.connect(buses.master);
    buses.sfx.connect(buses.master);
    buses.master.connect(c.destination);
    return c;
  }

  async function loadViaWebAudio() {
    const ids = [...SFX_IDS, "bgm-main"];
    // 1本目で経路の可否が判る。失敗したら element 経路に切り替える
    const first = await fetch(`${BASE}${ids[0]}.mp3`);
    buffers.set(ids[0], await ctx.decodeAudioData(await first.arrayBuffer()));
    await Promise.all(ids.slice(1).map(async (id) => {
      try {
        const res = await fetch(`${BASE}${id}.mp3`);
        if (res.ok) buffers.set(id, await ctx.decodeAudioData(await res.arrayBuffer()));
      } catch { /* 個別の欠落は無視 */ }
    }));
  }

  function loadViaElements() {
    for (const id of [...SFX_IDS, "bgm-main"]) {
      const el = new Audio(`${BASE}${id}.mp3`);
      el.preload = "auto";
      elements.set(id, el);
    }
  }

  // 最初のユーザー操作で呼ぶ。以降は何度呼んでも安全
  async function unlock() {
    if (mode === "none") return;
    if (mode === "idle") {
      mode = "loading";
      ctx = createContext();
      if (ctx) {
        try {
          await loadViaWebAudio();
          mode = "webaudio";
        } catch {
          // file:// など fetch が使えない環境
          buffers.clear();
          try { await ctx.close(); } catch { /* 無視 */ }
          ctx = null; buses = null;
          loadViaElements();
          mode = "element";
        }
      } else {
        loadViaElements();
        mode = "element";
      }
      applyVolumes();
    }
    if (mode === "webaudio" && ctx.state === "suspended") await ctx.resume();
    if (settings.music > 0 && !settings.muted) startBgm();
  }

  function applyVolumes() {
    if (mode === "webaudio" && buses) {
      const t = ctx.currentTime;
      buses.master.gain.setTargetAtTime(settings.muted ? 0 : gainOf(settings.master), t, 0.02);
      buses.music.gain.setTargetAtTime(gainOf(settings.music) * duckFactor, t, 0.05);
      buses.sfx.gain.setTargetAtTime(gainOf(settings.sfx), t, 0.02);
    } else if (mode === "element" && bgmElement) {
      bgmElement.volume = Math.min(1, musicGain());
    }
  }

  // ---------------- 再生 ----------------

  function play(id, opts = {}) {
    if (settings.muted) return;
    const db = (SFX_TRIM_DB[id] ?? 0) + (opts.db ?? 0);
    if (mode === "webaudio" && buffers.has(id)) {
      const src = ctx.createBufferSource();
      src.buffer = buffers.get(id);
      src.playbackRate.value = pitch(opts.variation);
      const g = ctx.createGain();
      g.gain.value = dbToGain(db);
      src.connect(g).connect(buses.sfx);
      src.start();
    } else if (mode === "element" && elements.has(id)) {
      // 連続再生でも重ならないよう複製して鳴らす
      const el = elements.get(id).cloneNode();
      el.volume = Math.min(1, sfxGain(db));
      el.playbackRate = pitch(opts.variation);
      el.play().catch(() => { /* 自動再生規制などは無視 */ });
    } else {
      return;
    }
    if (opts.duck) duck(opts.duck);
  }

  // ファンファーレ等の間だけ Music を下げ、なめらかに戻す
  function duck(seconds = 2) {
    duckFactor = 0.25;
    if (mode === "webaudio" && buses) {
      const t = ctx.currentTime;
      buses.music.gain.cancelScheduledValues(t);
      buses.music.gain.setTargetAtTime(gainOf(settings.music) * duckFactor, t, 0.08);
    } else {
      applyVolumes();
    }
    clearTimeout(duckTimer);
    duckTimer = setTimeout(() => {
      duckFactor = 1;
      if (mode === "webaudio" && buses) {
        buses.music.gain.setTargetAtTime(gainOf(settings.music), ctx.currentTime, 0.4);
      } else {
        applyVolumes();
      }
    }, seconds * 1000);
  }

  function startBgm() {
    if (mode === "webaudio") {
      if (bgmSource || !buffers.has("bgm-main")) return;
      const src = ctx.createBufferSource();
      src.buffer = buffers.get("bgm-main");
      src.loop = true;
      src.connect(buses.music);
      src.start();
      bgmSource = src;
    } else if (mode === "element") {
      if (!elements.has("bgm-main")) return;
      if (!bgmElement) {
        bgmElement = elements.get("bgm-main");
        bgmElement.loop = true;
      }
      bgmElement.volume = Math.min(1, musicGain());
      bgmElement.play().catch(() => { /* 自動再生規制は無視 */ });
    }
  }

  function stopBgm() {
    if (bgmSource) {
      try { bgmSource.stop(); } catch { /* 既に停止 */ }
      bgmSource.disconnect();
      bgmSource = null;
    }
    if (bgmElement) bgmElement.pause();
  }

  function set(key, value) {
    settings[key] = value;
    save();
    applyVolumes();
    if (key === "music") {
      if (value > 0 && !settings.muted) unlock().then(startBgm);
      else stopBgm();
    }
    if (key === "muted") {
      if (value) stopBgm();
      else if (settings.music > 0) unlock().then(startBgm);
    }
  }

  return {
    unlock,
    play,
    duck,
    startBgm,
    stopBgm,
    set,
    get: () => ({ ...settings }),
    mode: () => mode,
    onChange: (fn) => listeners.add(fn),
  };
})();
