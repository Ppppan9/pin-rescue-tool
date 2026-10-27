import sys, subprocess
from PIL import Image, ImageDraw
# usage: grid.py out.png prefix t1,t2,...  -> top row ours, bottom row reference
out, prefix, ts = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
w, h = 270, 480
W = Image.new('RGB', (w * len(ts), h * 2 + 20), (20, 20, 20)); d = ImageDraw.Draw(W)
for i, t in enumerate(ts):
    a = Image.open(f'screenshots/{prefix}_{t}.png').convert('RGB').resize((w, h)); W.paste(a, (i * w, 0))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', t, '-i', '../game6-ref/ref.mp4', '-frames:v', '1', '/tmp/rf.png'])
    b = Image.open('/tmp/rf.png').convert('RGB').resize((w, h)); W.paste(b, (i * w, h + 20)); d.text((i * w + 5, h + 4), 'ours ' + t + 's  /  ref below', fill=(255, 255, 0))
W.save(out)
