import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1300, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
const secs = (process.argv[2] || '1.5').split(',').map(Number);
fs.mkdirSync('screenshots', { recursive: true });
const t0 = Date.now();
const r = await p.evaluate(async (secs) => { let t = 100000; __game.renderAt(t); __game.newGame(); const out = []; let cur = 0;
  for (const s of secs) { while (cur < s - 1e-6) { t += 1000 / 30; cur += 1 / 30; __game.renderAt(t); } out.push(document.getElementById('stage').toDataURL('image/png')); }
  return { out, n: __game.G.stones.length, st: __game.G.state }; }, secs);
r.out.forEach((u, i) => fs.writeFileSync(`screenshots/t_${secs[i]}.png`, Buffer.from(u.split(',')[1], 'base64')));
console.log('stones', r.n, r.st, 'ms', Date.now() - t0, errs.slice(0, 5));
await b.close();
