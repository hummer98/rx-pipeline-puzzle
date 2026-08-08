/*
 * 英語ページ（/en/）を生成する
 * ================================
 * ゲーム本体は 1 セットしか持たず、UI の言語は i18n.js が切り替える。
 * ただし `?lang=en` のままだと検索にも SNS カードにも英語版が存在しない
 * （canonical が日本語ページを指し、OG は日本語のまま。クローラは JS を
 * 実行しないので切り替えも効かない）。
 *
 * そこで /en/ に「head だけ英語に差し替えた薄いコピー」を置く。
 * 中身のスクリプトと CSS は 1 つ上の階層を参照するので、資産は二重に
 * ならない。ページが <html lang="en"> を宣言していれば i18n.js が
 * それを既定言語として拾う（i18n.js の detect() 参照）。
 *
 * 使い方: node tools/build-en.mjs <出力先ディレクトリ>
 *   例) node tools/build-en.mjs _site
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SRC = "prototype";
const BASE = "https://hummer98.dev/rx-pipeline-puzzle";
const outRoot = process.argv[2] ?? "_site";
const outDir = join(outRoot, "en");

/** 英語ページ側の head 情報。日本語版の該当タグを丸ごと差し替える。 */
const PAGES = {
  "index.html": {
    canonical: `${BASE}/en/`,
    title: "ReactiveExtream — Learn RxJS operators as a puzzle",
    description:
      "Learn the 39 stream operators of RxJS / ReactiveX by building marble diagrams. 94 stages, 12 cycles, no install, zero dependencies.",
    ogTitle: "ReactiveExtream — Learn RxJS operators as a puzzle",
    ogDescription:
      "map / debounceTime / switchMap … build marble diagrams across 94 stages and learn 39 RxJS operators. Runs in the browser.",
    twitterTitle: "ReactiveExtream — Learn RxJS operators as a puzzle",
    twitterDescription:
      "39 RxJS operators across 94 stages. From reading marble diagrams to building them.",
  },
  "game.html": {
    canonical: `${BASE}/en/game.html`,
    title: "ReactiveExtream — RxJS operator puzzle (marble diagram)",
    description:
      "Build 39 RxJS / ReactiveX operators on a marble diagram across 94 stages. Clear a stage and your pipeline is generated as real RxJS code.",
    ogTitle: "ReactiveExtream — RxJS operator puzzle",
    ogDescription:
      "Build marble diagrams to learn 39 RxJS operators. 94 stages, playable in the browser.",
  },
};

/** 属性値が同ディレクトリの資産を指しているなら 1 つ上を見るように直す。 */
function liftRelativePaths(html) {
  const keepInEn = new Set(["index.html", "game.html"]);
  return html.replace(/\b(href|src)="([^":?#][^":]*)"/g, (whole, attr, value) => {
    if (/^(https?:|\/\/|\/|#|mailto:|data:)/.test(value)) return whole;
    if (keepInEn.has(value.split("?")[0])) return whole; // /en/ 内の行き来はそのまま
    return `${attr}="../${value}"`;
  });
}

function replaceTag(html, pattern, replacement) {
  if (!pattern.test(html)) throw new Error(`タグが見つかりません: ${pattern}`);
  return html.replace(pattern, replacement);
}

function buildEnglish(file, meta) {
  let html = readFileSync(join(SRC, file), "utf8");

  html = html.replace('<html lang="ja">', '<html lang="en">');
  html = liftRelativePaths(html);

  html = replaceTag(html, /<title>[^<]*<\/title>/, `<title>${meta.title}</title>`);
  html = replaceTag(
    html,
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${meta.description}">`,
  );
  html = replaceTag(
    html,
    /<link rel="canonical" href="[^"]*">/,
    `<link rel="canonical" href="${meta.canonical}">`,
  );
  html = replaceTag(
    html,
    /<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${meta.ogTitle}">`,
  );
  html = replaceTag(
    html,
    /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${meta.ogDescription}">`,
  );
  html = replaceTag(
    html,
    /<meta property="og:url" content="[^"]*">/,
    `<meta property="og:url" content="${meta.canonical}">`,
  );
  html = html.replace(
    /<meta property="og:locale" content="[^"]*">/,
    '<meta property="og:locale" content="en_US">',
  );
  if (meta.twitterTitle) {
    html = html.replace(
      /<meta name="twitter:title" content="[^"]*">/,
      `<meta name="twitter:title" content="${meta.twitterTitle}">`,
    );
    html = html.replace(
      /<meta name="twitter:description" content="[^"]*">/,
      `<meta name="twitter:description" content="${meta.twitterDescription}">`,
    );
  }

  return html;
}

mkdirSync(outDir, { recursive: true });
for (const [file, meta] of Object.entries(PAGES)) {
  const html = buildEnglish(file, meta);
  writeFileSync(join(outDir, file), html);
  console.log(`generated ${join(outDir, file)}`);
}
