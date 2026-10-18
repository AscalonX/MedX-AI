# Measure UI component boxes in a still (native pixels).
# Usage: python -I measure.py <image> <x0> <y0> <x1> <y1> [tol]
#   prints the background colour of the region (mode of its border pixels), the bbox of
#   everything that differs from it, and a coarse row profile (runs of content rows).
import sys
import numpy as np
from PIL import Image
f = sys.argv[1]; x0, y0, x1, y1 = map(int, sys.argv[2:6]); tol = int(sys.argv[6]) if len(sys.argv) > 6 else 10
a = np.asarray(Image.open(f).convert('RGB')).astype(int)[y0:y1, x0:x1]
edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
vals, counts = np.unique(edge, axis=0, return_counts=True)
bg = vals[counts.argmax()]
d = np.abs(a - bg).max(axis=2) > tol
ys, xs = np.where(d)
print('bg', '#%02X%02X%02X' % tuple(bg))
if len(ys):
    print('content bbox', x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1)
rows = d.any(axis=1)
runs, start = [], None
for i, r in enumerate(list(rows) + [False]):
    if r and start is None: start = i
    if not r and start is not None: runs.append((y0 + start, y0 + i)); start = None
print('row runs', runs[:60])
cols = d.any(axis=0)
runs, start = [], None
for i, r in enumerate(list(cols) + [False]):
    if r and start is None: start = i
    if not r and start is not None: runs.append((x0 + start, x0 + i)); start = None
print('col runs', runs[:40])
