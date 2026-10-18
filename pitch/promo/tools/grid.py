# Compose frames into 2x2 review sheets (960x540 tiles) with time labels.
# Usage: python -I grid.py <frames_dir> <out_prefix> [t1 t2 ...]   (times optional: all frames)
import sys, os, glob, re
from PIL import Image, ImageDraw

src, prefix = sys.argv[1], sys.argv[2]
want = [float(x) for x in sys.argv[3:]]
files = sorted(glob.glob(os.path.join(src, 't_*.jpg')))
def tof(f):
    return float(re.search(r't_([0-9.]+)_', os.path.basename(f)).group(1))
if want:
    files = [f for f in files if any(abs(tof(f) - w) < 1e-3 for w in want)]
for k in range(0, len(files), 4):
    sheet = Image.new('RGB', (1920, 1080), (10, 22, 34))
    d = ImageDraw.Draw(sheet)
    for j, f in enumerate(files[k:k + 4]):
        im = Image.open(f).convert('RGB').resize((960, 540), Image.LANCZOS)
        x, y = (j % 2) * 960, (j // 2) * 540
        sheet.paste(im, (x, y))
        d.rectangle([x, y, x + 120, y + 26], fill=(0, 0, 0))
        d.text((x + 6, y + 6), f'{tof(f):.2f}s', fill=(255, 255, 0))
    out = f'{prefix}_{k // 4:02d}.jpg'
    sheet.save(out, quality=88)
    print(out)
