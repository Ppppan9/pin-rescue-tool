// 自动通关（虚拟时钟逐帧推进，直到 FAIL 后 1.5 秒）并记录 AE 时间轴 → 导出 AE zip，检查 zip 结构 / 图层 / 关键帧 / 音频
import { openPage } from './play.mjs';
import fs from 'fs';
const { b, p, errs } = await openPage();
const info = await p.evaluate(async () => { try {
  localStorage.clear(); __game.setMany({}); let t = 300000; __game.renderAt(t); __game.newGame(); __game.aeStart(); __game.autoSolve(); let f = 0;
  while (f < 30 * 30) { t += 1000 / 30; f++; __game.renderAt(t); await new Promise(r => requestAnimationFrame(r)); if (!__game.aeActive()) break; }
  __game.aeStop(); const r = await __game.doExportAE(false);
  const enc = async blob => { const buf = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(bin); };
  const L = r.timeline.comps.find(c => c.id === 'main').layers;
  return { zip: await enc(r.blob), name: r.name, stats: r.stats, files: r.fileList.map(x => x.name), duration: r.timeline.meta.duration, frames: f, layerNames: L.map(l => l.name), sample: L.filter(l => /压板|支撑杆|FAIL|手指|目标盒/.test(l.name)).slice(0, 6) };
} catch (e) { return { err: e.stack }; } });
if (info.err) { console.log(info.err); process.exit(1); }
fs.mkdirSync('screenshots', { recursive: true });
fs.writeFileSync('/tmp/pin_ae_sample.zip', Buffer.from(info.zip, 'base64'));
const need = ['build_ae_project.jsx', 'timeline.json', 'README_AE.md', 'audio/mix.wav', 'assets/background.png', 'assets/lid.png', 'assets/fail_badge.png', 'assets/hand.png'], miss = need.filter(n => !info.files.includes(n));
const kinds = ['背景', '小人_', '支撑杆', '压板', '石头_', '木板_横', '木板_竖', '钉子_', '目标盒', '盒中钉', '飞行钉', '烟雾', '标题', '倒计时_', '失败模糊', '结果_FAIL', '免责声明', '手指', '混合音轨', '音效_逐事件'];
const missK = kinds.filter(k => !info.layerNames.some(n => n.startsWith(k)));
console.log(JSON.stringify({ name: info.name, frames: info.frames, duration: info.duration, stats: info.stats, files: info.files.length, assets: info.files.filter(n => n.startsWith('assets/')).length, sfxFiles: info.files.filter(n => n.startsWith('audio/sfx_')) }));
console.log('sample layers', JSON.stringify(info.sample).slice(0, 1500));
const bad = miss.length || missK.length || !info.stats.layers || !info.stats.keys; if (miss.length) console.log('MISSING files', miss); if (missK.length) console.log('MISSING layer kinds', missK);
await b.close();
console.log(errs.length ? 'ERRORS ' + errs.slice(0, 3).join(' | ') : 'no page errors');
console.log(bad || errs.length ? 'AE EXPORT FAIL' : 'AE EXPORT PASS'); process.exit(bad || errs.length ? 1 : 0);
