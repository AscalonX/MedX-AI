# Merge verifier, round 1: origin/main into feat/pharmacy-two-stage

STATUS: done. One item is left for the orchestrator to decide: re-rendering the deck v2 binaries (see RISKS).

SUMMARY
I checked the staged merge of af48f8a, 94d0c4e, 17b52ab and e049be6 hunk by hunk against the working tree. There are no conflict markers and no unmerged paths. Every behavioural change from their side is present:
- the busy/ready double-tap guard and the "Resume visit" label in the patient app;
- the single-flight release on unmount in the clinician queue;
- the approved receipt with the next open case and triage, with vitals always visible;
- phone-width wrapping in FieldRow;
- PencilField wrapping;
- `alertNeedsFollowUp` across the pharmacy queue, workspace, sorting, highAlert, buttons and questions;
- the reviewScope sign-off text and the "not reviewed" / "awaiting review" copy;
- the mock negation fix and the trace PII-test fix;
- `.env.example`, `.gitignore`, the LOCAL-SETUP doc and `scripts/start-local.sh`;
- the README tagline, the DECISIONS title entry, the deck v2 files and the lablab form section.

Their new tests exist and pass (review-status 3, browser-regressions 12). The patient export bundle was built from the merged sources: the minified home chunk has the `busy`/`ready` guard and `resume`/`openVisit`.

One semantic conflict was not caught. Their deck v2 (`deck-v2.html`, `build-v2.py`) loads `fonts/SCBXBeta2-*.otf`. Our side deleted that font for licence reasons (DECISIONS 2026-10-18). I moved both sources to Plus Jakarta Sans, with Noto Sans Thai (OFL) for the one Thai phrase.

FILES CHANGED (staged)
- `pitch/deck/deck-v2.html`, `pitch/deck/build-v2.py`: font block changed from SCBXBeta2 to Plus Jakarta Sans (300/400/700) plus Noto Sans Thai (400/700, Thai unicode-range). I ran `build-v2.py` with UTF-8/LF output into a scratch file; the result is byte-identical to the edited `deck-v2.html`.
- `pitch/deck/fonts/noto-sans-thai-thai-{400,700}-normal.woff2`, `pitch/deck/fonts/LICENSE-noto-sans-thai.txt`: from @fontsource/noto-sans-thai 5.1.0 (OFL-1.1).
- `pitch/SUBMISSION.md`: "suggestion she confirms" changed to "the nurse confirms", following their e049be6 wording. The deck row now notes the re-render. Form lengths are unchanged (title 47, short 253, long 1,968).
- `README.md`: test badge and command comment changed from 2,436/51 files to 2,451/53 files, the count measured in this run.

TESTS RUN + RESULTS (final run, after the fixes)
- apps/web `vitest run`: 53 files, 2,451 tests passed, exit 0. This includes `app/patient-stamp.test.ts` (11), `review-status.test.ts` (3) and `browser-regressions.test.ts` (12).
- apps/web `tsc --noEmit -p .`: exit 0. `eslint .`: exit 0. `MODEL_PROVIDER=mock next build`: exit 0.
- Clinical checks: consultrules 87/0, medrules 253/0, redflags 175/0, vitalrules 13 cases plus band coverage, all exit 0.
- Extra checks: apps/mobile `tsc --noEmit` exit 0 and `eslint src` exit 0. `git diff --cached --check` is clean, and `git ls-files -u` is empty.

EVIDENCE
- Deck font check: I rendered deck v2 with Playwright, first with the base-commit SCBX fonts and then with Plus Jakarta Sans. No headline wraps changed, and nothing new spilled below the body or outside the slide. The only new findings are glyph-metric `.num` scroll heights of a few pixels with no clipping. I viewed slides 1, 5, 14, 21, 28 and 34.

ASSUMPTIONS
- Our M-06 header, with orders shown to both roles and consult on approved cases, supersedes their doctor-only orders link. Vitals are always visible, which keeps their intent.

RISKS
- `pitch/deck/MedX-deck-v2.pdf` and `pitch/deck/png-v2/*.png` (from 94d0c4e) still embed SCBXBeta2. Re-rendered versions with Plus Jakarta Sans, 34 pages at 1440x810 with 96 dpi previews, are in the verifier's scratch directory. Installing them over the staged binaries was blocked by the session's permission check, so the orchestrator or pitch lead should decide on and run the re-render (Chrome print-to-PDF of `deck-v2.html`). The PDF also falls back to Arial for the ≤ and ≥ glyphs, which are not in the Plus Jakarta Sans latin subset.
- Slide 1 of deck v2 places the title band over the pills baked into `cover-v4.png`. This is unchanged from their original.

OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- None for contracts. Other docs still show 2,436 as dated snapshots (`docs/PROGRESS.md`, `docs/ARCHITECTURE.md`, `pitch/DECK-OUTLINE.md`, `pitch/VIDEO-SCRIPT.md`); I left them unchanged.

NEXT ACTION
Orchestrator: commit the merge, then decide whether to re-render the deck v2 PDF and previews.
