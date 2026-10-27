# 📌 拔钉救人核玩工具 v1.0.0

第 6 个核玩工具：按参考广告视频（0:00–0:24，第 1 关）复刻的「拔钉救人」玩法素材工具。
砖墙密室、上方满仓蓝色碎石、反戴白帽的小人顶着支撑杆、6×5 木板格子 + 彩色十字钉、目标盒（3 孔）、倒计时圈、底部免责声明；
点和目标盒同色的钉子 → 钉子弹起并飞进盒子；木板失去钉子后按 **planck.js 2D 物理**摆动 / 掉落，石头随之流下；
倒计时到 0 → 压板塌下、小人被压扁、烟雾、背景模糊 + FAIL 红圈。

在线版：https://ppppan9.github.io/pin-rescue-tool/

## 使用
- 直接打开 `index.html`（单文件，已内联全部代码，离线可用）。右侧「控制面板」里所有参数都是中文，自动保存到浏览器（带版本号与迁移）。
- ▶ 自动通关：模拟手指（默认内置白手套，可上传 PNG）按当前目标盒颜色逐个点钉子；节奏默认按参考视频（约 1.7 秒点一次，所以和参考一样会超时失败；调「整体速度倍率」可以演示通关）。录制不会自动开始。
- 导出：
  - **AE 工程**：「● 开始记录」→ 玩一段 →「■ 停止并导出」，得到 `pin-rescue-tool_ae_export_*.zip`（`build_ae_project.jsx` + `timeline.json` + `assets/` + `audio/mix.wav` + `audio/sfx_*.wav`），每个元素一个独立图层 + 关键帧，说明见 zip 内 README_AE.md。
  - **H5 试玩广告**：一个 zip 内 8 个渠道文件夹（applovin / facebook / google / mintegral / moloco / tiktok / unity / generic）。试玩版不带手指、默认不自动演示；预览与导出按「预览机型」或自定义宽×高，只有「自适应」会留黑边。

## 开发
```
npm install
npm run build          # esbuild → index.html
npm test               # 浏览器冒烟：手动拔钉 / 自动通关 / 失败流程
npm run test:ae        # 自动游玩并导出 AE zip
H5_QUICK=1 npm run test:h5   # 8 渠道冒烟
npm run shots          # 与参考帧并排对比 screenshots/compare_*.png
```
