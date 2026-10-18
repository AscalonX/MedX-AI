# w20 · Promo film (60 s launch film): integration

## STATUS
partial.
- **Done:** all three integration steps. The film and poster are published, the source is copied into the repo and re-renders with one command, and this report is written.
- **Technical spec:** the film meets every hard technical rule except one. The MP4's true peak is -0.9 dBTP, 0.1 dB over the -1.0 dBTP target.
- **Quality gate: not passed.** Critic round 1 failed (16 findings) and round 2 failed (7 findings). The final render, made after fix round 2, has not been reviewed by the critic.
- Nothing is committed or pushed.

## SUMMARY
- **What the film is.** "MedX: Every word, understood." A 60.0 s launch film, 1920x1080 at 60 fps, with an original score.
  - Story: a Thai patient line, then the language-gap statistic, then the reveal, then the care journey (patient, nurse, doctor, pharmacist 1 verify/return, pharmacist 2 two-person check, pickup), then the trust beats (rules before any model, "Needs check", append-only log), then the callback.
  - CTA and end card: "Try the live demo", medx.areazeroai.com and a QR code. No store badges. The claim line reads "Research prototype · Synthetic data · Not a medical device".
- **Published (step 1).**
  - `apps/web/public/media/medx-promo.mp4` (24.35 MB) and `apps/web/public/media/medx-promo-poster.jpg`, byte-identical to the render output (same SHA-256).
  - The landing already looks for these paths (`apps/web/app/_landing/site.ts` `PROMO_PATH`, `data.ts` `videoInfo`), so the promo becomes the primary landing video on the next build. Its `hasAudioTrack` logic finds the AAC track in this file.
  - `.vercelignore` excludes `/pitch/` but not MP4s: the film deploys and the source stays out of the build.
- **Source (step 2).** `pitch/promo/`: 56 files, 3.1 MB.
  - The composition files (`index.html`, `styles.css`, `timeline.js`, `assets.js`, `storyboard.json`/`.md`, `preview.html`, `audio/make_score.py`) are byte-identical to the ones that rendered the film.
  - I changed only path handling, so it runs from the repo: packages resolve from `pitch/promo/node_modules` (or `MEDX_TOOLS`), the asset roots are repo-relative, and ffmpeg falls back to PATH.
  - New files: `rerender.mjs` (the one command), `package.json` (pinned deps) and `.gitignore`.
  - UI stills are read by name from `apps/web/public/landing/*.webp` through `tools/sync-assets.mjs`.
  - The README explains the dependencies, the env vars, and exactly when one command is enough (same layout) and when crops must be re-measured (changed layout).
- **Not committed, on purpose.**
  - `score.wav` (11.5 MB): it regenerates bit-identically in about 30 s.
  - `vendor/gsap.min.js`: GSAP Standard licence, copied from the pinned npm package by `setup-vendor.mjs`.
  - The CRF 14 high-bitrate master (77.94 MB, over the cap): it stays at `C:\Users\User\medx-tools\promo\out\medx-promo-master.mp4`.

## FILES CHANGED
All new. No existing repo file was edited.
- `apps/web/public/media/medx-promo.mp4`
- `apps/web/public/media/medx-promo-poster.jpg`
- `pitch/promo/`:
  - top level: `README.md`, `rerender.mjs`, `package.json`, `.gitignore`, `index.html`, `styles.css`, `timeline.js`, `assets.js`, `storyboard.json`, `storyboard.md`, `render.mjs`, `preview.html`, `setup-vendor.mjs`
  - `audio/make_score.py`, `audio/score-meta.json`
  - `tools/sync-assets.mjs`, `tools/refreshtest.mjs`, `tools/detcheck.mjs`, `tools/probe.mjs`, `tools/measure.py`, `tools/grid.py`, `tools/verify_render.py`
  - `fonts/` (14 woff2, `fonts.css`, 2 OFL licences)
  - `assets/ui-verified/` (14 frozen stills, 2.2 MB)
  - `assets/brand/fin3d-listening-512.png`, `assets/brand/fin3d-pointing-512.png`
  - `assets/data/qr.svg`
- `docs/reports/w20-promo.md`

Nothing was written to `C:\Users\User\medx-tools\promo`. All my test renders ran in the session scratchpad.

## TESTS RUN + RESULTS
**Final MP4, measured independently by me with ffmpeg 7.1:**
- **Container and video:** duration 00:01:00.00. Decoding gives exactly **3600 frames**. 1920x1080, SAR 1:1, H.264 High, yuv420p, tv range, BT.709, progressive, **60 fps**, 2969 kb/s.
- **Audio stream:** AAC-LC, 48 kHz, stereo, 264 kb/s.
- **Loudness (ffmpeg `ebur128=peak=true`):**
  - **-14.1 LUFS** integrated, LRA 6.2 LU. Target -14.
  - **True peak -0.9 dBTP.** Target at or below -1.0, so it misses by 0.1 dB.
  - The workspace README's earlier "-1.7 dBTP" figure does not hold for this file. The repo README states the measured value.
- **QR:** decoded with OpenCV from MP4 frames at 52.5 s and 59.0 s. Both read `https://medx.areazeroai.com`.
- **Statistic:** the on-screen 49.1% vs 29.5% ("adverse events that involved physical harm", limited-English vs English speakers) matches README.md "Why", line 36 (Divi et al., *Int J Qual Health Care* 2007, six US hospitals). The source line is shown small on screen.

**From the render pipeline's own checks** (`render-report.json`, `verify-r3.json`, round 3):
- **Stream structure:**
  - Movie duration is 60000/1000. The video track has 3600 samples in a single stts entry (constant 60 fps).
  - 40 sync samples, of which 20 are forced IDRs on shot changes.
  - Faststart: moov sits before mdat.
- **A/V sync:** cross-correlation against `score.wav` gives a lag of **0 samples** in all three windows (0-12 s, 24-36 s, 44-58 s), with normalised correlation 0.9997, 0.9989 and 0.9995.
- **Determinism:** 4 sampled frames captured forwards, backwards and on a second page were bit-exact.
- **Frame QC:** 3600 frames checked, **0** flash or black-frame candidates.
- **Score WAV** (`score-meta.json`): -14.01 LUFS, -2.4 dBTP. Digital silence at 7.75-8.0, 49.875-50.0 and 59.8-60.0 s, as designed.

**Re-render from the repo copy**, run in a scratch copy of `pitch/promo` with `MEDX_REPO` pointed at this checkout:
- **Contact sheet:** `node rerender.mjs --frames-only --times` (20 times, one per shot) exited 0.
  - The vendor step copied gsap and the asset sync copied 18 files and regenerated the QR, byte-identical to the shipped `qr.svg`.
  - The renderer's determinism check passed: 4 bit-exact.
  - Compared pixel by pixel with the same 20 times rendered from the original workspace: **18 frames bit-identical, 2 frames max 3/255** (mean 0.0001). That is inside the renderer's 4/255 raster-noise tolerance.
- **Score:** `rerender.mjs` regenerated `audio/score.wav` in 28.3 s, **bit-identical** to the score in the film (SHA-256 `235b9ed5…47c6`). A separate run took 33 s, also identical.
- **Range render:** `rerender.mjs --no-sync --from 28 --to 32` exited 0 and gave 4.00 s, 1080p60 H.264 High plus AAC, with QC 240 frames and 0 candidates. Wall time 49 s, including the score.
- **Other checks:**
  - `tools/refreshtest.mjs 15` exited 0 and listed the same three layout warnings (below).
  - `node --check` passes on `render.mjs`, `rerender.mjs` and `tools/sync-assets.mjs`. `verify_render.py` parses.
  - `npm --prefix <copy> exec -- playwright --version` printed 1.56.1, so the README install route resolves the local binary.
  - `node pitch/promo/tools/sync-assets.mjs --dry-run`, run inside the repo, resolves landing, logo and shots from the repo-relative defaults and writes nothing.

**Critic verdicts** (counts only, as passed to me by the workflow; I did not see the finding texts):

| Round | Render reviewed | Verdict | Findings | What changed afterwards (storyboard.json `revisions`) |
|---|---|---|---|---|
| 1 | r1 (21.5 MB, CRF 20) | fail | 16 | fix-1, 7 items: S04 bloom and arc-to-rail match cut, S05 timing, crops as native component boxes, S11 ink grade, payoff legibility, centred end card, score at -14 LUFS through a true-peak limiter |
| 2 | r2 (20.83 MB, CRF 20) | fail | 7 | fix-2, 13 items: punctuation kerning and word spacing, S04 exposure bloom 0.5 s earlier, S05 FLIP into the docked rail, a continuous camera on every hold, specular sweeps, template breaks (S10 macro, S12 low angle, S14 lateral track), four plates rebuilt as CSS with 22 px+ text, S16/S17 transitions, end card build |
| 3 | r3 (final, 24.35 MB) | **not reviewed** | n/a | |

## EVIDENCE
- **Film:**
  - `apps/web/public/media/medx-promo.mp4`: 24,350,142 bytes, SHA-256 `21a54db9b201e36f8f21b643c93c3a96896c507f2db33a0c7e8118fca5065e52`.
  - `apps/web/public/media/medx-promo-poster.jpg`: 1920x1080, 361,058 bytes, frame at 59.6 s, SHA-256 `158c7d754e2edec9b316360b7ad7db40d437b2488c20b3692340cec81c0527d8`.
- **Render timing:** `node render.mjs --crf 20` took 655.7 s on the RTX 4050 laptop.
  - Capture: 175.3 s at 48.7 ms/frame.
  - CRF 20 came out at 29.55 MB, so it was re-encoded 2-pass at 2949 kbit/s to 24.35 MB (291.7 s).
  - High-bitrate master: CRF 14, 77.94 MB (163 s).
- **Visual review material, outside the repo:**
  - `C:\Users\User\medx-tools\promo\out\contact-r3.jpg`: 60 frames, one per second, from the final MP4.
  - `C:\Users\User\medx-tools\promo\out\frames-r3\`: 20 stills, one every 3 s.
  - Logs and reports: `render-r3.log`, `render-report-r3.json`, `verify-r3.json`.
- **My own look at the contact sheet:**
  - The claim line is on the end card and the poster. There are no store badges, emoji or sparkles.
  - Red appears only in S11 (28-31 s, the app's own allergy alert).
  - Fin is on screen at 9-11 s and 51-59 s, away from the alert, plus the app's own small pickup-card icon at 37-38 s.
  - The near-black frames 465-474 (7.75-7.9 s) are the intended pre-reveal "breath". The large luma steps at 28.0, 32.0 and 42.0 s are hard cuts on bar lines, each on a forced keyframe.

## ASSUMPTIONS
- The two critic verdicts `[{pass:false,n:16},{pass:false,n:7}]` belong to renders r1 and r2, in that order, and no round-3 verdict exists.
- Not committing `vendor/gsap.min.js` (its header reads "All rights reserved", GSAP Standard licence) is the safer reading of "vendor builds may be included if small". `rerender.mjs` copies it from the pinned npm package. The OFL fonts are committed together with their licences.
- The three w20 full-page captures that are not in the repo (`case.png`, `consult-full.png`, `pverify*.png`, `pdisp*.png`) are served from the committed frozen copies. `MEDX_SHOTS` swaps in fresh ones.
- The 25 MB cap applies only to the published MP4. The high-bitrate master stays outside the repo.

## RISKS
1. **Unreviewed final cut.** Both critic rounds failed, and the fix-2 changes have not been checked by a critic.
2. **The film shows the UI from before the refresh.** The landing stills were refreshed at 06:45, after the 06:34 render. The three loaded stills changed layout:
   - `nurse-case`: 828x622, measured on 1000x752;
   - `patient-voice`: 1170x1461, measured on 720x900;
   - `patient-pickup`: 1170x900, measured on 720x554.

   A re-render today falls back to the frozen copies and reproduces this film. One command is not enough until those three are re-measured.
   - The CSS recreations (S10 note, S11 alert and Options, S12 checklist, S13 counter card, S14 trace summary, S16 allergy entry, S17 live summary) copy app strings as of 18 Oct. Their fonts are Plus Jakarta Sans and Noto Sans Thai.
   - If the Polish phase changes copy or fonts, these go stale **without any warning**.
3. **True peak -0.9 dBTP**, 0.1 dB over target. It is unlikely to be audible, but it misses the stated spec.
4. **Count-up frames.** The statistic counts up, so frames around 5.0 s briefly show intermediate values (for example 40.4% / 24.3%) before landing on the sourced 49.1% / 29.5%. A strict reviewer may flag this.
5. **Repo size.** The MP4 is a 24.35 MB binary in git with no LFS. It is under the 25 MB cap and GitHub's 50 MB warning. `apps/web/public/media/` is currently untracked as a whole; another workflow also placed `medx-demo.*` there.
6. **Outstanding storyboard questions.** The Thai line (synthetic case MED-01) and its gloss still need a native-speaker check. medx.areazeroai.com must be live when the film is published.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- No contract change requested (`packages/shared` untouched).
- Should a round-3 critic review this cut, or only the planned re-record after Polish?
- The landing looks for an optional `/media/medx-promo.en.vtt`. The film has no voice-over and every message is on-screen text, so I did not add one. Does the landing owner want a descriptive caption track anyway?

## NEXT ACTION
1. After Polish: refresh the landing stills, then re-measure the boxes for `nurse-case`, `patient-voice` and `patient-pickup` in `pitch/promo/assets.js` (`tools/measure.py`, update `native`).
2. Update the CSS recreations if the app copy or fonts changed.
3. Check the layout with `node pitch/promo/rerender.mjs --frames-only`.
4. Regenerate the score with a lower ceiling (`--ceiling -2.8`) to clear the true-peak miss.
5. Render with `node pitch/promo/rerender.mjs --crf 20`, then re-measure with `ffmpeg … ebur128=peak=true`.
6. Run the critic on that cut. If it passes, copy `out/medx-promo.mp4` and the poster over the files in `apps/web/public/media/`.
