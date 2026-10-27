// 主流程测试：手动点钉 / 点错晃动 / 自动通关直到失败 / 快速自动通关获胜
import { openPage } from './play.mjs';
const { b, p, errs } = await openPage(); let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const step = (n) => p.evaluate(async n => { for (let i = 0; i < n; i++) { window.__T += 1000 / 30; __game.renderAt(window.__T); await new Promise(r => requestAnimationFrame(r)); } const G = __game.G; return { state: G.state, filled: G.box.filled.length, box: G.boxIdx, pins: G.pins.filter(x => x.alive).length }; }, n);
// 1) 手动：点一个可用钉 + 点一个错色钉
await p.evaluate(() => { localStorage.clear(); __game.setMany({}); window.__T = 1e5; __game.renderAt(window.__T); __game.newGame(); });
await step(60);
const r1 = await p.evaluate(() => { const G = __game.G; const c = G.candidates(); const pin0 = G.pins.filter(x => x.alive).length; const a = G.tap(c[0].x, c[0].y); const wrong = G.pins.find(x => x.alive && !c.includes(x)); const w = wrong ? G.tap(wrong.x, wrong.y) : null; return { pin0, ncand: c.length, ok: !!(a && a.ok), shake: G.shakes.length, wrong: !!wrong }; });
let s = await step(40);
ok(r1.ok && r1.shake >= 1, `点错色钉 → 晃动提示（shakes=${r1.shake}）`);
ok(s.pins === r1.pin0 - 1, `手动点钉：钉子减少 1（${r1.pin0}→${s.pins}）`);
ok(s.filled >= 1, `钉子飞入目标盒（filled=${s.filled}）`);
// 2) 自动通关（默认节奏）→ 22.6 秒压塌失败
await p.evaluate(() => { __game.newGame(); __game.autoSolve(); });
for (let i = 0; i < 30 && s.state !== 'fail'; i++) s = await step(30);
ok(s.state === 'fail', `默认节奏自动通关到时间结束 → 失败（state=${s.state}, box=${s.box}）`);
// 3) 快速 + 短盒序 → 获胜
await p.evaluate(() => { __game.setMany({ boxSeq: 'R,L', timerSec: 60, moveMin: 80, moveMax: 100, delayMin: 50, delayMax: 80, autoStartDelay: 200 }); __game.newGame(); __game.autoSolve(); });
s = await step(5); for (let i = 0; i < 40 && s.state !== 'win'; i++) s = await step(30);
ok(s.state === 'win', `快速自动通关 + 2 盒 → 胜利（state=${s.state}）`);
ok(errs.length === 0, '无页面报错 ' + errs.slice(0, 3).join(' | '));
await b.close(); process.exit(fail ? 1 : 0);
