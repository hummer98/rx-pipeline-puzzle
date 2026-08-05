// ReactiveExtream 用の効果音・BGM を ElevenLabs API で生成する。
//
//   node tools/gen-audio.mjs            # 未生成のものだけ生成
//   node tools/gen-audio.mjs --force    # 全部作り直す
//   node tools/gen-audio.mjs judge-ok   # 指定した id だけ作り直す（気に入らなかった音の再生成）
//
// API キーは .env の ELEVENLABS_API_KEY、なければ macOS キーチェーンから読む。
// 生成後は ffmpeg で無音のトリムとラウドネス揃えを行う（audio-design の原則）。

import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "prototype/assets/audio");

// ---------------------------------------------------------------
// 生成対象
// ---------------------------------------------------------------

// UI 効果音。duration は「余韻を含めた尺」で、後段で無音をトリムする。
const SFX = [
  {
    id: "part-add",
    duration: 0.6,
    prompt: "Single very short soft UI click confirming an action, gentle wooden marimba tap with a tiny bright overtone, clean and dry, no reverb, minimal modern app interface sound",
  },
  {
    id: "part-remove",
    duration: 0.6,
    prompt: "Single very short muted UI click for removing an item, low soft wooden thunk, damped and dry, no reverb, subtle minimal app interface sound",
  },
  {
    id: "param-change",
    duration: 0.8,
    prompt: "Short quiet UI tick for adjusting a numeric value, small soft muted wood block knock with a short natural decay, dry and warm, subtle minimal interface feedback",
  },
  {
    id: "sweep-start",
    duration: 0.6,
    prompt: "Very short soft synth blip signalling a scan starting, gentle short upward glide, clean and airy, quiet and unobtrusive, minimal interface sound",
  },
  {
    id: "judge-ok",
    duration: 1.0,
    prompt: "Short bright positive confirmation chime, two clean ascending bell tones, glassy and warm, gentle decay, puzzle game success feedback, no reverb tail",
  },
  {
    id: "judge-ng",
    duration: 0.8,
    prompt: "Short soft negative feedback tone for a wrong answer, low gentle muted double thud, not harsh or alarming, warm and quiet, puzzle game mistake sound",
  },
  {
    id: "error-x",
    duration: 0.8,
    prompt: "Short glitchy digital error blip, brief low buzzy square wave stutter, dry and clean, retro computer error feedback, not harsh",
  },
  {
    id: "stage-select",
    duration: 0.6,
    prompt: "Very short soft UI swipe for switching pages, gentle airy whoosh, quiet and smooth, minimal interface transition sound",
  },
  {
    id: "cycle-card",
    duration: 1.4,
    prompt: "Short gentle reveal sound for a new chapter card, soft airy rising whoosh followed by a single warm bell, clean and calm, no harsh transient",
  },
  {
    id: "stage-clear",
    duration: 2.2,
    prompt: "Short cheerful puzzle solved fanfare, clean ascending marimba and glassy bell arpeggio, warm and satisfying, light and not orchestral, gentle ending",
  },
  {
    id: "all-clear",
    duration: 3.5,
    prompt: "Triumphant but gentle game completion fanfare, warm marimba and bell melody rising with soft chimes and a bright final chord, celebratory yet calm, lo-fi and clean",
  },
];

// BGM。ループ用は intro/outro を持たない均質なトラックを狙う。
const MUSIC = [
  {
    id: "bgm-main",
    lengthMs: 60000,
    prompt:
      "Calm minimal lo-fi puzzle game background music for deep focus. Warm mellow electric piano and soft marimba on a gentle steady beat, mellow bass, subtle vinyl texture, no vocals, no dramatic changes, consistent from start to end so it can loop seamlessly. Relaxed, thoughtful, unobtrusive.",
  },
];

// ---------------------------------------------------------------

function apiKey() {
  const envPath = join(ROOT, ".env");
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, "utf8").match(/^ELEVENLABS_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  return execFileSync("security", ["find-generic-password", "-s", "elevenlabs-api-key", "-w"])
    .toString().trim();
}

async function post(path, body, key) {
  const res = await fetch(`https://api.elevenlabs.io/v1/${path}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

// 生成直後の raw を assets/audio/raw/ に残す。ポリッシュをやり直したいときに
// API を再度叩かずに済ませるため（loudnorm の二重適用も避けられる）。
function keepRaw(id, buf) {
  const rawDir = join(OUT_DIR, "raw");
  mkdirSync(rawDir, { recursive: true });
  writeFileSync(join(rawDir, `${id}.mp3`), buf);
}

// 先頭・末尾の無音を落とし、ラウドネスを揃え、最後にリミッタでクリップを防ぐ。
// loudnorm の TP 指定は単一パスだと超過することがあるため alimiter を併用する。
function polishSfx(file) {
  const tmp = file.replace(/\.mp3$/, ".tmp.mp3");
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", file,
    "-af", [
      "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.01",
      "areverse",
      "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02",
      "areverse",
      "loudnorm=I=-16:TP=-1.5:LRA=11",
      "alimiter=limit=0.84:level=disabled", // ≈ -1.5 dBFS で頭打ちにする
    ].join(","),
    "-codec:a", "libmp3lame", "-b:a", "128k", "-ar", "44100", "-ac", "1", tmp,
  ]);
  execFileSync("mv", [tmp, file]);
}

// BGM はモノラル化せず、ラウドネスのみ揃える。
function polishMusic(file) {
  const tmp = file.replace(/\.mp3$/, ".tmp.mp3");
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", file,
    "-af", "loudnorm=I=-18:TP=-2:LRA=9,alimiter=limit=0.79:level=disabled",
    "-codec:a", "libmp3lame", "-b:a", "128k", "-ar", "44100", tmp,
  ]);
  execFileSync("mv", [tmp, file]);
}

function info(file) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration,size", "-of", "json", file,
  ]).toString();
  const f = JSON.parse(out).format;
  return { sec: Number(f.duration).toFixed(2), kb: Math.round(Number(f.size) / 1024) };
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));

mkdirSync(OUT_DIR, { recursive: true });
const key = apiKey();
let spent = 0;

for (const s of SFX) {
  if (only.length && !only.includes(s.id)) continue;
  const file = join(OUT_DIR, `${s.id}.mp3`);
  if (!force && !only.length && existsSync(file)) {
    console.log(`skip  ${s.id} (exists)`);
    continue;
  }
  process.stdout.write(`gen   ${s.id} ... `);
  const buf = await post("sound-generation", {
    text: s.prompt,
    duration_seconds: s.duration,
    prompt_influence: 0.45,
  }, key);
  keepRaw(s.id, buf);
  writeFileSync(file, buf);
  polishSfx(file);
  spent += 0.12;
  const i = info(file);
  console.log(`${i.sec}s ${i.kb}KB`);
}

for (const m of MUSIC) {
  if (only.length && !only.includes(m.id)) continue;
  const file = join(OUT_DIR, `${m.id}.mp3`);
  if (!force && !only.length && existsSync(file)) {
    console.log(`skip  ${m.id} (exists)`);
    continue;
  }
  process.stdout.write(`gen   ${m.id} ... `);
  const buf = await post("music", {
    prompt: m.prompt,
    music_length_ms: m.lengthMs,
    model_id: "music_v2",
  }, key);
  keepRaw(m.id, buf);
  writeFileSync(file, buf);
  polishMusic(file);
  spent += (m.lengthMs / 60000) * 0.30;
  const i = info(file);
  console.log(`${i.sec}s ${i.kb}KB`);
}

console.log(`\nestimated cost this run: $${spent.toFixed(2)}`);
