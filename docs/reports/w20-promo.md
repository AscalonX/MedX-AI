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

---

## Final fix round (18 Oct 2026, 09:00): render r6 integrated

### STATUS
done.
- The final cut (render r6, after fix round 6) replaces the r3 film and poster in `apps/web/public/media/`.
- `pitch/promo/` is updated to the source that rendered it.
- Both critics passed the final round, with 0 high findings.
- Nothing is committed or pushed.

### SUMMARY
- **Fix round 6** changed only the framing of S10-S12. Shot timing, cut points, beats and copy are unchanged, so 23-36 s no longer repeats "headline plus one flat card":
  - **S10:** a slow macro push onto the "Note signed" stamp.
  - **S11:** a tilted plate seen from low and to the side.
  - **S12:** the pharmacist rings start in the foreground, and the focus racks to the checklist and back.
- **Earlier rounds since r3:**
  - **fix-4:** honest S03 bars on one 0-100% track, one headline system, no in-place cross-fades, Fin removed from S17, and the 3x phone captures.
  - **r5:** the asset sync of the w20-video "Final cut" stills, and the true-peak fix.
- **Published.** `apps/web/public/media/medx-promo.mp4` and `medx-promo-poster.jpg` are byte-identical to the workspace output (same SHA-256). The landing paths are unchanged (`site.ts` `PROMO_PATH`, `PROMO_POSTER_PATH`).
- **Source.** `pitch/promo/` has 60 files and 3.3 MB.
  - The composition (`index.html`, `styles.css`, `timeline.js`, `assets.js`, `storyboard.json`/`.md`) is byte-identical to the workspace.
  - `render.mjs`, `preview.html`, `audio/make_score.py` and `setup-vendor.mjs` did not change in the workspace since r3, so the repo copies stay as they were. Their only difference from the workspace is path handling.
  - New in the repo: the two frozen 3x stills and the two fix-round-4 probes (`tools/readcheck.mjs`, `tools/edgecheck.mjs`). The probes carry the same path-only patch: the package lookup uses `MEDX_TOOLS` or `pitch/promo`, and they create `out/` if it is missing.
  - `tools/sync-assets.mjs` now also copies `patient-intake.webp` and `patient-pickup-phone.webp`, with a fallback to the frozen copies.
  - The README documents the published-cut recipe: `--max-mb 20`, then the -0.2 dB audio remux.

### FILES CHANGED
- `apps/web/public/media/medx-promo.mp4`: replaced (r3, 24.35 MB, by r6, 19.56 MB).
- `apps/web/public/media/medx-promo-poster.jpg`: replaced.
- `pitch/promo/`:
  - copied from the workspace, byte-identical: `index.html`, `styles.css`, `timeline.js`, `assets.js`, `storyboard.json`, `storyboard.md`;
  - new frozen stills: `assets/ui-verified/patient-intake.webp`, `assets/ui-verified/patient-pickup-phone.webp`;
  - new tools: `tools/readcheck.mjs`, `tools/edgecheck.mjs`;
  - edited: `tools/sync-assets.mjs` (two stills added) and `README.md` (r6 facts, the published-cut recipe, the loaded stills, fix rounds, tools).
- `docs/reports/w20-promo.md`: this section appended. The sections above are unchanged.

Outside the repo, I wrote only check renders, in `C:\Users\User\medx-tools\promo\out\integ-check*` and in the session scratchpad. I did not edit any workspace source.

### TESTS RUN + RESULTS
**The copied MP4, measured by me with ffmpeg 7.1:**

| Check | Result |
|---|---|
| Size | **19,560,577 bytes (19.56 MB)**. SHA-256 `1ac67310128044c57888181f2c9630c511119d639785dbdfaecd377280a4e4d8`, same as `out/medx-promo.mp4` |
| Container | duration **00:01:00.00**, 2608 kb/s overall |
| Video | H.264 High, yuv420p, tv range, BT.709, progressive, **1920x1080, 60 fps**, 2330 kb/s |
| Audio | AAC-LC, 48 kHz, stereo, 264 kb/s |
| Decode check | `ffmpeg -v error -xerror -i medx-promo.mp4 -map 0:v:0 -map 0:a:0 -f null -` exited 0 with no error output. The full decode gave **3600 video frames** (60.00 s) and the audio decoded to 60.01 s |
| Loudness (`ebur128=peak=true`) | **-14.3 LUFS** integrated (target -14), LRA 6.2 LU, true peak **-1.6 dBTP** (target at or below -1.0: **met**; r3 missed at -0.9) |
| QR | OpenCV decoded `https://medx.areazeroai.com` from the repo poster and from the MP4 frame at 58.5 s |
| Poster | 1920x1080, 367,282 bytes, SHA-256 `d46d933a1ada8ebc165c02b941cabfbe636755c6b3dfdf6f90785f5d13075738`. Byte-identical to the r5 poster, as expected: fix round 6 did not touch the end card. I looked at it: the lockup, the tagline, "Try the live demo", the URL, the QR, "Scan to try", Fin on the end card only, and the claim line "Research prototype · Synthetic data · Not a medical device". No store badges |

**From the render pipeline's own record** (`out/verify-final.json`, `out/render-report.json`, render r6):
- **Stream structure:** 3600 samples in one stts entry, 41 sync samples (20 forced IDRs on shot changes), faststart (`ftyp`, `moov`, `free`, `mdat`).
- **A/V sync:** the cross-correlation lag against the score is 0.0 ms at 6-10 s, 26-30 s and 48-52 s. The impact onset is at 8.0 s in both the MP4 and the score. The 7.80-7.95 s silence measures -240 dBFS.
- **Frame QC:** 3600 frames checked, 0 candidates.
- **Determinism:** 3 frames bit-exact, 1 within raster noise (max 1/255).
- **Hard cut:** the biggest change in 27.8-28.2 s is at 28.0 s (frame 1680), the S10-to-S11 cut.

**Is the workspace source the one that rendered this MP4?**
- The workspace's `index.html`, `styles.css` and `timeline.js` were last modified at 08:52:48, after the render (08:50).
- My frames rendered from the current source are md5-identical to the `out/r6-src-new` snapshot. They differ from the `out/r6-src-old` snapshot at 25.6 s and 26.2 s, in a region of about x 912-1797, y 290-693.
- In that region, the MP4's decoded frames differ from the current source by a mean of 5.7 and 6.2 per channel. They differ from the other snapshot by 17.3 and 22.8.
- So the copied source is the version that rendered the film.

**Re-render from the repo copy.** I ran this in a scratchpad copy of `pitch/promo`, with `MEDX_REPO` set to this checkout and `MEDX_TOOLS` set to `C:\Users\User\medx-tools`.
- **The command:** `node rerender.mjs --frames-only --times` with 24 times (each shot, plus 26.4 / 27.4 / 27.9 / 28.7 / 30.7 / 32.5 / 33.1 / 35.2 for fix round 6).
  - It exited 0.
  - The vendor step copied 13 files.
  - The asset sync copied 20 files and regenerated the QR.
  - The only warning was the expected `nurse-case` asset warning.
- **Against the same 24 times rendered in the workspace:**
  - 20 frames were bit-identical. The other 4 differed by at most 10, 5, 3 and 6 /255, with means of 0.0012-0.0150.
  - Those 4 are run-to-run GPU raster noise, not a source difference:
    - two workspace runs also differ by max 10/255 at 15.5 s;
    - a second run of the repo copy at 19.5, 22.4 and 27.4 s was bit-identical to two further workspace runs.
- **Published-cut recipe:** re-running the documented remux on the r6 plain encode reproduced the published MP4 **byte for byte** (MD5 `4ca208da2b54b01366b0f0edabd67857`). The video stream MD5 is `014f147e…62be7` and the audio packet MD5 is `07f61841…96e2`.
- **Score:** `audio/score.wav` SHA-256 starts `235b9ed50e612dcb`, the same score as r3. `make_score.py` is unchanged.
- **Static checks:** `node --check` passes on `tools/sync-assets.mjs`, `tools/readcheck.mjs` and `tools/edgecheck.mjs`. `node pitch/promo/tools/sync-assets.mjs --dry-run`, run in the repo, resolves both 3x stills from `apps/web/public/landing` and writes nothing.

**Critic verdicts, final round.** These are counts only, as the workflow passed them to me; I did not see the finding texts.

| Round | Render reviewed | Critic A | Critic B |
|---|---|---|---|
| final (after fix round 6) | r6, the published file | **pass**, high 0, medium 1 | **pass**, high 0, medium 0 |

Rounds 1 and 2 failed (16 and 7 findings, see above). The verdicts for the rounds in between were not passed to me.

### EVIDENCE
- **Published:**
  - `apps/web/public/media/medx-promo.mp4` (19,560,577 bytes);
  - `apps/web/public/media/medx-promo-poster.jpg` (367,282 bytes).
- **Render r6 timing:** 620.8 s in total on the i5-13420H + RTX 4050.
  - Capture took 179 s at 49.8 ms/frame.
  - The CRF 18 stream was 39.95 MB, so the renderer re-encoded it 2-pass at 2308 kbit/s to 19.56 MB (256 s).
  - The high-bitrate master (78.41 MB, CRF 14, AAC 320k) stays outside the repo at `C:\Users\User\medx-tools\promo\out\medx-promo-master.mp4`.
- **Review material, outside the repo:**
  - `C:\Users\User\medx-tools\promo\out\contact-final.jpg` (60 thumbnails from the MP4);
  - `out\frames-final\` (20 stills);
  - `out\r6-evidence\` (S10-S12 stills and `sheet-23-36.jpg`);
  - `out\verify-final.json`, `out\render-r6.log`.
- **My check renders:** `C:\Users\User\medx-tools\promo\out\integ-check\`, `integ-check2\`, `integ-check3\` and `integ-check4\`.

### ASSUMPTIONS
- The two critic verdicts `[{pass:true,high:0,medium:1},{pass:true,high:0,medium:0}]` refer to this r6 file.
- **Size figure.** The workflow's render summary quoted 19.57 MB. That is the r5 file (19,568,214 bytes). The r6 file I published measures 19,560,577 bytes (19.56 MB), and the report uses that number.
- **True-peak target.** The -1.0 dBTP target is met by remuxing the audio at -0.2 dB. The score itself was not changed: the score WAV is the same as in r3, and the plain encode still measures -0.9 dBTP.
- **Frozen stills.** Committing the two 3x stills (178 KB together) to `assets/ui-verified/` follows the r3 integration's practice. It keeps a re-render reproducible if the landing stills change.

### RISKS
1. **One open medium finding** from critic A. I do not know what it says.
2. **S08 shows an older triage-card layout.** `nurse-case.webp` on the landing is a different layout (828x622, its confirmed box is clipped). S08 therefore renders the frozen 1000x752 copy, which has the same app copy, and every render prints one expected warning.
3. **The published cut takes two steps.** The plain `rerender.mjs` output is at -0.9 dBTP, so the remux in `pitch/promo/README.md` must follow. Re-measure after any change: the AAC overshoot does not change steadily with gain.
4. **Count-up frames.** Frames around 5 s still show intermediate values before the sourced 49.1% / 29.5%.
5. **Repo size.** A 19.56 MB binary in git, with no LFS. That is under both the 25 MB cap and GitHub's 50 MB warning.
6. **Still open from earlier rounds:**
   - a native-speaker check of the Thai line (synthetic case MED-01) and its gloss;
   - medx.areazeroai.com must be live when the film is published.

### OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- No contract change requested (`packages/shared` untouched).
- What is critic A's medium finding, and should it be fixed before submission?
- A descriptive `/media/medx-promo.en.vtt` is still not added, because the film has no voice-over. Does the landing owner want one?

### NEXT ACTION
1. The orchestrator reviews the diff and commits these paths:
   - `apps/web/public/media/medx-promo.mp4`
   - `apps/web/public/media/medx-promo-poster.jpg`
   - `pitch/promo/**`
   - `docs/reports/w20-promo.md`
2. Rebuild the landing, and check the promo plays with sound on the deployed site.
3. If critic A's medium finding needs a fix: re-render with `node pitch/promo/rerender.mjs --max-mb 20`, apply the remux, re-measure with `ebur128=peak=true`, then copy the film and poster over the files in `apps/web/public/media/`.
