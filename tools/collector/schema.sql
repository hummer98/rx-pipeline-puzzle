-- ReactiveExtream / hummer98.dev 計測コレクタ
-- 1 イベント 1 行。Cookie も個人識別子も IP も保存しない。
-- 設計の意図は docs/metrics.md を参照。

CREATE TABLE IF NOT EXISTS events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,          -- 受信時刻（epoch ミリ秒・サーバ側で打つ）
  day      TEXT    NOT NULL,          -- "2026-08-05"（集計を速くするため冗長に持つ）
  site     TEXT    NOT NULL,          -- "game" | "site"（どちらの面か）
  name     TEXT    NOT NULL,          -- pageview / play / stage-clear / outbound ...
  path     TEXT    NOT NULL,          -- 仮想パス（/e/stage-clear/stage-07）または実パス
  ref      TEXT,                      -- 流入元ホストのみ（zenn.dev / news.ycombinator.com）
  country  TEXT,                      -- request.cf.country（国コードのみ）
  device   TEXT,                      -- mobile | desktop
  lang     TEXT                       -- ja | en
);

CREATE INDEX IF NOT EXISTS idx_events_day  ON events (day);
CREATE INDEX IF NOT EXISTS idx_events_name ON events (name, day);
CREATE INDEX IF NOT EXISTS idx_events_path ON events (path);
