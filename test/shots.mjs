// 生成 ours-vs-ref 对比图：screenshots/compare_*.png（上排我们，下排参考视频同一时刻）
import { openPage, autoPlay } from './play.mjs';
import { execFileSync } from 'child_process';
import fs from 'fs';
fs.mkdirSync('screenshots', { recursive: true });
const sets = { compare_intro: '0.3,0.9,1.5,3', compare_mid: '6,9,12,15', compare_late: '18,20,21.5,22.3', compare_fail: '22.6,22.9,23.2,23.6,24.1,24.4' };
const all = [...new Set(Object.values(sets).join(',').split(',').map(Number))];
const { b, p, errs } = await openPage();
await autoPlay(p, { secs: all, until: Math.max(...all) + 0.1, prefix: 'auto' });
await b.close();
for (const [k, v] of Object.entries(sets)) execFileSync('python3', ['test/grid.py', `screenshots/${k}.png`, 'auto', v.split(',').map(x => String(Number(x))).join(',')]);
console.log('done', Object.keys(sets), errs.slice(0, 3));
