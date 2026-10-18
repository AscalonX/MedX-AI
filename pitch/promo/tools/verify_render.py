# Independent check of a finished render: stream facts, A/V sync, contact sheet, stills.
# Usage: python -I verify_render.py <mp4> <score.wav> <out_dir> <tag>
#   writes <out_dir>/contact-<tag>.jpg (one frame per second, 6x10 grid, labelled)
#          <out_dir>/frames-<tag>/t_XX.000s_fNNNNN.jpg (every 3 s, full 1920x1080)
#   prints one JSON line "VERIFY {...}"
import sys, os, re, json, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

_FF_DEFAULT = r'C:\Users\User\anaconda3\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
FF = os.environ.get('MEDX_FFMPEG') or (_FF_DEFAULT if os.path.exists(_FF_DEFAULT) else 'ffmpeg')
mp4, wav, out_dir, tag = sys.argv[1:5]


def ff(args, inp=None):
    p = subprocess.run([FF, '-hide_banner', *args], input=inp, capture_output=True)
    return p.stdout, p.stderr.decode('utf-8', 'replace'), p.returncode


def last_time(stderr):
    m = re.findall(r'time=(\d+):(\d+):([\d.]+)', stderr)
    if not m:
        return None
    h, mi, s = m[-1]
    return int(h) * 3600 + int(mi) * 60 + float(s)


# ---- stream facts (ffprobe is not shipped with imageio-ffmpeg; parse ffmpeg -i)
_, info, _ = ff(['-i', mp4])
dur = re.search(r'Duration: (\d+):(\d+):([\d.]+)', info)
container_dur = int(dur.group(1)) * 3600 + int(dur.group(2)) * 60 + float(dur.group(3))
vline = re.search(r'Stream #\S+.*Video: (.+)', info).group(1).strip()
aline = re.search(r'Stream #\S+.*Audio: (.+)', info)
aline = aline.group(1).strip() if aline else None
fps = float(re.search(r'([\d.]+) fps', vline).group(1))
res = re.search(r'(\d{3,5})x(\d{3,5})', vline)
W, H = int(res.group(1)), int(res.group(2))
_, vs, _ = ff(['-i', mp4, '-map', '0:v:0', '-c', 'copy', '-f', 'null', '-'])
vframes = int(re.findall(r'frame=\s*(\d+)', vs)[-1])
vdur = vframes / fps
_, as_, _ = ff(['-i', mp4, '-map', '0:a:0', '-c', 'copy', '-f', 'null', '-'])
adur_copy = last_time(as_)

# ---- audio: decode the AAC, compare with the score
SR = 48000
araw, _, _ = ff(['-i', mp4, '-map', '0:a:0', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'])
A = np.frombuffer(araw, np.float32).reshape(-1, 2).mean(1)
sraw, _, _ = ff(['-i', wav, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'])
S = np.frombuffer(sraw, np.float32).reshape(-1, 2).mean(1)
adur_decoded = len(A) / SR


def xcorr_offset(a, b, t0, t1, maxlag=0.05):
    """lag (s) of a relative to b over [t0, t1]; positive = a is late."""
    i0, i1 = int(t0 * SR), int(t1 * SR)
    seg_b = b[i0:i1]
    L = int(maxlag * SR)
    best, bl = -1e18, 0
    for lag in range(-L, L + 1, 4):
        seg_a = a[i0 + lag:i1 + lag]
        if len(seg_a) != len(seg_b):
            continue
        c = float(np.dot(seg_a, seg_b))
        if c > best:
            best, bl = c, lag
    for lag in range(bl - 4, bl + 5):  # refine to 1 sample
        seg_a = a[i0 + lag:i1 + lag]
        if len(seg_a) == len(seg_b):
            c = float(np.dot(seg_a, seg_b))
            if c > best:
                best, bl = c, lag
    return bl / SR


def onset(x, t0, t1, thr_db=-50):
    """first sample in [t0, t1] whose |x| exceeds thr_db dBFS."""
    i0, i1 = int(t0 * SR), int(t1 * SR)
    seg = np.abs(x[i0:i1])
    idx = np.nonzero(seg > 10 ** (thr_db / 20))[0]
    return (i0 + idx[0]) / SR if len(idx) else None


def rms_db(x, t0, t1):
    seg = x[int(t0 * SR):int(t1 * SR)]
    return float(20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12))


sync = {
    'xcorrLagMs_6to10s': round(xcorr_offset(A, S, 6, 10) * 1000, 3),
    'xcorrLagMs_26to30s': round(xcorr_offset(A, S, 26, 30) * 1000, 3),
    'xcorrLagMs_48to52s': round(xcorr_offset(A, S, 48, 52) * 1000, 3),
    'impactOnsetSec_mp4': onset(A, 7.85, 8.3),
    'impactOnsetSec_score': onset(S, 7.85, 8.3),
    'silence7_80to7_95Dbfs_mp4': round(rms_db(A, 7.80, 7.95), 1),
    'rmsDbfs_mp4_vs_score_10to50s': [round(rms_db(A, 10, 50), 2), round(rms_db(S, 10, 50), 2)],
}

# ---- video: luma trace around the visual anchors (black breath 7.75-8.0 -> bloom at 8.0; hard cut at 28.0)
def luma_trace(t0, t1, w=96, h=54):
    raw, _, _ = ff(['-ss', f'{t0:.4f}', '-i', mp4, '-t', f'{t1 - t0:.4f}', '-map', '0:v:0',
                    '-vf', f'scale={w}:{h}:flags=area,format=gray', '-f', 'rawvideo', '-'])
    fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
    return fr


def frame_index_of(t0, k):
    return int(round(t0 * fps)) + k


tr = luma_trace(7.5, 8.5)
means = tr.mean((1, 2))
dark = [frame_index_of(7.5, k) for k, m in enumerate(means) if m < 8]
diffs = np.abs(np.diff(tr, axis=0)).mean((1, 2))
jump8 = frame_index_of(7.5, int(np.argmax(diffs)) + 1)
tr28 = luma_trace(27.8, 28.2)
d28 = np.abs(np.diff(tr28, axis=0)).mean((1, 2))
jump28 = frame_index_of(27.8, int(np.argmax(d28)) + 1)
visual = {
    'darkFrames_7_5to8_5': [min(dark), max(dark)] if dark else None,
    'darkSec': [round(min(dark) / fps, 3), round((max(dark) + 1) / fps, 3)] if dark else None,
    'biggestChangeFrame_7_5to8_5': jump8, 'biggestChangeSec_7_5to8_5': round(jump8 / fps, 4),
    'biggestChangeFrame_27_8to28_2': jump28, 'biggestChangeSec_27_8to28_2': round(jump28 / fps, 4),
    'meanLumaBeforeAfter8s': [round(float(means[max(0, jump8 - frame_index_of(7.5, 0) - 1)]), 1), round(float(means[min(len(means) - 1, jump8 - frame_index_of(7.5, 0) + 5)]), 1)],
}

# ---- contact sheet: one frame per second (frame n = k*fps), 6 x 10
os.makedirs(out_dir, exist_ok=True)
tw, th = 320, 180
step = int(round(fps))
raw, _, _ = ff(['-i', mp4, '-map', '0:v:0', '-vf', f"select='not(mod(n\\,{step}))',scale={tw}:{th}:flags=lanczos",
                '-fps_mode', 'passthrough', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'])
thumbs = np.frombuffer(raw, np.uint8).reshape(-1, th, tw, 3)
cols, rows, pad, lab = 6, 10, 10, 20
sheet = Image.new('RGB', (cols * (tw + pad) + pad, rows * (th + lab + pad) + pad), (15, 30, 46))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype(r'C:\Windows\Fonts\segoeui.ttf', 14)
except OSError:
    font = ImageFont.load_default()
for k, im in enumerate(thumbs[:cols * rows]):
    x = pad + (k % cols) * (tw + pad)
    y = pad + (k // cols) * (th + lab + pad)
    sheet.paste(Image.fromarray(im), (x, y))
    d.text((x, y + th + 2), f'{k:02d}.00 s  frame {k * step}', fill=(238, 243, 246), font=font)
contact = os.path.join(out_dir, f'contact-{tag}.jpg')
sheet.save(contact, quality=88)

# ---- full-size stills every 3 s
fdir = os.path.join(out_dir, f'frames-{tag}')
os.makedirs(fdir, exist_ok=True)
for f in os.listdir(fdir):
    if f.endswith('.jpg'):
        os.remove(os.path.join(fdir, f))
s3 = 3 * step
raw, _, _ = ff(['-i', mp4, '-map', '0:v:0', '-vf', f"select='not(mod(n\\,{s3}))'", '-fps_mode', 'passthrough',
                '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'])
stills = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
still_files = []
for k, im in enumerate(stills):
    n = k * s3
    p = os.path.join(fdir, f't_{k * 3:02d}.000s_f{n:05d}.jpg')
    Image.fromarray(im).save(p, quality=92)
    still_files.append(p)

print('VERIFY ' + json.dumps({
    'file': mp4, 'bytes': os.path.getsize(mp4), 'MB': round(os.path.getsize(mp4) / 1e6, 2),
    'containerDurationSec': container_dur, 'videoFrames': vframes, 'fps': fps, 'videoDurationSec': round(vdur, 4),
    'audioDurationSecCopy': adur_copy, 'audioDurationSecDecoded': round(adur_decoded, 4),
    'width': W, 'height': H, 'video': vline, 'audio': aline,
    'sync': sync, 'visual': visual,
    'contactSheet': contact, 'contactThumbs': int(len(thumbs)), 'stillsDir': fdir, 'stills': len(still_files),
}))
