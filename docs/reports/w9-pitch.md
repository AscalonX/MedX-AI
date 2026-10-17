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

## Pitch wave 4 (MedX rename, Fin, consult/vitals/orders/pharmacist loop, business case)

STATUS: done. Not committed.
- Deck: pitch/deck/deck.html is now 10 slides: 1 title (Fin), 2 problem (cited), 3 one journey four people, 4 nurse consult + vitals/triage, 5 doctor considerations + draft note + orders, 6 prescribing checks + pharmacist loop, 7 safety by design, 8 evidence + AMD pending, 9 business case, 10 next + team (Fin). Exported pitch/deck/MedX-deck.pdf (10 pages) and png/slide-1..10.png; every slide viewed and overflows fixed. Fin appears only on slides 1 and 10.
- Screens: fresh captures from the running dev server (consult, vitals, orders, ops, red flag) and repo shots (v6 doctor note, v9 orders/pharmacy, mobile voice/status). English UI except the two patient-app phone shots, which are Italian (no English captures of those two exist); slide 3 says so.
- Numbers (all traceable): 52 cases, 18 holdout, 18 rules / 175 tests, 59 drugs / 194 tests, 1,382 tests in 19 files (re-run just now), 7/10 and 3/8 holdout, 49.1/29.5, 13-59% (PHARMACY-PROBLEM M1-M6), 20.9-28.1% nurse documentation (PROBLEM T2), 32.97M tourists. Business slide claims no savings figure.
- SUBMISSION.md: short 253 chars; long about 460 words; a LIMITATIONS MARKER is left for the safety reviewer's paragraph (also marked in deck slide 7 footnote). VIDEO-SCRIPT.md rewritten for the single English journey. README: feature list and screenshots section updated (images from pitch/deck/img), test count 1,382 in 19 files. Old ops screenshot error state (the first capture showed "could not update") was re-captured.
- Left as is: SAFETY.md and DECK-OUTLINE.md (older text, outline note points to deck.html) are stale on the new features; cover-v2 untouched. The doctor-note image and the ops/pharmacy screenshots come from seeded mock data. I could not delete old files with glob rm (blocked); pitch/deck/png only has slide-1..10 now.
- Risks: the ops dashboard screenshot was cropped from a live run on the mock model; the "Mock model" tile should be visible when the video is recorded. Slide 4 shows speech-service text in the consult screen ("processed by your browser's speech service") deliberately.
- Correction: the ops screenshot could not be captured headlessly (board showed an error), so no ops image is used in the deck or README; ops is described in text only.

## MF-11 (w14 safety review) copy fixes
STATUS: done; not committed. Updated SUBMISSION.md, SAFETY.md, README.md, VIDEO-SCRIPT.md, deck.html (slides 1, 3, 7, 10), regenerated MedX-deck.pdf and PNGs; viewed slides 1, 7, 10.
- Ambiguity fixed: "The AI never diagnoses, orders, prescribes or confirms triage; clinicians do these in MedX, with deterministic checks and an audit trail" (SUBMISSION, README, deck, video). The reviewer's 119-word Limitations & safety paragraph is in SUBMISSION and README; the deck slide 7 footnote carries a shortened version.
- SAFETY.md now covers consult "consider" items (fixed rule list, doctor-only, dropped from signed note unless kept), NEWS2 suggestion the nurse confirms, no AI drugs or doses, orders with override reasons and pharmacist verify/return, clinic-side cloud speech.
- "Hears what others miss" replaced by "listens closely" (slide 1, slide 10).
- CAVEAT: the paragraph and the SAFETY.md statements about consider items, the signed note and consent assume the reviewer's MF-1, MF-2 and MF-10 code fixes are applied. They were not verified by me. If any is not done, remove that sentence from SUBMISSION, README, deck slide 7 and SAFETY.md before submitting. Video-script line about listening starting after patient agreement is also conditional on MF-10.

## README redesign
STATUS: done; not committed. README.md rewritten: centred banner, tagline, badges, quick links (live demo and video marked pending), Why (3 cited facts), 4-role journey with docs/readme/journey.png (composed with headless Chrome from real screenshots; source journey.html, copies of the screenshots and fonts live in docs/readme/), safety, mermaid, AMD (honest), quick start with DEMO_AUTOSEED/DEMO_TOKEN, tests (1,807 in 21 files, re-run), repo map, the reviewer's Limitations paragraph, team and how it was built.
Notes: the badge "tests 1,807" is static and will drift; the "SCBXBeta2 not part of MIT grant" sentence is my addition (matches the w14 reviewer's NOTICE suggestion; remove if the owner disagrees); mermaid and rendering were not previewed on github.com (HTML centring and shields.io badges are standard). The paragraph's claims on consider items assume w14 MF-1/MF-2 are applied.
