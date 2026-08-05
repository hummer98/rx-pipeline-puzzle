/*
 * 計測コレクタ（Cloudflare Workers + D1）
 * =========================================
 * hummer98.dev の2つの面から送られるイベントを1つの D1 に貯める。
 *
 *   site="game" : https://hummer98.dev/rx-pipeline-puzzle/  （ReactiveExtream）
 *   site="site" : https://hummer98.dev/                     （受注窓口）
 *
 * 保存しないもの: IP アドレス / User-Agent 文字列 / Cookie / 個人識別子。
 * 保存するのは「どの面で・何が起きたか」と、粗い文脈（流入元ホスト・国・端末種別・言語）だけ。
 * 何をなぜ測るかは docs/metrics.md を参照。
 */

// 受け付けるイベント名。ここに無い名前は捨てる（未知の名前でテーブルが汚れるのを防ぐ）
const ALLOWED = new Set([
  "pageview",
  "play",
  "stage-clear",
  "progress",
  "all-clear",
  "cycle-reach",
  "hint",
  "outbound", // ゲーム → hummer98.dev の遷移
  "contact", // 受注窓口の問い合わせクリック（実質のコンバージョン）
]);

const ALLOWED_ORIGINS = new Set([
  "https://hummer98.dev",
  "https://www.hummer98.dev",
]);

const BOT = /bot|crawler|spider|crawling|preview|slurp|headless|monitor|curl|wget/i;

function cors(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://hummer98.dev";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** 流入元は「ホスト名だけ」に落とす。クエリ付き URL は個人を特定しうるので保存しない。 */
function refHost(ref) {
  if (!ref) return null;
  try {
    return new URL(ref).hostname.slice(0, 80);
  } catch {
    return null;
  }
}

/** 長すぎる・制御文字を含むパスを弾いて切り詰める。 */
function clean(s, max) {
  if (typeof s !== "string") return null;
  const t = s.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return t ? t.slice(0, max) : null;
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    // 収集口以外は素っ気なく返す（データは一切出さない）
    if (url.pathname !== "/e") {
      return new Response("rx-metrics collector\n", {
        status: request.method === "GET" ? 200 : 405,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: cors(origin) });
    }

    // 自分のサイト以外からの送信は受けない
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return new Response(null, { status: 403, headers: cors(origin) });
    }

    const ua = request.headers.get("User-Agent") || "";
    // ボットは 204 を返して黙って捨てる（エラーにすると再送してくる）
    if (BOT.test(ua)) {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    let body;
    try {
      const raw = await request.text();
      if (raw.length > 2048) throw new Error("too large");
      body = JSON.parse(raw);
    } catch {
      return new Response(null, { status: 400, headers: cors(origin) });
    }

    const name = clean(body.name, 40);
    if (!name || !ALLOWED.has(name)) {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    const now = new Date();
    const row = {
      ts: now.getTime(),
      day: now.toISOString().slice(0, 10),
      site: body.site === "site" ? "site" : "game",
      name,
      path: clean(body.path, 120) || "/",
      ref: refHost(body.ref),
      country: request.cf?.country || null,
      device: /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop",
      lang: clean(body.lang, 5),
    };

    // 応答は待たせない。書き込みは waitUntil で裏に回す。
    ctx.waitUntil(
      env.DB.prepare(
        "INSERT INTO events (ts, day, site, name, path, ref, country, device, lang) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(row.ts, row.day, row.site, row.name, row.path, row.ref, row.country, row.device, row.lang)
        .run()
        .catch(() => {
          /* 計測の失敗でサイト側に影響を出さない */
        })
    );

    return new Response(null, { status: 204, headers: cors(origin) });
  },
};
