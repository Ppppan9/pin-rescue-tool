import sys
from PIL import Image, ImageDraw
ours, ref, out = sys.argv[1], sys.argv[2], sys.argv[3]
label = sys.argv[4] if len(sys.argv) > 4 else ''
a = Image.open(ours).convert('RGB').resize((540, 960)); b = Image.open(ref).convert('RGB').resize((540, 960))
W = Image.new('RGB', (1100, 1000), (30, 30, 30)); W.paste(a, (0, 40)); W.paste(b, (560, 40)); d = ImageDraw.Draw(W)
d.text((10, 10), 'pin-rescue-tool (ours) ' + label, fill=(255, 255, 255)); d.text((570, 10), 'reference ' + ref.split('/')[-1], fill=(255, 255, 255)); W.save(out)
