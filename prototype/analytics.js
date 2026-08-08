/*
 * ReactiveExtream — 計測アダプタ（依存ゼロ・Cookie 不使用）
 * ==========================================================
 * 何も設定しなければ完全な no-op（1 バイトも外部送信しない）。
 * 下の CONFIG に計測サービスの ID を入れた時だけ有効になる。
 *
 * 設計方針
 *   - Cookie / 個人識別子を一切使わない（同意バナー不要な構成を維持する）
 *   - 送るのは「どのページが見られたか」「どのステージまで進んだか」だけ
 *   - localhost / file:// では送らない（自分の開発が数字を汚さないように）
 *   - サービスを乗り換えてもゲーム側（app.js）は書き換え不要
 *
 * 使い方（ページ側）
 *   <script src="analytics.js"></script>   ← 他のスクリプトより先に置く
 *   RxTrack.pageview()                      ← 自動で1回呼ばれる
 *   RxTrack.event("stage-clear", { stage: "stage-07" })
 *   RxTrack.once("first-clear", "first-clear")   ← 端末で一度きり
 *
 * 計測設計（何をなぜ測るか）は docs/metrics.md を参照。
 */
(function (global) {
  "use strict";

  // ============================================================
  // CONFIG — ここだけ書き換える
  // ============================================================
  var CONFIG = {
    // "none" | "goatcounter" | "plausible" | "umami" | "cloudflare" | "endpoint"
    provider: "endpoint",

    // どちらの面から送っているか（"game" = ReactiveExtream / "site" = hummer98.dev）
    site: "game",

    // provider: "goatcounter" — https://<code>.goatcounter.com のサブドメイン部分
    goatcounterCode: "",

    // provider: "plausible" — 計測対象ドメイン（例: "hummer98.dev"）
    plausibleDomain: "",
    plausibleHost: "https://plausible.io",

    // provider: "umami" — スクリプト設置済み前提（website-id とホスト）
    umamiWebsiteId: "",
    umamiHost: "",

    // provider: "cloudflare" — Cloudflare Web Analytics のトークン
    // ※ ページビューのみ。カスタムイベント（プレイ回数等）は取れない
    cloudflareToken: "",

    // provider: "endpoint" — 自前コレクタへ JSON を POST
    // 実体は Cloudflare Workers + D1（tools/collector/）。Cookie も IP も保存しない。
    endpointUrl: "https://t.hummer98.dev/e",

    // 共通オプション
    respectDoNotTrack: true, // DNT / GPC が立っていたら送らない
    allowLocalhost: false, // true にすると localhost でも送る
    debug: false, // true で送信内容を console に出す（provider: "none" でも動く）
    maxEventsPerSession: 300, // 暴走時のストッパー
  };

  // ページ側から上書きしたい場合: <script>window.RX_ANALYTICS={provider:"..."}</script>
  if (global.RX_ANALYTICS) {
    for (var k in global.RX_ANALYTICS) {
      if (Object.prototype.hasOwnProperty.call(global.RX_ANALYTICS, k)) {
        CONFIG[k] = global.RX_ANALYTICS[k];
      }
    }
  }

  // ============================================================
  // 有効判定
  // ============================================================
  var nav = global.navigator || {};
  var loc = global.location || { protocol: "", hostname: "", pathname: "" };

  function doNotTrack() {
    if (!CONFIG.respectDoNotTrack) return false;
    return (
      nav.doNotTrack === "1" ||
      nav.globalPrivacyControl === true ||
      global.doNotTrack === "1"
    );
  }

  function isLocal() {
    if (CONFIG.allowLocalhost) return false;
    if (loc.protocol === "file:") return true;
    return /^(localhost|127\.0\.0\.1|\[::1\]|.*\.local)$/.test(loc.hostname || "");
  }

  var sent = 0;
  var enabled = CONFIG.provider !== "none" && !doNotTrack() && !isLocal();

  function log() {
    if (!CONFIG.debug) return;
    var args = ["[RxTrack]"].concat(Array.prototype.slice.call(arguments));
    (console.debug || console.log).apply(console, args);
  }

  // ============================================================
  // 端末ローカルの重複抑止（送信するのはフラグではなく「初回だけのイベント」）
  // ============================================================
  var ONCE_PREFIX = "rx-pipeline-puzzle/tracked/";

  function store(scope) {
    try {
      return scope === "session" ? global.sessionStorage : global.localStorage;
    } catch (e) {
      return null; // Safari のプライベートモード等
    }
  }

  function seen(key, scope) {
    var s = store(scope);
    if (!s) return false; // ストレージが使えないときは重複を許して送る
    try {
      if (s.getItem(ONCE_PREFIX + key)) return true;
      s.setItem(ONCE_PREFIX + key, "1");
      return false;
    } catch (e) {
      return false;
    }
  }

  // ============================================================
  // 送信 — プロバイダ別
  // ============================================================
  // GET で 1x1 gif を取りにいく方式。sendBeacon は必ず POST になるので使わない。
  function pixel(url) {
    var img = new Image();
    img.referrerPolicy = "no-referrer-when-downgrade";
    img.src = url;
  }

  function postJson(url, body) {
    try {
      if (nav.sendBeacon) {
        var blob = new Blob([JSON.stringify(body)], { type: "application/json" });
        if (nav.sendBeacon(url, blob)) return;
      }
    } catch (e) {
      /* fallthrough */
    }
    try {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
        mode: "cors",
      }).catch(function () {});
    } catch (e) {
      /* 送れなくてもゲームは続行 */
    }
  }

  // GoatCounter: イベントもパスとして記録される（e=true）
  function sendGoatcounter(path, title, isEvent) {
    var base = "https://" + CONFIG.goatcounterCode + ".goatcounter.com/count";
    var q =
      "?p=" +
      encodeURIComponent(path) +
      "&t=" +
      encodeURIComponent(title || "") +
      "&r=" +
      encodeURIComponent(document.referrer || "");
    if (isEvent) q += "&e=true";
    pixel(base + q);
  }

  function sendPlausible(name, props, path) {
    postJson(CONFIG.plausibleHost + "/api/event", {
      name: name,
      domain: CONFIG.plausibleDomain,
      url: loc.origin + path,
      referrer: document.referrer || null,
      props: props || {},
    });
  }

  function sendUmami(name, props, path) {
    postJson(CONFIG.umamiHost + "/api/send", {
      type: "event",
      payload: {
        website: CONFIG.umamiWebsiteId,
        hostname: loc.hostname,
        url: path,
        referrer: document.referrer || "",
        title: document.title,
        name: name === "pageview" ? undefined : name,
        data: props || {},
      },
    });
  }

  function sendEndpoint(name, props, path) {
    postJson(CONFIG.endpointUrl, {
      name: name,
      path: path,
      props: props || {},
      site: CONFIG.site || "game",
      // 流入元。コレクタ側でホスト名だけに落として保存する
      ref: document.referrer || "",
      lang: (document.documentElement.lang || "").slice(0, 2),
      ts: new Date().toISOString(),
    });
  }

  // Cloudflare Web Analytics は beacon スクリプトを1本挿すだけ（PV のみ）
  function installCloudflare() {
    var s = document.createElement("script");
    s.defer = true;
    s.src = "https://static.cloudflareinsights.com/beacon.min.js";
    s.setAttribute("data-cf-beacon", JSON.stringify({ token: CONFIG.cloudflareToken }));
    document.head.appendChild(s);
  }

  // ============================================================
  // 公開 API
  // ============================================================
  function dispatch(name, props, pathOverride) {
    if (sent >= CONFIG.maxEventsPerSession) return;
    sent++;

    var path = pathOverride || eventPath(name, props);
    log(name, props, "->", path);
    if (!enabled) return;

    switch (CONFIG.provider) {
      case "goatcounter":
        sendGoatcounter(path, name === "pageview" ? document.title : name, name !== "pageview");
        break;
      case "plausible":
        sendPlausible(name, props, path);
        break;
      case "umami":
        sendUmami(name, props, path);
        break;
      case "endpoint":
        sendEndpoint(name, props, path);
        break;
      case "cloudflare":
        // PV のみ。イベントは捨てる（記録したいなら別プロバイダへ）
        break;
    }
  }

  // イベントを「仮想パス」に落とす。パス単位でしか集計できないサービス
  // （GoatCounter / Cloudflare）でもファネルが読めるようにするため。
  function eventPath(name, props) {
    if (name === "pageview") return loc.pathname + loc.search;
    var p = "/e/" + name;
    if (props) {
      var order = ["stage", "cycle", "count", "level", "to"];
      for (var i = 0; i < order.length; i++) {
        var v = props[order[i]];
        if (v !== undefined && v !== null && v !== "") p += "/" + String(v);
      }
    }
    return p;
  }

  var RxTrack = {
    /** ページビュー。ページ読み込み時に自動で1回呼ばれる。 */
    pageview: function (path) {
      dispatch("pageview", null, path || loc.pathname + loc.search);
    },

    /** 任意のイベント。props は少数の低カーディナリティな値だけにする。 */
    event: function (name, props) {
      dispatch(name, props || null);
    },

    /**
     * 端末で一度きりのイベント（初回クリア等）。
     * scope: "local"（既定・端末で一度）/ "session"（タブで一度）
     */
    once: function (key, name, props, scope) {
      if (seen(key, scope || "local")) return false;
      dispatch(name, props || null);
      return true;
    },

    /** 有効かどうか（デバッグ用） */
    isEnabled: function () {
      return enabled;
    },

    config: CONFIG,
  };

  global.RxTrack = RxTrack;

  // 自動初期化
  if (enabled && CONFIG.provider === "cloudflare") installCloudflare();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      RxTrack.pageview();
    });
  } else {
    RxTrack.pageview();
  }

  // 出口リンク（data-outbound="hummer98" など）のクリックを記録する。
  // 送信は fetch(keepalive) なので、遷移が始まっても最後まで届く。
  document.addEventListener("click", function (ev) {
    var node = ev.target;
    while (node && node.nodeType === 1) {
      if (node.hasAttribute("data-outbound")) {
        RxTrack.event("outbound", { to: node.getAttribute("data-outbound") });
        return;
      }
      node = node.parentNode;
    }
  }, true);
})(window);
