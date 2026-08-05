-- 定型クエリ集
-- 使い方:
--   npx wrangler d1 execute rx-metrics --remote --command "<下のSQLを1本>"
-- Cloudflare ダッシュボードの D1 コンソールでも同じものが打てる。

-- 1) 直近7日の全体像（面ごと・イベントごと）
SELECT day, site, name, COUNT(*) AS n
FROM events
WHERE day >= date('now', '-7 day')
GROUP BY day, site, name
ORDER BY day DESC, n DESC;

-- 2) プレイ率 — 最重要。ゲーム画面を開いた人のうち、実際にパーツを置いた割合。
--    30% を切っていたら、記事を書くより入口を直すのが先（docs/metrics.md 参照）。
SELECT
  SUM(name = 'pageview' AND path LIKE '%game.html%') AS game_pv,
  SUM(name = 'play')                                  AS plays,
  ROUND(100.0 * SUM(name = 'play') / NULLIF(SUM(name = 'pageview' AND path LIKE '%game.html%'), 0), 1) AS play_rate_pct
FROM events
WHERE site = 'game' AND day >= date('now', '-30 day');

-- 3) 難易度の壁 — ステージ別の初回クリア人数。急に落ちる場所が壁。
SELECT path, COUNT(*) AS cleared
FROM events
WHERE name = 'stage-clear' AND day >= date('now', '-30 day')
GROUP BY path
ORDER BY CAST(REPLACE(path, '/e/stage-clear/stage-', '') AS INTEGER);

-- 4) 継続の深さ — マイルストーン到達数（8 = サイクル1完走）
SELECT path, COUNT(*) AS n FROM events
WHERE name IN ('progress', 'all-clear') GROUP BY path ORDER BY n DESC;

-- 5) 流入元（どこから来たか）。自ドメインは除く。
SELECT ref, COUNT(*) AS n
FROM events
WHERE name = 'pageview' AND ref IS NOT NULL AND ref NOT LIKE '%hummer98.dev'
GROUP BY ref ORDER BY n DESC LIMIT 20;

-- 6) ファネル — ゲームから受注窓口まで通しで見る。
--    outbound（ゲームの CTA クリック）→ site の pageview → contact（mailto クリック）
SELECT
  SUM(site = 'game' AND name = 'pageview') AS game_pv,
  SUM(site = 'game' AND name = 'play')     AS plays,
  SUM(name = 'outbound')                   AS outbound,
  SUM(site = 'site' AND name = 'pageview') AS site_pv,
  SUM(name = 'contact')                    AS contact
FROM events
WHERE day >= date('now', '-30 day');

-- 7) 日本語 / 英語の比率と国別（英語版に意味があるかの判定材料）
SELECT lang, country, COUNT(*) AS n
FROM events
WHERE name = 'pageview' AND day >= date('now', '-30 day')
GROUP BY lang, country ORDER BY n DESC LIMIT 20;

-- 8) 端末種別（スマホ比率。SNS 流入が増えると上がる）
SELECT device, COUNT(*) AS n FROM events
WHERE name = 'pageview' GROUP BY device;

-- 9) 掃除用: 自分のテスト行を消す
-- DELETE FROM events WHERE path = '/__selftest';
