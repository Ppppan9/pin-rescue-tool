// 自动通关能否获胜：① 仅调速度倍率 3x（默认 22.6 秒倒计时）→ 仍会失败（盒子满→闪光→缩小→新盒弹出的动画占用大量时间）
// ② 速度倍率 3x + 倒计时 60 秒 → 自动通关清空全部钉子获胜（README 记载的演示通关方法）
import { openPage } from './play.mjs';
const { b, p, errs } = await openPage(); let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
async function run(set) {
  return p.evaluate(async set => { localStorage.clear(); __game.setMany(set); window.__T = 2e6; __game.renderAt(window.__T); __game.newGame(); __game.autoSolve();
    for (let i = 0; i < 30 * 90; i++) { window.__T += 1000 / 30; __game.renderAt(window.__T); await new Promise(r => requestAnimationFrame(r)); const G = __game.G; if (G.state !== 'play') break; }
    const G = __game.G; return { state: G.state, t: +(G.state === 'win' ? G.winT : G.failT ?? G.t).toFixed(2), left: G.pins.filter(q => q.alive).length }; }, set);
}
const a = await run({ autoSpeed: 3 });
ok(a.state === 'fail', `仅 3x 速度、默认倒计时 → 失败（${JSON.stringify(a)}）`);
const w = await run({ autoSpeed: 3, timerSec: 60 });
ok(w.state === 'win' && w.left === 0, `3x 速度 + 倒计时 60 秒 → 获胜（${JSON.stringify(w)}）`);
ok(errs.length === 0, '无页面报错 ' + errs.slice(0, 2).join('|'));
await b.close(); process.exit(fail ? 1 : 0);
