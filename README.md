<div align="center">

<img src="prototype/assets/og.png" alt="ReactiveExtream — An RxJS pipeline puzzle" width="720">

# ReactiveExtream

**RxJS / ReactiveX のオペレータを、マーブル図を組み立てて学ぶパズルゲーム**
*An RxJS pipeline puzzle — learn Observable operators by building marble diagrams.*

[**▶ ブラウザで遊ぶ**](https://hummer98.dev/rx-pipeline-puzzle/) ・
[コンセプト](docs/concept.html) ・
[English](README.en.md) ・
[ステージを投稿する](CONTRIBUTING.md)

**94 ステージ / 12 サイクル / 39 オペレータ** ・ ビルド不要 ・ 依存パッケージゼロ ・ Cookie なし

[![License: MIT](https://img.shields.io/badge/code-MIT-blue.svg)](LICENSE)
[![Stages: CC BY 4.0](https://img.shields.io/badge/stages-CC%20BY%204.0-lightgrey.svg)](LICENSE-CONTENT)
[![No dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#開発)

</div>

---

## これは何か

マーブル図は普通「読むもの」として説明されます。ReactiveExtream はそれを**組み立てて答え合わせするもの**に変えます。

1. **観察する** — 入力ストリームと正解ストリームをタイムライン上で見比べる
2. **組み立てる** — `map` / `filter` / `debounceTime` / `switchMap` などのオペレータを並べ、パラメータを調整する
3. **差分を見る** — 出力は即座に再計算され、正解との**不足・余分・値違い・完了位置ずれ**が色で分かる

判定は出力ストリームのみで行うため、**別解が自然に通ります**（`filter → map` と `map → filter` はどちらも正解）。

クリアすると、あなたが組んだパイプラインが**そのまま RxJS のコードとして生成表示**されます。簡略化しているオペレータには「本物はここが違う」という注記が付きます。

BGM と効果音も付いています。学習ツールとして不意に音が鳴らないよう、**BGM は既定オフ**・効果音は既定オンで、ヘッダーのスピーカーボタンから調整できます。

### 収録オペレータ（39）

| サイクル | テーマ | オペレータ |
| --- | --- | --- |
| 1 | 基礎編 | `map` `filter` `take` `skip` |
| 2 | 状態編 | `scan` `distinctUntilChanged` `takeWhile` `startWith` |
| 3 | 時間編 | `delay` `throttleTime` `debounceTime` `reduce` |
| 4 | 変換編 | `mapTo` `index` `timestamp` `last` |
| 5 | 位置編 | `takeLast` `skipLast` `elementAt` `defaultIfEmpty` |
| 6 | 選別編 | `distinct` `takeUntil` `skipUntil` `auditTime` |
| 7 | 合流編（2入力） | `merge` `zip` `combineLatest` `withLatestFrom` |
| 8 | 制御編（2入力） | `sample` `takeUntil(B)` `skipUntil(B)` `race` |
| 9 | 実践編 | 新規なし（スペックモード：正解を見ずに組む） |
| 10 | 分岐編 | 新規なし（合流前に B 側を前処理する） |
| 11 | 展開編 | `mergeMap` `concatMap` `switchMap` `exhaustMap` |
| 12 | エラー編 | `catchError` `retry` `timeout` |

Cycle 7 以降は実務の定番パターンが題材です。type-ahead（`debounceTime` + `distinctUntilChanged`）、保存ボタン（`withLatestFrom`）、料金ダッシュボード（`combineLatest`）、ドラッグ&ドロップ（`takeUntil(B)` + `scan` + `last`）など。

## 遊ぶ

- 公開版: <https://hummer98.dev/rx-pipeline-puzzle/>
- ローカル: リポジトリを clone して `prototype/index.html` をブラウザで開くだけ（`file://` でも動きます）

サーバー経由で見たい場合:

```sh
python3 -m http.server 8000 --directory prototype
# → http://localhost:8000/
```

進捗（クリア済みステージ）は `localStorage` に保存されます。サーバーには送りません。

## リポジトリ構成

```
prototype/            ゲーム本体（これがそのまま公開サイトのルートになる）
  index.html          ランディング
  game.html           ゲーム画面
  app.js              ステージ定義・オペレータ実装・判定・UI（依存ゼロ）
  styles.css
  audio.js            BGM / 効果音（Master ← Music/Sfx のバス構成）
  audio-check.html    音源の試聴ページ（開発用・noindex）
  analytics.js        計測アダプタ（既定は無効・何も送らない）
  favicon.svg
  assets/og.png       OG 画像（assets/og.svg から生成）
  assets/audio/       BGM・効果音（mp3）
tools/
  gen-audio.mjs       ElevenLabs API で音源を生成するスクリプト（開発時のみ）
docs/
  concept.html        コンセプトペーパーと画面案
  implementation-plan.md  v0 確定仕様（オペレータの意味論はここが正）
  metrics.md          何をなぜ計測するかの設計
assets/og.svg         OG 画像のソース
.github/workflows/pages.yml   GitHub Pages へのデプロイ（ビルドなし）
```

OG 画像を作り直すとき:

```sh
rsvg-convert -w 1200 -h 630 assets/og.svg -o prototype/assets/og.png
```

`app.js` は 1 ファイルですが役割は分かれています。

| 範囲 | 中身 |
| --- | --- |
| `CYCLES` / `STAGES` | 94 ステージのレベルデザイン（純粋なデータ。JSON にそのまま出せる形） |
| `OPERATOR_DEFS` | 39 オペレータの意味論（各オペレータは `(stream, params) => stream` の純粋関数） |
| `evaluatePipeline` / `diffStreams` | 評価と差分判定。Rx に依存しない汎用の判定器 |
| それ以降 | 描画・再生・UI |

## 仕様上の注意

学習しやすさを優先して、本家 RxJS と意図的に違う点があります（ゲーム内とコード生成時にも注記されます）。

- 1 ストリームにつき**同時刻のイベントは最大 1 個**。差分表示を単純にするための制約です。
- `takeLast` / `skipLast` は Rx では完了時に一括放出しますが、本作では**元の時刻を保つ位置ベース**の挙動にしています。
- 時間は `t = 0 .. duration` の**離散値**で、イベントは整数 `t` に置かれます。

正確な意味論は [`docs/implementation-plan.md`](docs/implementation-plan.md) の「v0 確定仕様」にすべて書いてあります。

## 計測とプライバシー

このリポジトリの既定状態では**アクセス解析は一切動きません**（`prototype/analytics.js` の `provider` が `"none"`）。

公開サイトで有効にする場合も、以下を満たす構成のみを想定しています。

- Cookie / 端末識別子を使わない
- 送るのはページビューと「どこまで進んだか」だけ。入力内容や解答は送らない
- `Do Not Track` / `Global Privacy Control` が有効な訪問者には送らない
- `localhost` / `file://` では送らない

計測項目の一覧と設計意図は [`docs/metrics.md`](docs/metrics.md) を参照してください。

## 開発

ビルドもパッケージマネージャも使いません。ファイルを編集してブラウザをリロードするだけです。

```sh
node --check prototype/app.js       # 構文チェック
python3 -m http.server 8000 --directory prototype
```

ステージを追加したい場合は [CONTRIBUTING.md](CONTRIBUTING.md) を読んでください。ステージは `app.js` の `STAGES` 配列に足すだけで、JS を書く必要はほとんどありません。

## ライセンス

| 対象 | ライセンス |
| --- | --- |
| コード（`prototype/*.js`, `*.css`, `*.html`） | [MIT](LICENSE) |
| ステージ定義（`STAGES`）・ドキュメント・画像 | [CC BY 4.0](LICENSE-CONTENT) |

## 免責

ReactiveExtream は RxJS を学ぶための**非公式**のファンプロジェクトです。ReactiveX / RxJS の公式プロジェクト、およびその開発者・関係者とは一切関係がありません。オペレータの挙動は学習用に一部簡略化しています。

“Extream” は Extreme × Stream の造語で、綴りの誤りではありません。
