/*
 * 自前資産の URL にバージョンを付ける
 * ====================================
 * GitHub Pages は max-age=600 を返すので、デプロイ直後の 10 分間は
 * ブラウザが古い JS/CSS を掴んだままになる。単に「反映が遅い」だけでなく、
 * **新しい app.js と古い i18n.js が混ざる**ような組み合わせが起きうる。
 *
 * HTML から参照する自前ファイルに ?v=<コミット SHA> を付けて、
 * デプロイ単位で URL が変わるようにする。HTML 自体のキャッシュは残るが、
 * HTML が更新された時点で資産一式が正しい組で読み込まれる。
 *
 * 使い方: node tools/stamp-assets.mjs <サイトのディレクトリ> <バージョン>
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? "_site";
const version = (process.argv[3] ?? "dev").slice(0, 12);

/** 対象は同梱の js/css のみ。外部 URL・画像・音源には触らない。 */
const TARGET = /\b(src|href)="((?:\.\.\/)?[\w./-]+\.(?:js|css))"/g;

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith(".html") ? [path] : [];
  });
}

let stamped = 0;
for (const file of htmlFiles(root)) {
  const html = readFileSync(file, "utf8");
  const next = html.replace(TARGET, (whole, attr, url) => {
    if (url.includes("?")) return whole;
    stamped += 1;
    return `${attr}="${url}?v=${version}"`;
  });
  if (next !== html) writeFileSync(file, next);
}
console.log(`stamped ${stamped} asset refs with v=${version}`);
