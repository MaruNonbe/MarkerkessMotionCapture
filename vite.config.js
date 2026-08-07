import { defineConfig } from "vite";

// GitHub Pages (https://marunonbe.github.io/video2vrm/ のようなサブパス) で
// 正しくアセットを読み込めるよう、相対パスでビルドする
export default defineConfig({
  base: "./",
});
