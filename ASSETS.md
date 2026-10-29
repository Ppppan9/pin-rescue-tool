# ASSETS

本工具不包含任何外部图片、字体或音频素材：

- 默认手指 `src/default_hand.js`：其它核玩工具（祖玛 / 麻将 / 螺丝）共用的预设 hand.png（384×600，与 site/public/img/hand.png 像素一致），来自用户预设，不是外部下载的素材。
- 其余画面（砖墙、管道、房间、小人、压板、支撑杆、木板、钉子、石头、目标盒、计时器、FAIL 徽章、烟雾、可选的白手套手指）都是 `src/art.js` 用 Canvas 2D 程序化绘制的。外观仿照参考视频，但没有使用参考视频里的任何像素。
- 所有音效由 `src/audio.js` 用 WebAudio 实时合成，导出时渲染成 WAV。
- 字体使用系统字体（PingFang / Microsoft YaHei / sans-serif），没有打包字体文件。
- 物理引擎：planck.js 1.4.2（MIT License, © Erin Catto / Ali Shakiba），通过 npm 安装后由 esbuild 打包进 index.html，没有使用 CDN。
- 用户自行上传的手指 PNG 只保存在浏览器 localStorage 中，不会进入仓库。
