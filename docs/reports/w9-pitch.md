# W9 Pitch lead report

STATUS: done (AMD numbers are marked [pending AMD run]; team names are a placeholder on slide 8)

SUMMARY: Built the 8-slide deck in the app's v2 style (teal to ocean, white cards, SCBXBeta2 embedded via relative @font-face), exported PDF and per-slide PNGs, rewrote submission copy and video script for the real product, and rendered cover-v2.png. Screenshots are fresh captures from the running app (review, red flag, pharmacist, ops) plus real mobile shots.

FILES CHANGED: pitch/deck/deck.html, pitch/deck/MedX-Bridge-deck.pdf, pitch/deck/png/slide-1..8.png, pitch/deck/img/* (screens), pitch/deck/fonts/* (copied from apps/web/app/fonts), pitch/cover/cover-v2.html, pitch/cover/cover-v2.png (old cover kept), pitch/SUBMISSION.md, pitch/VIDEO-SCRIPT.md, pitch/DECK-OUTLINE.md (note added), docs/reports/w9-pitch.md

TESTS RUN + RESULTS: `cd apps/web && npx vitest run`: 13 files, 1,041 tests passed (confirmed 17 Oct, 16:45). PDF has 8 pages (Chrome headless, @page 1920x1080). Every slide PNG was viewed; overflow and wrapping on slides 1, 2, 4, 6, 7 were fixed. Short description 242 chars; long description about 440 words.

EVIDENCE: numbers on slides and where they come from: 49.1 vs 29.5 and 52.4 vs 35.9 (Divi 2007, PROBLEM.md D1); 49.2 vs 27.0 (Sinsky 2016, T1); 13% to 59% (PHARMACY-PROBLEM.md M1-M6, range); 32.97M tourists (H1); 52 cases (data/cases: EN 13, IT 13, TH 14, MED 12; index.json excluded; the brief said 52, confirmed); 18 holdout (data/holdout); 18 rules / 175 tests and 59 drugs / 194 tests (docs/clinical, w3-doctor, w4-ai-engineer); holdout keyword rules 7/10 recall, 3/8 false alarms (eval/results/holdout-rules-only.md). Slide 5 footnote on cross-vendor review cites w6-engine-review and w7-qa-bugs only.

ASSUMPTIONS: screenshots re-captured at 1440x900 from the dev server on :3000 (seeded mock data, so queue counts are small); mobile images are the repo's 375x812 captures, framed with a white rounded border. "Findings fixed with regression tests" taken from w7-ai-engineer.md. I did not claim Codex reviewed Claude's code because no report shows it.

RISKS: ops screenshot shows mock-model tiles (37.5% auto-captured, 15.4% abstain) which are mock numbers; the slide says "Mock model" next to it. The voice-agent shot is from the web build, not a real microphone. Team names missing on slide 8. Video script assumes the live-status tick can be shown split-screen; verify on the final build. Thai and Italian text still needs native-speaker review.

OPEN QUESTIONS: add team names; once the AMD run exists, replace every [pending AMD run] in deck.html, SUBMISSION.md, VIDEO-SCRIPT.md and re-export (open deck.html in Chrome, print-to-pdf command in this report's history).

NEXT ACTION: fill AMD results, re-export PDF and PNGs, record video.

## Claims fix wave (MF-3 to MF-7)

STATUS: done. Edited README.md, docs/ARCHITECTURE.md, pitch/SUBMISSION.md, VIDEO-SCRIPT.md, SAFETY.md, DECK-OUTLINE.md, deck.html; regenerated PDF and PNGs and viewed slides 1, 3, 5, 6, 7 (slides 2, 4, 8 unchanged apart from none of the edited text).
- MF-3: no present-tense Instinct/ROCm/vLLM claim in README, SUBMISSION, deck, video script, outline; wording is "designed to run Gemma on AMD via the hackathon's AMD Token Factory; current results use a mock model". Tags are now Gemma, AMD, AMD Token Factory. Slide 7 title: "Gemma via AMD Token Factory, behind one gateway".
- MF-4: "trust" and "30 seconds" removed as claims (README, deck slides 1 and 3, video, submission, outline); lead is "every field points back to the patient's own words"; slide 3 says "design goal: quick to scan".
- MF-5: voice via Apple/Google speech services, no clinician login (self-declared reviewer id), imperfect pattern-based redaction added to SAFETY.md and the reviewer's "Limitations & safety" paragraph pasted into SUBMISSION.md.
- MF-6: injection wording softened in SAFETY.md and deck slide 5.
- MF-7: test count now 1,043 tests in 13 files (re-run `npx vitest run`) in README, SUBMISSION, deck, video; ARCHITECTURE reset is POST with x-demo-token; holdout phrased "small synthetic blind set (18 cases)" in video and deck; case counts 52 (40 intake + 12 medication) + 18 holdout in README, deck. Deck footnote: "findings fixed with regression tests; remaining limitations are listed in the submission."
- Not done / left to others: MF-1 and MF-2 are product code (out of my scope). docs/DEMO.md already used POST with the token, so unchanged. A final grep of pitch/, README and docs/ARCHITECTURE.md finds Instinct/ROCm/trust/30 seconds only in this report and in the DECK-OUTLINE.md change note.
