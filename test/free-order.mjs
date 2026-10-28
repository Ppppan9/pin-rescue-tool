// 自由拔钉测试：用真实鼠标点击，按多种随机顺序拔当前盒颜色的任意钉子；检查每颗可见钉都能命中、盒子正常填满、最终清空获胜。
// 编辑器 index.html + 导出的 H5（generic 渠道）各跑一遍。
import { chromium } from 'playwright-core';
import fs from 'fs';
import { makePlayableHtml } from '../src/h5/index.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const h5 = makePlayableHtml(fs.readFileSync('index.html', 'utf8'), { format: 'generic', toolId: 'pin-rescue-tool', settings: { canvasW: 720, canvasH: 1280 }, orientation: 1, storeUrl: 'https://example.com/app', ctaText: '立即下载' });
fs.writeFileSync('/tmp/pin_h5_free.html', h5);
async function run(url, label, seeds, viewport) {
  const p = await b.newPage({ viewport }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url); await p.waitForFunction(() => window.__ready && window.__game, null, { timeout: 60000 });
  for (const seed of seeds) {
    await p.evaluate(() => { localStorage.clear(); __game.setMany({ timerSec: 999, endCard: false }); window.__T = 1e6; __game.renderAt(window.__T); __game.newGame(); });
    const step = n => p.evaluate(async n => { for (let i = 0; i < n; i++) { window.__T += 1000 / 30; __game.renderAt(window.__T); await new Promise(r => requestAnimationFrame(r)); } }, n);
    await step(30);
    // 命中检测：每颗可见钉子 pinAt 都返回它自己
    const hit = await p.evaluate(() => { const G = __game.G; return G.pins.filter(q => q.alive).every(q => G.pinAt(q.x, q.y) === q); });
    let rnd = seed * 9301 + 49297; const rand = () => (rnd = (rnd * 9301 + 49297) % 233280) / 233280;
    let taps = 0, wrongOk = true, boxes = new Set(), order = [];
    for (let guard = 0; guard < 400; guard++) {
      const st = await p.evaluate(() => { const G = __game.G, cv = document.getElementById('stage'), r = cv.getBoundingClientRect(), k = r.width / cv.width;
        const vx = __game.viewX0 || 0, vy = __game.viewY0 || 0;
        return { state: G.state, box: G.boxIdx + ':' + G.box.color, cands: G.candidates().map(q => ({ id: q.id, c: q.c, x: r.left + (q.x - vx) * k, y: r.top + (q.y - vy) * k })), alive: G.pins.filter(q => q.alive).length }; });
      if (st.state !== 'play' || st.alive === 0) break;
      boxes.add(st.box);
      if (!st.cands.length) { await step(6); continue; }
      const q = st.cands[Math.floor(rand() * st.cands.length)];
      const before = st.alive; await p.mouse.click(q.x, q.y); taps++; order.push(q.c + q.id);
      const after = await p.evaluate(() => __game.G.pins.filter(q => q.alive).length);
      if (after !== before - 1) { wrongOk = false; console.log('  miss', q); break; }
      await step(Math.floor(2 + rand() * 20));
    }
    await step(120);
    const end = await p.evaluate(() => ({ state: __game.G.state, alive: __game.G.pins.filter(q => q.alive).length }));
    ok(hit && wrongOk && end.alive === 0 && end.state === 'win', `${label} seed${seed}: 全部可见钉可命中=${hit}，${taps} 次点击全中=${wrongOk}，盒子 ${boxes.size} 个，结束 state=${end.state} 剩余钉=${end.alive}  顺序 ${order.slice(0, 8).join(' ')}…`);
  }
  ok(errs.length === 0, label + ' 无页面报错 ' + errs.slice(0, 2).join('|'));
  await p.close();
}
await run('file://' + process.cwd() + '/index.html', '编辑器', [1, 2, 3, 4], { width: 1300, height: 1000 });
await run('file:///tmp/pin_h5_free.html', 'H5', [5, 6], { width: 390, height: 844 });
await b.close(); process.exit(fail ? 1 : 0);
