# ASSETS

本工具不包含任何外部图片、字体或音频素材：

- 所有画面（砖墙、管道、房间、小人、压板、支撑杆、木板、钉子、石头、目标盒、计时器、FAIL 徽章、烟雾、默认手套手指）都是 `src/art.js` 用 Canvas 2D 程序化绘制的。外观仿照参考视频，但没有使用参考视频里的任何像素。
- 所有音效由 `src/audio.js` 用 WebAudio 实时合成，导出时渲染成 WAV。
- 字体使用系统字体（PingFang / Microsoft YaHei / sans-serif），没有打包字体文件。
- 物理引擎：planck.js 1.4.2（MIT License, © Erin Catto / Ali Shakiba），通过 npm 安装后由 esbuild 打包进 index.html，没有使用 CDN。
- 用户自行上传的手指 PNG 只保存在浏览器 localStorage 中，不会进入仓库。
