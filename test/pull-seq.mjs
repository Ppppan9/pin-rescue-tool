// 拔钉序列特写：在 2.6s 点 (行0,列1) 红钉，之后每 0.1s 截图，拼成条带；与参考 2.3–3.4s 对照
import { openPage } from './play.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const { b, p, errs } = await openPage();
const urls = await p.evaluate(async () => { localStorage.clear(); __game.setMany({}); let t = 100000; __game.renderAt(t); __game.newGame(); const G = __game.G, out = [];
  const adv = s => { const n = Math.round(s * 30); for (let i = 0; i < n; i++) { t += 1000 / 30; __game.renderAt(t); } };
  adv(2.3); for (let k = 0; k < 12; k++) { if (k === 3) { const pin = G.pins.find(p => p.r === 0 && p.k === 1); __game.tapAt(pin.x, pin.y); } out.push(document.getElementById('stage').toDataURL()); adv(0.1); }
  return out; });
urls.forEach((u, i) => fs.writeFileSync(`/tmp/pull_${i}.png`, Buffer.from(u.split(',')[1], 'base64')));
execFileSync('python3', ['-c', `
from PIL import Image, ImageDraw
import subprocess
W=Image.new('RGB',(4*230,2*3*165+40),(20,20,20)); d=ImageDraw.Draw(W)
for i in range(12):
  a=Image.open('/tmp/pull_%d.png'%i).convert('RGB').crop((180,520,640,850)).resize((230,165)); W.paste(a,((i%4)*230,(i//4)*165))
  subprocess.run(['ffmpeg','-v','error','-y','-ss',str(2.3+i*0.1),'-i','../game6-ref/ref.mp4','-frames:v','1','/tmp/rp.png'])
  b=Image.open('/tmp/rp.png').convert('RGB').crop((180,520,640,850)).resize((230,165)); W.paste(b,((i%4)*230,3*165+40+(i//4)*165))
d.text((5,3*165+10),'top: ours (tap at 2.6s)   bottom: reference 2.3-3.4s',fill=(255,255,0))
W.save('screenshots/pull_sequence_ours_vs_ref.png')`]);
console.log(errs.slice(0, 3)); await b.close();
