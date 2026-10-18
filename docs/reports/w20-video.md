# W20 report: Video producer (60-second product video, landing stills, README screens)

## STATUS
done. Every deliverable is produced and checked:
- `scripts/record-demo.mjs`: reusable, with usage documented at the top of the file.
- A real English walkthrough of the golden case, 60.72 s long.
- Poster and captions.
- 10 fresh landing stills.
- 4 README screens and the README composite.

Nothing committed.

One caveat: the recording used the web build from 02:22 (copied from `.next`). The UI was unchanged after that time; small engine edits made after 02:39 are not in it. The patient web export rebuilt at 03:09 is included.

## SUMMARY
### Video
**File:** `apps/web/public/media/medx-demo.mp4`
- 1280x720, H.264 High, yuv420p, 25 fps, CRF 28, `+faststart`, no audio track.
- 60.72 s long, 3.24 MB (3,239,320 bytes).

**Journey.** 17 captioned steps on one synthetic visit (B-015, DEMO-GOLD, English), each a real click in the UI as that demo persona:
1. **Title card:** brand gradient, 3D Fin on the light disc, white lockup, "Every word, understood."
2. **Patient intake** on `/patient`, shown in a phone frame:
   - picks the "Try saying" synthetic example (penicillin allergy) and checks it before sending;
   - then the visit code screen.
3. **Nurse:**
   - the new visit in the review queue;
   - the case: selecting Allergies highlights "penicillin, it gave me a rash" in the patient's words, then "Approve supported fields (7)";
   - vitals from DEMO-GOLD, then "Suggested triage level 3" (NEWS2), confirmed.
4. **Doctor:**
   - "Ready for doctor" opens the consult; Peritonsillar abscess is "Kept in note";
   - the signed note receipt.
5. **Order:** amoxicillin 500 mg gives the deterministic High "Allergy conflict" with "Options to review" (clarithromycin, doxycycline).
6. **Pharmacist 1** returns the order with a note and clarithromycin as an option for prescriber review.
7. **Doctor** uses "Edit with clarithromycin", re-checks and resubmits.
8. **Pharmacist 1** verifies.
9. **Pharmacist 2:**
   - the two-person block ("A second pharmacist must dispense") is shown first;
   - then the switch to Nattaya Wong, the six-item check and dispense;
   - Counter 2, then "Call patient".
10. **Patient phone:** "Please go to pharmacy counter 2 and show code B-015".
11. **Ops:** the "Mock model (not AMD)" label, then the pharmacy flow and "Called to the counter". The caption reads "Honest label: mock model, not AMD". M-09 asks that the captions contain "mock model" and never "runs on AMD"; the VTT has 0 matches for "runs on AMD".
12. **Case trace:** the graph scrolls to the pharmacist nodes.
13. **Closing card** on the ink gradient: "Research prototype. Synthetic data. Clinicians decide." plus the claim boundary and the 3D Echo X mark (no Fin).

**Captions.** A branded caption bar (step n/17, persona, one line) is drawn in-page on every step. On pharmacy pages it sits higher, above the sticky "Sign off reconciliation" bar. A WebVTT file with the real cue times is at `/media/medx-demo.en.vtt`; the landing picks it up as the track.

**Poster:** `apps/web/public/media/medx-demo-poster.jpg`, a real frame of the video (the title card at 2.2 s).

### How cuts are placed
- **Wall-clock marks failed.** I first tried wall-clock marks synced with colour flashes. Playwright's `recordVideo` clock is not linear with wall time: content led the marks by 0.8 to 1.4 s, varying through the run, so cuts landed on the wrong content.
- **Marker method.** While a step is live, the script draws an 8x8 px corner marker, magenta and green in turn. ffmpeg reads it per frame, which gives each step's exact frames.
  - The dead time between steps (page loads, server work) is cut.
  - Each step is fitted to its budget. A step that ran long is sped up with `setpts`, capped at 2.2x; in the final take the highest was 1.10x. A step that came out short holds its last frame.
  - Steps are joined with 0.25 s cross-fades.
  - The marker is painted out with `delogo`. I checked the corner in the output: no marker colour is left.
- **Length check.** The script fails if the length is outside 55 to 65 s or the file is over 15 MB.

### Landing stills
Fresh captures of the redesigned UI overwrite the FIXED PATHS names, plus `patient-voice.webp`, which the voice card uses.
- **Capture setup:** 1100x860 @2x (1180 for `hero-consult`, 1440 for `ops`, the phone at 390x844), so each crop covers about 390 to 470 CSS px and text stays near 11 px in a 340 px bento card.
- **Total:** 10 files, 265,656 bytes.
- **Aspect guard:** the script refuses to write a still whose aspect falls outside its card's range in `Features.tsx` `SPECS`, and re-scrolls until the whole crop is in view.
- **No urgency red:** a pixel scan for urgency red found 0 matching pixels in all 10 files.
- **No Fin:** the pickup crop starts below the code hero, where Fin is.

### README
- **Screens:** `docs/readme/s-nurse.png`, `s-doctor.png` and `s-pharmacist.png` are 1280x800 captures, stored as 256-colour PNGs (92 to 110 KB, down from 190 to 288 KB). `s-patient.jpg` is the phone intake.
- **Composite:** `journey.png` (164 KB, was 644 KB) is rendered from the updated `journey.html` over the live site:
  - it uses the brand font through `var(--font-jakarta)`, falling back to the local SCBX files when opened on its own;
  - it is rendered from full-colour copies, so there is no double quantization;
  - its captions now describe the two-stage pharmacy.
- **Re-render:** `--journey-only` re-renders the composite on its own.

## FILES CHANGED
- New:
  - `scripts/record-demo.mjs`
  - `apps/web/public/media/medx-demo.mp4`, `medx-demo-poster.jpg`, `medx-demo.en.vtt` (the folder was missing)
  - `docs/reports/screens/w20-video-contact-sheet.jpg` (evidence)
  - `docs/reports/w20-video.md`
- Overwritten:
  - `apps/web/public/landing/{patient-voice,hero-consult,nurse-case,consult,orders,pharmacy-verify,pharmacy-dispense,patient-pickup,ops,trace}.webp`
  - `docs/readme/s-nurse.png`, `s-doctor.png`, `s-pharmacist.png`, `s-patient.jpg`, `journey.png`
- Edited: `docs/readme/journey.html` (scoped CSS, brand font, new captions)
- Not mine: `scripts/build-patient-web.sh` (modified) and `scripts/e2e-journey.mjs` (untracked) appear in `git status` for `scripts/`. I did not touch either.
- Temporary (removed):
  - `apps/web/.next-video/`, a private copy of the 02:22 build output, used with `MEDX_DIST_DIR` so parallel builds could not break my server. It was git-ignored and is deleted.
  - I checked `tsconfig.build.json` and `next-env.d.ts`; they are byte-identical to before.

## TESTS RUN + RESULTS
**Server:** my own `next start -p 3131` from `apps/web` with:
- `MEDX_STORE=file`, `MEDX_STORE_PATH` in my scratchpad, and the `DATABASE_URL`/`POSTGRES_URL`/Upstash variables unset, so nothing touched Neon;
- `MODEL_PROVIDER=mock DEMO_SEED=1 DEMO_AUTOSEED=1 DEMO_TOKEN=qa-secret MEDX_RATE_LIMIT_PER_MIN=0`.

It is stopped and port 3131 is free.

| Command | Result |
|---|---|
| `node scripts/record-demo.mjs --base http://localhost:3131 --token qa-secret --video --stills` (first final run, video and stills, repo root, `PLAYWRIGHT_DIR=C:\Users\User\medx-tools`, `FFMPEG=<imageio ffmpeg 7.1>`) | exit 0. 19 marked steps found in 2291 frames; assembled length 60.70 s; 14 stills and the composite written |
| `node scripts/record-demo.mjs ... --stills` (final stills run, after adding the aspect guard; the first final run's `consult` crop came out 940x546, ratio 1.72, clipped by a late scroll) | exit 0. All 10 stills are inside their ranges; the composite was re-rendered |
| `node scripts/record-demo.mjs ... --video` (final take, after rewording the ops caption to include "mock model" as M-09 requires) | exit 0. 19 marked steps found in 2462 frames; assembled length 60.70 s |
| `ffmpeg -i apps/web/public/media/medx-demo.mp4` | `Duration: 00:01:00.72`; `h264 (High)`, `yuv420p`, `1280x720`, `25 fps`, 424 kb/s |
| File size | 3,239,320 bytes (3.24 MB; the limit is 15 MB) |
| `grep -c "runs on AMD" apps/web/public/media/medx-demo.en.vtt` | 0; "mock model" appears on cue 16 |
| MP4 boxes (node) | `hdlr` types `vide`, `mdir`, so there is no `soun` track and the landing shows "Play"; `moov` comes before `mdat` (faststart) |
| `./node_modules/.bin/vitest run app/_landing` (apps/web) | 1 file, 31/31 passed. This includes "every still exists and parses as a WebP" and the video, poster and track detection |
| Red pixel scan on the 10 landing WebP files (ffmpeg to rgb24, R>150, G<80, B<90) | 0 pixels in every file |
| Corner check (`delogo` area, one sample every 6 s) | no marker colour visible |
| `node --check scripts/record-demo.mjs` | OK |
| `eslint ../../scripts/record-demo.mjs` (from apps/web) | "File ignored because outside of base path". The web lint config does not cover `scripts/` |

## EVIDENCE
**Step lengths in the final cut** (s; speed-ups in brackets):

| Step | Length (s) |
|---|---|
| title | 3.2 |
| intake | 4.8 |
| sent | 2.6 |
| queue | 2.6 |
| evidence | 4.0 (1.08x) |
| vitals | 4.6 |
| consider | 3.4 |
| signed | 2.8 |
| order | 4.6 |
| ret | 4.4 (1.10x) |
| resubmit | 3.8 |
| verify | 2.6 |
| block | 2.8 |
| dispense | 3.4 |
| call | 2.6 |
| ready | 3.0 |
| ops | 2.8 |
| trace | 3.6 |
| closing | 3.6 |

The sum minus 18 cross-fades of 0.25 s is 60.70 s.

**Contact sheet** (1 frame per second of the final video): `docs/reports/screens/w20-video-contact-sheet.jpg`

**Stills** (pixels, bytes):

| File | Size (px) | Ratio | Bytes |
|---|---|---|---|
| `patient-voice` | 760x950 | 0.80 | 45,294 |
| `hero-consult` | 1600x470 | 3.40 | 29,678 |
| `nurse-case` | 828x622 | 1.33 | 25,680 |
| `consult` | 940x706 | 1.33 | 21,150 |
| `orders` | 828x662 | 1.25 | 16,736 |
| `pharmacy-verify` | 940x706 | 1.33 | 28,694 |
| `pharmacy-dispense` | 940x706 | 1.33 | 43,406 |
| `patient-pickup` | 760x584 | 1.30 | 14,738 |
| `ops` | 1000x624 | 1.60 | 20,836 |
| `trace` | 1388x330 | 4.2 | 19,444 |

Every ratio is inside its card's range in `Features.tsx` `SPECS`.

**README** (bytes):
- `s-nurse.png` 94,183; `s-doctor.png` 109,782; `s-pharmacist.png` 92,113; `s-patient.jpg` 131,673
- `journey.png` 164,345

**Scratchpad** (not in the repo):
- Raw recording, `timeline.json` (marker runs and per-step parts) and logs: `C:\Users\User\AppData\Local\Temp\claude\c--Users-User-OneDrive---Mahidol-University-Documents-GitHub-MedX-AI\86cd279c-cfbf-45d5-a5d2-57cf5ffc9ebd\scratchpad\video\final4\` (final take); the first final run is in `...\scratchpad\video\final2\`
- Final stills run (still PNGs and log): `...\scratchpad\video\final3\`
- Backup of the previous seeded stills and README images: `...\scratchpad\video\stills\landing-seed-backup\`

## ASSUMPTIONS
- **Title card.** "MedX · every word, understood" is rendered as the white lockup followed by the H1 "Every word, understood." in sentence case, as on the landing.
- **Fin placement** follows DIRECTION section 11. Fin appears on the title card only, as a cover-like moment on the light disc over the gradient, plus wherever the patient app itself shows Fin.
  - No Fin on the closing card: it carries the claim boundary, and legal copy is excluded. It uses the 3D Echo X mark on ink, which is allowed on ink and never used as the logo there.
  - No Fin next to clinical content.
- **The golden journey is the owner-approved DEMO-GOLD script.** The doctor documents the synthetic override reason off camera. Pharmacist 1 then returns the order, and the doctor switches to the suggested clarithromycin. All values (vitals, drugs, notes, counter 2) are read from `data/cases/DEMO-GOLD.json` at run time.
- **Off camera, but real clicks in the UI:**
  - drafting the note and resolving its unsupported lines with "Not assessed in this synthetic demo visit" (the same wording as the seed);
  - signing the note: signing moves focus, which scrolls the page, so the step shows the signed receipt instead of the click;
  - the override reason and the first submit.
- **Fresh case.** Each run resets the demo store (`POST /api/demo/reset` with the token), so the new visit is always B-015.
- **No audio, no music.** The landing button reads "Play" because there is no `soun` track. The captions carry the story.
- **This wave's brief overrides the original M-09 text:**
  - 1280x720 instead of 1440x900;
  - `medx-demo.mp4` / `-poster.jpg` / `.en.vtt` instead of `medx-60s-v1.*`;
  - `.webp` stills instead of `.png`;
  - no WebM fallback, because the landing reads the MP4 only.
- **M-09 items met as written:**
  - English captions with "mock model" and never "runs on AMD";
  - no audio stream, so the landing shows "Play";
  - 55 to 75 s and 20 MB or less;
  - the same sequence on every run: each run resets the store and always creates B-015, as seen in every completed run (8 video takes, 6 stills passes);
  - the final take was recorded after the two-stage pharmacy work and the M-08 patient export of 03:09.
- **Tooling:** I used the installed Playwright 1.56 (`PLAYWRIGHT_DIR`) and the imageio ffmpeg 7.1 binary, not `npx ffmpeg-static`.
- **Bento crops** follow the landing builder's request: one panel, legible, no red, no Fin. Where a crop shows something other than the old alt text describes, it is listed under Open questions.

## RISKS
- **`/media/*` is served `immutable` for one year** (platform header). This first publish is fine; any future re-cut must use a new file name, or the header must change, or browsers keep the old cut.
- **The landing reads the media at build time.** The video appears only after the next `next build` and deploy.
- **Source softness.** Playwright's `recordVideo` encodes VP8 at about 1 Mb/s, so the video is slightly soft (text is legible; see the contact sheet). CRF 28 follows the brief; there is room to go sharper (3.1 MB against the 15 MB limit) if the owner wants.
- **Red in the video.** The video shows real product UI, which includes urgency red:
  - Emergency chips of seeded escalated cases in the queue;
  - the High allergy badge;
  - "Rule out" chips;
  - the ops escalation count;
  - the trace legend.

  This is correct product behaviour. DIRECTION 12.6 constrains the landing page's own UI, not frames of the product inside the video, but the design lead should confirm.
- **Stale public files on `next start`.** A running `next start` does not serve files added to `public/` after it started. When the patient export was rebuilt at 03:09, my running server returned 404 for the new bundles until I restarted it. Anyone doing QA on a long-lived server during the wave must restart it after `build-patient-web.sh`.
- **Re-record after a UI change.** If the UI changes again before the final deploy, run the command under Next action. One run takes about 3 to 4 minutes for both modes.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
1. **Landing builder: alt-text updates** for stills whose content now differs from the old seeds:
   - `consult`: the signed visit note receipt (Dr. Marco Bianchi) and the start of the signed note. No fields still needing a check are visible.
   - `orders`: the prescribing form filled in for amoxicillin with the Check button. No alert, which keeps it free of red.
   - `patient-pickup`: the pharmacy card "Counter 2. Please go to pharmacy counter 2 and show code B-015". The timeline is out of frame.
   - `ops`: the "Pharmacy flow" heading, the To verify and To dispense tiles, and the top of "Called to the counter". The tiles for awaiting review and abstain rate are not in this crop.
   - `trace`: patient turn, redact personal data, red-flag rules, the model red-flag screen and model extraction, then verify against the patient's words. Order checks are not in this crop.
   - `hero-consult`: the nurse consult live summary, six fields each marked "From patient's words", 2 columns.
2. **Orchestrator:**
   - Commit `scripts/record-demo.mjs`, `apps/web/public/media/`, `apps/web/public/landing/`, `docs/readme/` and the contact sheet, then redeploy so `/` shows the player.
   - `apps/web/.vercelignore` and the root `.vercelignore` keep `apps/web/public/**`, per the platform report.
3. **Design lead:** confirm that red in real product footage inside the video is acceptable (see Risks).

## NEXT ACTION
- **Orchestrator:** commit and deploy, then check `/` shows the player with the poster and the "Play" button, and that `/media/medx-demo.en.vtt` loads.
- **To re-record after any later UI change**, start a private server as described at the top of the script and run this from the repo root:

  ```
  node scripts/record-demo.mjs --base http://localhost:3131 --token <DEMO_TOKEN> --video --stills
  ```

  Use a new video file name if the old cut has already been served.

---

# Final cut (w20, Sun 18 Oct 2026, 06:10 to 07:10 ICT)

## STATUS
done. The video, poster, captions, landing stills, phone captures and README screens are re-recorded on the current UI, and every check below passed. Nothing is committed.

One deviation from the brief, on purpose: the full-phone pickup capture is saved as `patient-pickup-phone.webp`, not `patient-pickup.webp`. The reason is under OPEN QUESTIONS 1.

## SUMMARY
**Build and server.**
- The build is current: `MODEL_PROVIDER=mock next build` at 06:14, run with `MEDX_DIST_DIR=.next-video` so it could not collide with other agents' `.next`.
- The server was my own `next start -p 3135` with:
  - `MODEL_PROVIDER=mock DEMO_SEED=1 DEMO_AUTOSEED=1 DEMO_TOKEN=qa-secret MEDX_RATE_LIMIT_PER_MIN=0`;
  - `MEDX_STORE=file` with `MEDX_STORE_PATH` in my scratchpad;
  - `DATABASE_URL`, `POSTGRES_URL`, Upstash and AMD variables unset, so Neon was never touched.
- `/api/health` reported `provider mock, model deterministic-mock, commit 38e3382`.
- The server is stopped and port 3135 is free. `.next-video` is deleted.
- The build rewrote `apps/web/tsconfig.build.json` and `next-env.d.ts` to point at `.next-video`. I restored both from my backup; their md5 hashes now match the originals.

**`scripts/record-demo.mjs`, now matching the current UI:**
- **New "signin" step (identity sheet and account menu).**
  - The nurse opens the queue without a stored identity, so the header reads "Not signed in".
  - She opens B-015, where the "Who's signing in?" sheet appears, and chooses Nurse Anna Rossi.
  - The account menu then opens, showing "Signed in as", "Demo identity · synthetic staff", "Switch role" and "Sign out".
  - While the sheet is open, the caption bar sits just above it; it glides back down once a name is chosen.
  - The other personas are still set through localStorage, so their sheet never shows.
- **The pharmacist switch is now on camera:** "Sign in as Pharmacist Nattaya Wong" inside the two-person block.
- **Framing fixes:**
  - The queue row is scrolled inside its own list, so the page header is not clipped.
  - The phone frame has a status-bar inset with a camera pill.
  - The signed note is held still with the receipt at the top and the kept consideration visible.
  - The verified receipt and the stage-2 block sit above the caption.
  - The six-item check is framed from its top.
  - The dispense receipt is shown after dispensing.
  - New helper `clearOfCaption()`: before "Confirm level", "Return with report", "Update and re-check" and "Record final check and dispense" are clicked, it scrolls them clear of the caption bar and waits until the scroll has settled.
- **Robustness: `--takes N`** (default 3). If any step overruns its budget by more than 0.6 s of wall time, the take is recorded again from a reset store instead of being sped up. One trial take stalled for 26 s in the order step under machine load; see Risks.
- **Stills:**
  - Native capture pixels are kept (2x desktop, 3x phone), with no downscale.
  - The patient app now runs in its own 390x844 @3x context.
  - New full-phone captures: `patient-home`, `patient-intake`, `patient-pickup-phone` (1170x2532).
  - The `consult` crop is taken from a fresh load of the consult page (reason under Risks).
- **Timing:** 20 steps, about 59.85 s by design.

**Video:** `apps/web/public/media/medx-demo.mp4`, the English walkthrough of the golden synthetic case B-015.
- 59.84 s, 1496 frames at 25 fps, 1280x720.
- H.264 High, yuv420p, `+faststart` (`moov` before `mdat`), no audio track.
- 3,518,630 bytes (3.52 MB).
- Captions: `medx-demo.en.vtt`, 20 cues with the real timings. It never contains "runs on AMD"; it contains "mock model" once.
- Poster: `medx-demo-poster.jpg`, 1280x720, a real frame of the title card.
- Closing card: the claim boundary on ink, "Research prototype. Synthetic data. Clinicians decide." plus "MedX supports clinicians. It suggests for review and flags for clinicians; it does not diagnose, prescribe or decide urgency. Not a medical device." It holds for 4.2 s.

**Docs:** README screens `s-nurse.png`, `s-doctor.png`, `s-pharmacist.png`, `s-patient.jpg` and the `journey.png` composite are re-captured. `docs/readme/journey.html` now falls back to Plus Jakarta Sans and the system font instead of the old SCBX files. I did not delete the SCBX files; see OPEN QUESTIONS 4.

## FILES CHANGED
- **Edited:** `scripts/record-demo.mjs` (1318 lines).
- **Overwritten:**
  - `apps/web/public/media/medx-demo.mp4`, `medx-demo-poster.jpg`, `medx-demo.en.vtt`;
  - `apps/web/public/landing/{patient-voice,hero-consult,nurse-case,consult,orders,pharmacy-verify,pharmacy-dispense,patient-pickup,ops,trace}.webp`;
  - `docs/readme/{s-nurse.png,s-doctor.png,s-pharmacist.png,s-patient.jpg,journey.png}`.
- **New:**
  - `apps/web/public/landing/patient-home.webp`, `patient-intake.webp`, `patient-pickup-phone.webp`;
  - `docs/reports/screens/w20-video-final-contact-sheet.jpg` (1 frame per second of the final cut).
- **Edited:** `docs/readme/journey.html` (font fallback and comment only).
- **Report:** this section of `docs/reports/w20-video.md`.
- **Not mine:** `apps/web/public/media/medx-promo.mp4` (24,350,142 bytes) and `medx-promo-poster.jpg` appeared at 06:53 from the promo render. I did not touch them.
- **Helper probes outside the repo:** `C:\Users\User\medx-tools\w20video\probe-{signin,fixed,anim,signed}.mjs`.

## TESTS RUN + RESULTS
| Command | Result |
|---|---|
| `MEDX_DIST_DIR=.next-video MODEL_PROVIDER=mock next build` (apps/web) | exit 0 |
| `node --check scripts/record-demo.mjs` after every edit | OK |
| `node scripts/record-demo.mjs --base http://localhost:3135 --token qa-secret --video --stills --debug` | exit 0. 20 marked steps, assembled 59.85 s; 13 landing WebP files, 4 README screens and the composite written. The stills in the repo come from this run (`final6`) |
| Same command with `--video` only (final take, `final10`) | exit 0. One take, no overrun; 20 markers found in 2380 frames; assembled 59.85 s |
| ffmpeg on the delivered mp4 | `Duration: 00:00:59.84`; `h264 (High)`, `yuv420p`, `1280x720`, 25 fps; full decode with `-v error` printed nothing; stream copy counted `frame=1496` |
| MP4 boxes (node) | `moov` before `mdat`; `hdlr` types `vide`, `mdir` (no `soun`) |
| Marker check (bottom-right 40x40 px, every frame) | 0 of 1496 frames carry the marker colour |
| `grep` on the VTT | 20 cues; "runs on AMD": 0; "mock model": 1 |
| Red-pixel scan (R>150, G<80, B<90) on all 13 landing WebP files | 0 in every bento crop. `patient-home` has 273 and `patient-pickup-phone` 208, all inside one 13x7 CSS px box each; I located both at Fin's mouth in the brand art, so this is not UI red |
| `./node_modules/.bin/vitest run app/_landing` (apps/web) | 1 file, 35/35 passed. This includes "every still the bento uses exists and is a readable WebP" |
| md5 of `tsconfig.build.json`, `tsconfig.json`, `next-env.d.ts` after the work | identical to the pre-build backup |

## EVIDENCE
**Final step lengths** (s; speed-ups in brackets):

| Step | Length (s) |
|---|---|
| title | 3.0 |
| intake | 4.2 |
| sent | 2.2 |
| queue | 2.2 |
| signin | 2.8 |
| evidence | 4.0 (1.09x) |
| vitals | 4.4 (1.08x) |
| consider | 3.2 |
| signed | 2.6 |
| order | 4.4 |
| ret | 4.2 (1.09x) |
| resubmit | 3.4 |
| verify | 2.6 |
| block | 2.8 |
| dispense | 3.2 |
| call | 2.4 |
| ready | 2.8 |
| ops | 2.6 |
| trace | 3.4 |
| closing | 4.2 |

The sum minus 19 cross-fades of 0.25 s is 59.85 s.

**Frames inspected in the delivered file** (extracted with `ffmpeg -ss N -frames:v 1` at 1.5, 5.0, 9.8, 11.4, 12.6, 15.5, 19.5, 22.8, 25.5, 28.5, 32.0, 35.9, 38.8, 41.5, 43.6, 46.5, 49.0, 51.4, 54.0, 59.5 s, plus 2.5 fps strips over the sign-in, return, resubmit and dispense steps):
- **Captions:** readable on every captioned frame (white on the ink pill, 16 px, step n/18 plus persona).
- **Fonts:** Plus Jakarta Sans throughout, in the title and closing cards, the mist phone stage and the app.
- **Overlaps:** none on content being acted on. The caption sits above the sign-in sheet; "Confirm level 3", "Return with report", "Update and re-check", the six check rows and "Record final check and dispense" are all clear of it when clicked.
- **Labels:** the ops caption reads "Honest label: mock model, not AMD".
- **Closing card:** the claim boundary is present at 57.0 and 59.5 s.
- **Fin:** only on the title card and inside the patient app; none near clinical content or alerts.

**Contact sheet:** `docs/reports/screens/w20-video-final-contact-sheet.jpg`

**Stills** (native pixels, bytes):

| File | Size (px) | Bytes |
|---|---|---|
| `patient-home` | 1170x2532 | 109,504 |
| `patient-intake` | 1170x2532 | 92,764 |
| `patient-pickup-phone` | 1170x2532 | 85,364 |
| `patient-voice` | 1170x1461 | 75,454 |
| `patient-pickup` | 1170x900 | 23,808 |
| `hero-consult` | 1830x552 | 37,162 |
| `nurse-case` | 828x622 | 25,072 |
| `consult` | 940x706 | 22,508 |
| `orders` | 828x662 | 17,964 |
| `pharmacy-verify` | 940x706 | 30,902 |
| `pharmacy-dispense` | 940x706 | 43,402 |
| `ops` | 1206x754 | 28,446 |
| `trace` | 1388x330 | 21,328 |

README (bytes): `s-nurse.png` 92,134; `s-doctor.png` 107,788; `s-pharmacist.png` 91,725; `s-patient.jpg` 133,595; `journey.png` 165,028.

**Scratchpad** (not in the repo), under `C:\Users\User\AppData\Local\Temp\claude\c--Users-User-OneDrive---Mahidol-University-Documents-GitHub-MedX-AI\86cd279c-cfbf-45d5-a5d2-57cf5ffc9ebd\scratchpad\final\`:
- `final10\` (final video take: raw, timeline, per-step debug PNGs, log) and `final6\` (stills run);
- `frames-final\` (the inspected frames);
- `media-before\`, `landing-before\`, `readme-before\` (backups of the previous cut).

## ASSUMPTIONS
- **The sign-in is filmed on the case page, not the queue.** On the queue the sheet renders off-screen (Risks, bug 1). The queue frame honestly shows "Not signed in": reading needs no sign-in, and writing does.
- **Fixed paths (`medx-demo.*`) are kept**, as this wave's brief requires.
- **No audio.** The landing button reads "Play" for this file.
- **The stills keep native capture pixels** for crispness in device mockups, so several sizes differ from the first cut. The landing reads each file's real aspect within its card range; all are inside their ranges.

## RISKS
1. **UI bug (design lead, `apps/web/app/globals.css` about lines 928 to 936): the "Who's signing in?" sheet is invisible on pages that show urgent content.**
   - **Source rule:** `:is(..., main#main-content):has(<urgent>) { transform: none !important; translate: none !important; ... }`.
   - **What the build does to it:** the minifier writes it out as `transform:translate(0)!important`. I saw this in the built CSS of my private build.
   - **Effect:** `main` becomes the containing block for `position: fixed` layers.
     - On `/review` (Emergency chips in the queue) at 1280x720, the sheet's box was at y=757 to 983, below the viewport.
     - `main` showed computed `transform: matrix(1,0,0,1,0,0)` with no running animation.
     - On a case page without urgent content, the sheet sat correctly at y=482 to 708.
   - **Scope:** I checked the red-flag interrupt; it is not fixed, so the alert itself is unaffected. Any other fixed layer inside `main` is.
   - **Suggested fix:** drop the transform and translate declarations for `main#main-content` in that rule (`animation: none` already removes the entrance offset), then confirm that the built CSS has no transform on `main`.
2. **UI bug (clinician web builder, consult page; not diagnosed): after signing, any window scroll pulls the page back up.**
   - In the same page session where the doctor signed the note, a scroll returns the page to the consult capture and transcript area.
   - Reproduced in 3 takes; never on a fresh load of the same signed consult (probe: 6 s idle plus smooth, wheel and instant scrolls, no jump).
   - `document.activeElement` was `body`, so focus is not the cause. A candidate is the Transcript `scrollIntoView` effect in `_consult.tsx`, not confirmed.
   - The recorder works around it: it holds the signed note without scrolling, and takes the `consult` still from a fresh load.
3. **Intermittent stall.** One trial take spent 26 s in the order step after the allergy alert appeared, with no page error. It did not happen in the 6 later takes, and the machine had other agents' node processes running. The recorder now re-takes automatically, so a stall cannot reach a cut.
4. **`/media/*` is served `immutable` for a year.** If the earlier cut of `medx-demo.mp4` was already deployed to a public URL, returning browsers can keep the old file until the cache expires. This file name was fixed by the brief.
5. **The landing reads media at build time.** The new cut and stills appear only after the next build and deploy. With `medx-promo.mp4` present, the landing makes the promo the primary video and this walkthrough the secondary link (`videoInfo`).

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
1. **Orchestrator and promo: `patient-pickup` naming.** The brief asked for full-phone captures named `patient-{home,intake,pickup}.webp`. `patient-pickup.webp` is already a FIXED-PATHS bento still, used by `Features.tsx` SPECS (range 1.2 to 1.5) and by the promo's `ui.patientPickup` card crop. A 0.46-aspect phone screen under that name would be centre-cropped in the bento and would put Fin in it. So:
   - `patient-pickup.webp` stays the bento crop (now 1170x900 @3x);
   - the full ready screen is `patient-pickup-phone.webp`.

   If the promo needs the phone screen, point `sync-assets.mjs` at `patient-pickup-phone.webp`.
2. **Promo motion designer.** The stills are now at native 2x/3x pixels: `patient-voice` 1170x1461, `hero-consult` 1830x552, `ops` 1206x754, the others as in the table. Several have no clean ratio to the old `native` boxes, so `assets.js` will fall back to `ui-verified` until they are re-measured. `patient-home` and `patient-intake` are new, at 1170x2532.
3. **Design lead:** fix bug 1 in `globals.css` (Risks 1). **Clinician web builder:** look at bug 2.
4. **Orchestrator.** `docs/readme/SCBXBeta2-*.otf` are no longer used by `journey.html`. Pitch covers and `docs/design/logo` may still load them, so I left them in place. `README.md` line 178 still mentions them.

## NEXT ACTION
- **Orchestrator:**
  - commit `scripts/record-demo.mjs`, `apps/web/public/media/medx-demo.*`, `apps/web/public/landing/`, `docs/readme/`, this report and the contact sheet;
  - rebuild and deploy, then check that the walkthrough plays at `/` with the poster and captions.
- **To re-record after any later UI change** (about 2.5 min for the video, about 1.5 min for the stills), start a private server as above, then run this from the repo root:

  ```
  PLAYWRIGHT_DIR=C:/Users/User/medx-tools FFMPEG=<ffmpeg> node scripts/record-demo.mjs --base http://localhost:<port> --token <DEMO_TOKEN> --video --stills
  ```

  In Git Bash, prefix `MSYS_NO_PATHCONV=1`.
