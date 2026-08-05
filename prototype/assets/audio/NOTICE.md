# 音源について / About these audio files

このディレクトリの `.mp3` は **ElevenLabs**（[elevenlabs.io](https://elevenlabs.io)）の
API で生成し、ffmpeg で無音トリムとラウドネス調整を施したものです。
生成プロンプトと後処理は [`tools/gen-audio.mjs`](../../../tools/gen-audio.mjs) に
すべて記録してあります。

## ライセンス

**これらの音源はリポジトリの CC BY 4.0（`LICENSE-CONTENT`）の対象外です。**

AI 生成音声の利用条件は生成元サービスの規約に従います。本プロジェクトは
自身が保有しない権利を再許諾できないため、音源については何の許諾も
与えていません。

再利用したい場合は、次のいずれかをお願いします。

1. **自分で生成し直す**（推奨）— ElevenLabs のアカウントを用意し、
   リポジトリ直下で `node tools/gen-audio.mjs --force` を実行すれば、
   同じプロンプトから同等の音源一式が手元に生成されます。
   生成物の権利はあなたと ElevenLabs の契約に従います。
2. **ElevenLabs の利用規約を自分で確認する** — 契約プランによって
   商用利用の可否と再配布の可否が異なります。

コード（`prototype/*.js` 等）は MIT、ステージ定義や文書は CC BY 4.0 で、
そちらは通常どおり再利用できます。

---

## English

The `.mp3` files in this directory were generated with the
**ElevenLabs** API and post-processed with ffmpeg (silence trimming and
loudness normalisation). The prompts and the post-processing chain are
recorded in [`tools/gen-audio.mjs`](../../../tools/gen-audio.mjs).

**These audio files are NOT covered by this repository's CC BY 4.0
content licence.** Use of AI-generated audio is governed by the terms of
the service that generated it, and this project cannot sub-license rights
it does not hold — so no licence is granted for these files.

To reuse them, either regenerate your own (`node tools/gen-audio.mjs
--force` with your own ElevenLabs account — recommended), or check
ElevenLabs' terms for your plan. The code (MIT) and the stage
definitions / documentation (CC BY 4.0) are reusable as normal.
