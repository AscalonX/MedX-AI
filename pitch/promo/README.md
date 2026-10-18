# MedX promo film: source and re-render

The 60-second launch film "MedX: Every word, understood." is a web page: `index.html` with a paused GSAP timeline.
`render.mjs` turns that page into an MP4, frame by frame, in headless Chromium. Rendering is deterministic, so the same page and assets always give the same frames.

- **Published film:** `apps/web/public/media/medx-promo.mp4`, the final cut after fix round 6 (render r6, 18 Oct 2026 08:51). It is 60.000 s and 3600 frames at 1920x1080 and 60 fps, H.264 High yuv420p plus AAC-LC 48 kHz stereo. Size 19.56 MB (19,560,577 bytes). Loudness -14.3 LUFS, true peak -1.6 dBTP. Poster: `apps/web/public/media/medx-promo-poster.jpg` (59.6 s).
- **Report:** `docs/reports/w20-promo.md` (checks, critic rounds, risks).
- **Claim boundary:** research prototype, synthetic data, not a medical device. The film never says MedX diagnoses, prescribes or decides urgency. The only statistic comes from README "Why" (Divi et al. 2007), and its source is on screen.

## One command

```bash
npm --prefix pitch/promo install                 # once: playwright, gsap, @fontsource, qrcode (pinned)
npm --prefix pitch/promo exec -- playwright install chromium   # once: the headless Chromium build
node pitch/promo/rerender.mjs                    # full render -> pitch/promo/out/medx-promo.mp4 + poster
```

`rerender.mjs` does four things in order. Any other flag goes straight to `render.mjs`.

| Step | What runs | When |
|---|---|---|
| 1. vendor | `setup-vendor.mjs` copies `gsap.min.js` into `vendor/` (fonts are committed) | only if a file is missing |
| 2. score | `python -I audio/make_score.py` writes `audio/score.wav` (about 30 s) | only if missing, and not for `--frames-only` / `--serve` / `--no-audio` |
| 3. assets | `tools/sync-assets.mjs` copies the UI stills from **`apps/web/public/landing/*.webp`** into `assets/ui/` under the same names, the logo from `docs/design/logo/`, and regenerates the QR | every run (skip with `--no-sync`) |
| 4. render | `render.mjs` with your flags | always |

Useful variants:

| Goal | Command | Output (in `pitch/promo/out/`) |
|---|---|---|
| Check layout at a glance | `node pitch/promo/rerender.mjs --frames-only` | `contact-sheet.jpg` (one still per second) + `frames/` |
| Check exact moments | `node pitch/promo/rerender.mjs --frames-only --times 8,10.4,36,58` | same, at those times |
| Watch the motion fast | `node pitch/promo/rerender.mjs --preview` | `medx-promo-preview.mp4` (every 4th frame, full audio) |
| One shot only | `node pitch/promo/rerender.mjs --from 28 --to 32` | `medx-promo_28.000-32.000s.mp4` |
| Scrub in a browser | `node pitch/promo/rerender.mjs --serve` | http://127.0.0.1:5179/index.html |
| The published cut | `node pitch/promo/rerender.mjs --max-mb 20`, then the audio remux below | `medx-promo.mp4` (over the cap it re-encodes 2-pass to fit) + `medx-promo-master.mp4` |
| All renderer flags | `node pitch/promo/render.mjs --help` | |

**How the published film was made (render r6).** The first step was `node render.mjs --max-mb 20`.
- The streamed CRF 18 encode came out at 39.95 MB. The renderer therefore re-encoded it 2-pass at 2308 kbit/s to 19.56 MB.
- The run took 620.8 s on an i5-13420H + RTX 4050: capture 179 s (49.8 ms/frame), QC 21 s, 2-pass 256 s and the high-bitrate master 159 s.
- The QC gate checked 3600 frames and found 0 candidates. The determinism check gave 3 bit-exact frames and 1 within raster noise (max 1/255).

That plain encode measured -0.9 dBTP, which is over the -1.0 dBTP target. So the video stream was kept bit-exact and only the score was re-encoded, 0.2 dB lower. The command, with `out/medx-promo-plain.mp4` being the renderer's `out/medx-promo.mp4` renamed:

```bash
ffmpeg -i out/medx-promo-plain.mp4 -t 60 -i audio/score.wav -map 0:v:0 -map 1:a:0 -c:v copy \
  -af "volume=-0.2dB,apad" -c:a aac -b:a 256k -ar 48000 -ac 2 -t 60 -movflags +faststart out/medx-promo.mp4
```

Re-running this command on the r6 plain encode with ffmpeg 7.1 gave a file byte-identical to the published one (MD5 `4ca208da2b54b01366b0f0edabd67857`). The AAC peak overshoot does not change steadily with gain: trims of -0.1, -0.15, -0.2 and -0.3 dB gave -1.09, -0.30, -1.61 and -1.49 dBTP. After any change, measure the actual file with `ffmpeg -i out/medx-promo.mp4 -vn -af ebur128=peak=true -f null -`.

## Dependencies

| What | Version | Licence | Used for |
|---|---|---|---|
| Node.js | tested on 22.18 | | `render.mjs`, `rerender.mjs`, tools |
| `playwright` | 1.56.1 | Apache-2.0 | headless Chromium 141 that captures the frames |
| `gsap` | 3.12.5 | GSAP Standard "no charge" licence | the timeline (`vendor/gsap.min.js`, copied from npm, not committed) |
| `@fontsource/plus-jakarta-sans`, `@fontsource/noto-sans-thai` | 5.1.0 | OFL-1.1 | fonts; the woff2 files, `fonts.css` and both licences are committed in `fonts/` |
| `qrcode` | 1.5.4 | MIT | `assets/data/qr.svg` (https://medx.areazeroai.com, ECC M). The committed copy is used if the package is missing |
| Python 3 + numpy | numpy 2.1.3 tested | | `audio/make_score.py` (the score is generated by our own code: no samples, no third-party music) |
| ffmpeg | 7.1 tested | | encoding (on PATH, or set `MEDX_FFMPEG`) |

Environment variables (all optional):

| Variable | Default | Meaning |
|---|---|---|
| `MEDX_PYTHON` | `python` | Python with numpy, for the score |
| `MEDX_FFMPEG` | `ffmpeg` on PATH | ffmpeg binary |
| `MEDX_TOOLS` | `pitch/promo` | a folder whose `node_modules` has playwright / gsap / qrcode (lets you reuse an install elsewhere) |
| `MEDX_REPO` | two levels above `pitch/promo` | the MedX-AI checkout (landing stills, logo) |
| `MEDX_SHOTS` | `assets/ui-verified/` | folder with the w20 full-page captures (`case.png`, `consult-full.png`, `pverify*.png`, `pdisp*.png`); these are not in the repo, so the frozen copies are used |
| `MEDX_BRAND` | (committed PNGs) | brand-out folder to refresh `assets/brand/fin3d-*-512.png` |
| `MEDX_CHROME_ARGS` | | extra Chromium flags |

Nothing is fetched from the network at render time.

## After a UI change: when one command is enough

UI stills are read by **file name** from `apps/web/public/landing/`. `assets.js` is the one map of every image, and every crop in it is a component box in native pixels of the still it was measured on (`native`). Five UI stills are loaded today:
- `patient-intake.webp`: the 3x phone capture, 1170x2532, shown whole in S06 (centre), S07 and S17;
- `patient-pickup-phone.webp`: the 3x phone capture, 1170x2532, shown whole in S13;
- `nurse-case.webp`: the S08 triage card;
- `case.png` and `consult-full.png`: the w20 full-page captures, served from `assets/ui-verified/`.

`patient-voice`, `patient-pickup`, `consult`, `pharmacy-verify`, `pverify-full` and `hero-consult` are mapped under `retired` in `assets.js` and are not loaded.

- **Same layout** (same aspect ratio and a clean pixel ratio of 1x, 1.25x, 1.5x, 2x, 2.5x or 3x of `native`, for example a sharper 2x capture of the same page): every box is scaled, so the crops land on the same components. `node pitch/promo/rerender.mjs` is the whole job.
- **Changed layout** (another aspect, or an odd ratio): the boxes no longer fit. The film keeps rendering the frozen copy from `assets/ui-verified/` and prints `[promo] asset warnings` naming the still. Re-measure the boxes (`python -I tools/measure.py <img> x0 y0 x1 y1`), update `native` and the boxes in `assets.js`, check `--frames-only`, then render.
- **State on 18 Oct 2026, 09:00 (render r6).**
  - The two 3x phone stills in `apps/web/public/landing/` are byte-identical to the ones the film was rendered with, and to their frozen copies.
  - `nurse-case.webp` is 828x622, a 414 CSS px bento crop rather than the measured 1000x752 layout. Its confirmed title wraps and its confirmed box is clipped at the bottom. So S08 renders the frozen copy and every run prints one `[promo] asset warnings` line. That warning is expected.
  - A re-render today reproduces the published film.
- `node tools/refreshtest.mjs 15 out.png` previews a refresh against the repo's current landing stills without touching `assets/`.

Four plates are token-based CSS recreations with the exact app copy, because their 1x stills rendered body text at 9-13 px: the S10 draft and signed note, the S11 Options plate, the S16 allergy entry and the S17 Live summary. Their still entries sit in `assets.js` under `retired` and are not loaded. Move one back into `ui` to use a 2x still again. The Thai and Italian S06 phones are CSS recreations on the same 390x844 app grid, and they use the exact `apps/mobile` i18n copy.

**Fix rounds.** `storyboard.json` `revisions` lists every change, in rounds fix-1, fix-2, fix-4 and fix-6. The last round, fix-6, changed only the framing of S10-S12. Shot timing, cut points, beats and copy stayed the same.
- **S10:** a slow macro push onto the "Note signed" stamp.
- **S11:** a tilted plate seen from low and to the side.
- **S12:** the pharmacist rings start in the foreground, and the focus racks to the checklist and back.

## Files

| File | What it is |
|---|---|
| `index.html`, `styles.css`, `timeline.js`, `assets.js` | the composition (byte-identical to the render that produced the published film) |
| `storyboard.json` / `storyboard.md` | shot list, timing, music and SFX cues, compliance rules and the fix-round `revisions` (source of truth) |
| `render.mjs` | the renderer (Playwright + Chromium + ffmpeg) with built-in checks |
| `rerender.mjs` | the one-command wrapper above |
| `setup-vendor.mjs` | copies gsap (and fonts, if missing) from `node_modules` |
| `audio/make_score.py`, `audio/score-meta.json` | the score generator and the measured loudness of its output |
| `assets/ui-verified/` | frozen copies of the stills the crop boxes were measured on (also the w20 full-page captures) |
| `assets/brand/`, `assets/data/qr.svg` | the two Fin 3D poses used (listening, pointing) and the QR |
| `tools/` | `sync-assets.mjs`, `measure.py` (component boxes), `refreshtest.mjs`, `detcheck.mjs` (determinism probe), `readcheck.mjs` (every headline must be fully readable for at least 1.2 s; writes `out/readcheck.json`), `edgecheck.mjs` (visible text may cross the frame edge only during transitions; writes `out/edgecheck.json`), `probe.mjs`, `grid.py`, `verify_render.py` (independent check of a finished MP4: stream facts, A/V sync, contact sheet) |
| `preview.html` | browser preview with a scrubber |

Generated and git-ignored: `node_modules/`, `vendor/`, `assets/ui/`, `assets/logo/`, `audio/score.wav`, `out/`.

Compared with the working copy the film was rendered from, only the path handling changed: package lookup defaults to `pitch/promo` (`render.mjs`, `setup-vendor.mjs`, `tools/*.mjs`), `sync-assets.mjs` and `refreshtest.mjs` use repo-relative roots, `readcheck.mjs` and `edgecheck.mjs` create `out/` if it is missing, and `verify_render.py` falls back to `ffmpeg` on PATH. `rerender.mjs`, `package.json` and `.gitignore` are new.

## Render settings and checks

- **Video:** H.264 High, yuv420p, BT.709 limited range (tagged), `-preset slow -tune film`, keyframe every 2 s plus a forced IDR on every shot change in `window.__keyframes`, `+faststart`.
- **Audio:** `audio/score.wav` (48 kHz stereo, 60.0 s, -14.0 LUFS integrated, WAV true peak -2.4 dBTP) as AAC-LC 256k, padded or trimmed to the video length.
  - The AAC encode adds peak: the renderer's plain encode measures -14.1 LUFS and -0.9 dBTP.
  - The published MP4 therefore carries the remuxed audio described above. ffmpeg `ebur128=peak=true` measured **-14.3 LUFS, LRA 6.2 LU, true peak -1.6 dBTP**.
  - `audio/make_score.py` regenerates the score bit-identically (SHA-256 starts `235b9ed50e612dcb`).
- **Poster:** captured straight from Chromium at `window.__posterTime` (59.6 s), so it has no encode artefacts.
- **Built-in checks, which fail loudly:** console or page errors and missing assets; the stage must be 1920x1080 at (0, 0); no CSS or Web animations and no `<video>` outside the GSAP timeline; determinism (4 frames captured forwards, backwards and on a second page must match within 4/255); and a frame QC gate that re-captures any one-frame flash or black frame. Every run writes `out/render-report.json` and prints a `RESULT {...}` line.

## Contract between the renderer and the composition

- `window.__duration = 60`, `window.__fps = 60`, plus optional `window.__posterTime` and `window.__keyframes`.
- `async window.__ready()` resolves when the fonts and every image are decoded.
- `window.__seek(t)` is pure: it sets everything to time `t` on the paused master timeline, and a backward jump replays from 0. It uses no `Date.now`, unseeded `Math.random`, CSS transitions, rAF loops or `<video>`. The renderer installs a seeded `Math.random`.
- The stage (`#stage`) renders unscaled at 1920x1080. The renderer loads `index.html?render=1` and sets `window.__RENDER = true`.

## Troubleshooting

- **The page crashed or the GPU was lost:** use `--workers 2`, or `--cpu` (software raster, about 9x slower).
- **Stale or flickering frames:** never use `--settle 0`.
- **A single black or half-painted frame:** the QC gate re-captures it. If it keeps coming back, look for `mix-blend-mode` inside a 3D-transformed, masked or clipped parent.
- **Slow:** the `ready:` log line should name a real GPU, not SwiftShader.
