# ReactiveExtream Docs

このフォルダは、ReactiveX / RxJS のストリームオペレータをモチーフにしたパイプラインプログラミングパズルゲーム **ReactiveExtream**（Extream = Extreme × Stream の造語。リポジトリ名・開発コードは rx-pipeline-puzzle）の企画・設計ドキュメント置き場です。

プロジェクトの紹介・遊び方・ライセンスはリポジトリ直下の [`../README.md`](../README.md) を参照してください。

| ファイル | 内容 |
| --- | --- |
| [concept.html](concept.html) | ゲームコンセプトペーパーと画面サンプル案 |
| [implementation-plan.md](implementation-plan.md) | 実装計画と **v0 確定仕様**。39 オペレータの意味論はここが正 |
| [metrics.md](metrics.md) | 何をなぜ計測するかの設計とプライバシー方針 |

プレイ可能なプロトタイプは [`../prototype/index.html`](../prototype/index.html)（トップページ）をブラウザで直接開いてください（ビルド・依存なし）。ゲーム画面本体は [`../prototype/game.html`](../prototype/game.html) です。

現在の規模: **94 ステージ / 12 サイクル / 39 オペレータ**。
