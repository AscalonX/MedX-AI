# W21 voice-over: integrator report

Owner feedback (Sun 18 Oct, about 09:20): "I watched the demo and could not understand it: there is no voiceover. Add a voiceover using OpenAI."

## STATUS
done for the integrator scope. The site is not deployed yet and nothing is committed. Other owners still need to update their links (see OPEN QUESTIONS).

## SUMMARY
- The landing page now uses two narrated cuts, and both files in the repo are byte-identical to the producer output in `C:\Users\User\medx-tools\vo\out`:
  - **Walkthrough:** `/media/medx-demo-narrated.mp4`. It runs 2 min 15 s with 21 English voice lines and 44 caption cues.
  - **Promo:** `/media/medx-promo-vo.mp4`. It runs 60 s with 9 voice lines mixed over the original score. The picture is bit-identical to the silent promo.
- The walkthrough button on the landing page now gives the real length in all three languages, for example "Watch the full product walkthrough (2 min 15 s, narrated)". The note under it says the narration and captions are in English.
- **Deviation from the computed task, on purpose:** I did **not** overwrite `medx-demo.mp4`, `medx-demo-poster.jpg`, `medx-demo.en.vtt` or `medx-promo.mp4`. The reason is caching:
  - `next.config.ts` serves `/media/:path*` with `Cache-Control: public, max-age=31536000, immutable`. A new cut under an old name would keep serving the cached silent file.
  - The fix step had already moved the landing to new names (`apps/web/app/_landing/site.ts`), and a test in `landing.test.ts` asserts those names.
  - The silent cuts stay in place for the README, SUBMISSION and HANDOFF links that still describe them as 60-second videos.

## FILES CHANGED
By me in this step:
- `apps/web/app/_landing/copy.ts`: changed `video.walkthrough` and `video.walkthroughNote` in en, th and it.
- `docs/reports/w21-voiceover.md`: this report.

Already in place from the producer and fix steps. I verified each one and did not change it:
- `apps/web/public/media/medx-demo-narrated.mp4`, `medx-demo-narrated-poster.jpg`, `medx-demo-narrated.en.vtt`, `medx-promo-vo.mp4`, `medx-promo-vo.en.vtt`. Each SHA-256 equals its copy in `medx-tools/vo/out`.
- `apps/web/app/_landing/site.ts`: the new media paths.
- `apps/web/app/_landing/landing.test.ts`: the tests now use the path constants and assert the new names.
- `scripts/record-demo.mjs`: kept as the producer left it, and `node --check` passes. With `--narration`, the length window becomes the sum of the step budgets minus the cross-fades, ±1.5 s, instead of 55 to 65 s. The title chip changes to "One visit, start to finish" and the default output name to `medx-demo-narrated`.

Not touched: the silent `medx-demo.mp4`, `medx-demo-poster.jpg`, `medx-demo.en.vtt`, `medx-promo.mp4` and `medx-promo-poster.jpg`. The promo VO cut reuses `medx-promo-poster.jpg`.

## TESTS RUN + RESULTS
All commands ran from `apps/web`.

| Command | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit -p .` | exit 0 |
| `./node_modules/.bin/eslint .` | exit 0, no findings |
| `./node_modules/.bin/vitest run` | 2455 passed, **1 failed** (2456 total); 53 of 54 files passed; 73.6 s |
| `vitest run app/_landing` (re-run) | 36 of 36 pass |

The one failure is `lib/pipeline/__tests__/pipeline.test.ts > pipeline > long Retry-After abstains immediately`. It expects 1 `extract` call and gets 4. It fails the same way when re-run alone.
- It is **not** caused by this step, which only changed landing copy.
- The cause is the uncommitted AMD-workstream change in `apps/web/lib/pipeline/extract.ts`. It caps a long `Retry-After` at 3 s and retries up to 3 times, where the old code abstained.
- That folder belongs to the AI engineer, so I left it alone.

## EVIDENCE (measured)
I measured loudness myself with ffmpeg 7.1 `ebur128=peak=true` on the repo files. The other numbers come from the producer's verification files, as noted below.

**Walkthrough: `apps/web/public/media/medx-demo-narrated.mp4`**
- **Length:** 135.44 s (00:02:15.44). Size 8,259,742 bytes. faststart: yes.
- **Video:** H.264 High, 1280x720, 25 fps, about 285 kb/s.
- **Audio:** AAC-LC, 48 kHz stereo, about 196 kb/s.
- **Loudness:** integrated -16.0 LUFS, LRA 2.6 LU, true peak -3.1 dBTP.
- **Voice lines:** 21. Each is normalised to -16.0 LUFS, and the highest per-line true peak is -1.01 dB (manifest). The last line ends at 133.93 s. The smallest gap between lines is 0.35 s.
- **Captions:** 44 cues with 0 overlaps. The last cue ends at 00:02:14.330.
- **Voice-to-screen sync** (`medx-tools/vo/out/verify-narrated.json`): I checked 31 cue words against the on-screen action. 29 land within 0.08 s; the two that land later are "changes" (resubmit step, 0.35 s late) and "dispensing" (0.13 s late). Start-of-line frames are in `medx-tools/vo/out/sync-narrated/*.jpg`.
- **ASR round-trip on the final file** (whisper-1, `medx-tools/vo/fix2/asr-final-narrated.json`): similarity 1.0. AMD is not mentioned, and Gemma is not mentioned. All 6 required phrases are present, including "a mock model does the drafting" and "never diagnoses".

**Promo: `apps/web/public/media/medx-promo-vo.mp4`**
- **Length:** 60.00 s. Size 19,574,077 bytes.
- **Video:** 1920x1080, 60 fps, 3600 frames.
- **Picture unchanged:** the video packet MD5 is `014f147e31ccb76b6500b07b03062be7` for both this file and the silent `medx-promo.mp4`. I recomputed it, so the picture is bit-identical.
- **Audio:** AAC-LC, 48 kHz stereo, about 266 kb/s.
- **Loudness:** integrated -15.1 LUFS, LRA 3.0 LU, true peak -1.5 dBTP. The silent original measures -14.3 LUFS, LRA 6.2 LU and -1.6 dBTP.
- **Voice lines:** 9, and all of them sit inside their shot window (`allLinesInWindow: true`). The smallest slot margin is 0.03 s. The voice is 7.7 to 14.5 LU above the music (`medx-tools/vo/promo-mix/verify.json`). That file was written for `out/medx-promo.mp4`, which has the same SHA-256 as `medx-promo-vo.mp4`.
- **ASR check** (whisper-1, `promo-mix/asr-check.json`): similarity 1.0 on all 9 lines.
- **Captions:** 9 cues.

**Voice and model** (`medx-tools/vo/manifest.json`)
- OpenAI `gpt-4o-mini-tts`, voice `cedar`, 48 kHz mono PCM, target -16 LUFS and true peak at most -1 dB.
- whisper-1 provided the word timestamps and the ASR checks.
- In this integrator step I did not open `medx-tools/.openai.env` and made no OpenAI calls.

**Critic verdicts** (`medx-tools/vo/script-review.md`, script critic, 18 Oct)
- **Verdict on the draft script:** FAIL, with 4 medium issues, 0 high and 8 low. The honesty check passed: no AMD, Gemma or accuracy claims, no invented numbers, and the mock model is disclosed.
- **The medium fixes, checked in the shipped captions:**
  1. Promo S03 is now "Language gaps cause harm."
  2. The walkthrough states the problem (shared language, a lost allergy), introduces Fin, and says "red-flag rules before any model call".
  3. The order line says "the doctor asks the pharmacy to review".
  4. The cut ships under a new name, the chip says "One visit, start to finish", and the landing label gives 2 min 15 s.
- **Low fixes also present:**
  - Promo S15 is "No quote? Needs check. MedX prepares. People decide."
  - Cue lines were added: "Watch the allergy." and "One more safety net".
  - The video ends with "Try the live demo".
- I found no re-review verdict file written after the fixes, so I do not claim a critic PASS. The fix step reported its six issues as fixed.

**Live site, read-only check at about 13:40 ICT**
- `GET https://medx.areazeroai.com/api/health` returns `provider: amd-tokenfactory`, `model: Gemma-4-31B-IT`, `extractModel: DeepSeek-V4-Flash` and `commit: 26b1bb2`.
- `HEAD /media/medx-demo-narrated.mp4` returns 404, so the narrated cuts are **not deployed**.
- The live landing still links the silent `medx-demo.mp4` with the old label.

## ASSUMPTIONS
- The fix step chose new file names because of the cache. That design takes priority over the computed task's list of paths to overwrite. The computed list matches a template written before the rename.
- The Thai and Italian labels need native review, like the rest of the th and it landing copy.

## RISKS
1. **Claim drift on the mock-model line.** The walkthrough says "In this demo, a mock model does the drafting." That is true of the recording. The live demo now runs on AMD Token Factory, so a judge who opens it will see a different model label. HANDOFF already says to tell judges the walkthrough was recorded on the mock model. The other fix is to re-record in AMD mode; `script.md` notes that the line must then match `/api/health`. The computed task's premise that "the live demo runs a mock model" is now out of date.
2. **Not live until deployed.** The landing will show the narrated cuts only after a commit and deploy. The current 404 for `/media/medx-demo-narrated.mp4` carries the `immutable` one-year cache header, so a browser that already fetched that URL may keep the 404. This is a low risk, since the URL is not linked anywhere live.
3. **Repo size.** The narrated media adds 27.8 MB (8.26 MB + 19.57 MB) next to the silent cuts.
4. **QA script.** In `qa/31-landing.mjs`, check LP22 still looks for `/media/medx-demo.mp4` inside the video section. It will fail against a deploy of the new landing. LP21 (Range 206) still passes on the silent file. The `qa/` folder is not in my write list.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- **Orchestrator:** point the links at the narrated cuts and fix their length labels:
  - `README.md` lines 53-60 (sizes 24.4 MB and 3.5 MB, "60-second")
  - `pitch/SUBMISSION.md` lines 6-7
  - `HANDOFF.md` lines 19-20 and 55
  - `docs/DEMO.md` line 68
  - Use the walkthrough at `/media/medx-demo-narrated.mp4` (2 min 15 s, narrated, captions `medx-demo-narrated.en.vtt`) and the promo at `/media/medx-promo-vo.mp4` (60 s, voice-over, captions `medx-promo-vo.en.vtt`).
- **Orchestrator / QA owner:** update `qa/31-landing.mjs` (`VIDEO`, `POSTER`) to the new names.
- **AI engineer:** `pipeline.test.ts` "long Retry-After abstains immediately" fails because of the uncommitted retry loop in `extract.ts`. Either update the test to match the new rule or restore the abstain-on-long-Retry-After behaviour.
- **Owner:** keep or delete the silent cuts once no link uses them.

## NEXT ACTION
1. The orchestrator updates the README, SUBMISSION, HANDOFF and DEMO links.
2. The AI engineer resolves the pipeline test.
3. Commit and deploy.
4. Check that `/media/medx-demo-narrated.mp4` and `/media/medx-promo-vo.mp4` answer a Range request with 206, and that the live landing shows "Watch the full product walkthrough (2 min 15 s, narrated)".
