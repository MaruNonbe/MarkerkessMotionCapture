# Video → VRM Motion

動画(Webカメラ or 動画ファイル)に映る人物の動きをリアルタイムに推定し、VRM形式の3Dキャラクターへ反映するWebアプリです。

## 使っている技術

| 役割 | ライブラリ |
|---|---|
| 骨格・顔・手指のトラッキング | [MediaPipe Holistic](https://github.com/google/mediapipe) |
| トラッキング結果 → 回転値への変換 | [Kalidokit](https://github.com/yeemachine/kalidokit) |
| 3D描画・VRM読み込み | [Three.js](https://threejs.org/) + [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) |
| ビルド | [Vite](https://vitejs.dev/) |

処理はすべてブラウザ内で完結します(動画・映像は外部サーバーに送信されません)。

## セットアップ

```bash
npm install
npm run dev
```

`http://localhost:5173` を開いてください。

## 使い方

1. 画面右パネルの「.vrmファイルを読み込む」から、動かしたいVRMモデルを指定します。
   - [VRoid Hub](https://hub.vroid.com/) や [VRoid Studio](https://vroid.com/studio) で作成・入手したVRMが使えます。
2. 「Webカメラ」ボタンでカメラ入力を開始するか、「動画ファイル」で手持ちの動画を読み込みます。
   - 動画ファイルの場合は読み込み後に「再生」ボタンを押すとトラッキングが始まります。
3. 右下のプレビューに骨格の検出状況が表示されます。人物が画面全体に収まるアングルほど精度が上がります。

## カスタマイズのヒント

- `src/vrmRig.js`: 検出結果をVRMボーンへ反映するロジック。腕・脚・指の可動域の補正や、`lerpFactor`(値が大きいほど反応が速いが揺れやすい)の調整はここで行います。
- `src/main.js`: 入力ソースの切り替え、MediaPipeの精度設定(`modelComplexity`など)、カメラワークの調整はここ。
- 表情(まばたき・口の開閉)は最低限のみ実装しています。VRMの表情(Expression)名がモデルによって異なる場合、`rigFace`内の`expr.setValue(...)`の引数名を対象モデルに合わせて調整してください。

## GitHub Pagesへのデプロイ例

既存のWebARプロジェクトと同様の運用を想定するなら、`vite.config.js`に`base`を設定してビルドし、`dist`をそのまま公開する流れが簡単です。

```bash
npm run build
# dist/ の中身を marunonbe.github.io の該当リポジトリへ配置
```

## 既知の制約

- 全身が映っていないと脚のトラッキング精度が落ちます(上半身のみでも腕・頭は反映されます)。
- 複数人が映る動画では、MediaPipeが検出した1人分の骨格のみが反映されます。
- 動画ファイルの解像度が高いほど処理が重くなります。事前に720p程度へ縮小しておくと安定します。
