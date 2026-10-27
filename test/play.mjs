// 自动通关逐帧推进（虚拟时钟 30fps，每帧让出一次 rAF 让自动通关协程运行），在指定秒数截图
import { chromium } from 'playwright-core';
import fs from 'fs';
export async function openPage() {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 1300, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  return { b, p, errs };
}
export async function autoPlay(p, { secs = [], until = 26, settings = {}, prefix = 'auto' } = {}) {
  await p.evaluate(s => { localStorage.clear(); __game.setMany(s); window.__T = 100000; __game.renderAt(window.__T); __game.newGame(); __game.autoSolve(); window.__log = []; }, settings);
  const shots = {}; let cur = 0; const want = [...secs].sort((a, b) => a - b);
  while (cur < until) {
    const r = await p.evaluate(async (n) => { for (let i = 0; i < n; i++) { window.__T += 1000 / 30; __game.renderAt(window.__T); await new Promise(r => requestAnimationFrame(r)); } const G = __game.G; return { t: G.t, state: G.state, box: G.boxIdx, filled: G.box.filled.length, pins: G.pins.filter(p => p.alive).length, stones: G.stones.length, planks: G.planks.length }; }, 3);
    cur += 0.1;
    while (want.length && cur >= want[0] - 1e-6) { const s = want.shift(); const u = await p.evaluate(() => document.getElementById('stage').toDataURL('image/png')); fs.writeFileSync(`screenshots/${prefix}_${s}.png`, Buffer.from(u.split(',')[1], 'base64')); shots[s] = r; }
    if (Math.abs(cur % 2) < 0.05) console.log(cur.toFixed(1), JSON.stringify(r));
  }
  return shots;
}
if (process.argv[1].endsWith('play.mjs')) {
  const { b, p, errs } = await openPage();
  const secs = (process.argv[2] || '3,8,16,22,23.4,24.4').split(',').map(Number);
  fs.mkdirSync('screenshots', { recursive: true });
  const r = await autoPlay(p, { secs, until: Math.max(...secs) + 0.1 });
  console.log(JSON.stringify(r), errs.slice(0, 5)); await b.close();
}
