# Progress board: Sun 18 Oct 2026, updated after the AMD evaluation run (12:38 ICT)

## Status: live demo runs on the AMD Token Factory (Gemma-4-31B-IT + DeepSeek-V4-Flash); real evaluation done, several pre-declared targets NOT MET

Deadline: Sun 18 Oct 2026, 17:00 ICT (internal 15:00). Live demo: https://medx.areazeroai.com; `/api/health` reports provider `amd-tokenfactory`, model `Gemma-4-31B-IT`, extractModel `DeepSeek-V4-Flash`, hardware `AMD (via Token Factory)`.

| Area | State | Evidence |
|---|---|---|
| Landing and demo hub | done: marketing landing at `/` (en), `/th`, `/it` in the reference structure; "Try a role" with 6 personas; `/demo` hub and per-persona launcher; QR to `/patient`; honest model label from `/api/health`; Open Graph, robots, sitemap | docs/reports/w20-landing.md, w20-polish-design.md |
| Brand, type, motion | done: "calm clinical banking" v3.1, 3D Fin art, Plus Jakarta Sans and Noto Sans Thai (SCBXBeta2 removed from web and patient app), motion system with "urgent stays still" | docs/reports/w20-design-lead.md, w20-polish-design.md, w20-patient-polish.md |
| Patient app (Expo + `/patient` web export) | done: English first, voice with confirm-before-send, live timeline, pickup card, "Start a new visit", calm motion | docs/reports/w20-patient-mobile.md, w20-patient-polish.md |
| Clinician web | done: queue with journey stage chips, account menu (sign out, switch role), "Who's signing in?" sheet, consult outbox (unsaved lines never shown as record) | docs/reports/w20-clinician-web.md, w20-sign-out.md, w20-fixes.md |
| Two-stage pharmacy and pickup | done: pharmacist 1 verify or return with report and options for prescriber review; pharmacist 2 six-item check with two-person rule; pickup call and collection; re-check pulls a dispensed, uncollected order back on a new high alert | docs/reports/w19-*.md, w20-pharmacy-ops.md, w20-fixes.md |
| Ops and case trace | done: pharmacy pipeline, honest label, trace nodes for every stage | docs/reports/w19-ops-trace.md, w20-pharmacy-ops.md |
| Platform | done: Neon Postgres snapshot store with optimistic concurrency, security headers and CSP, POST rate limit, daily cron reset, health with store and commit, Vercel config | docs/reports/w20-platform.md, docs/DEPLOY.md |
| Engine tests | **2,436 tests in 51 files, all passing** (`./node_modules/.bin/vitest run` in apps/web, 07:14 ICT, exit 0) | this board; docs/reports/w20-docs.md |
| Clinical rule checkers | red flags 175/175 (18 rules), med rules 253/253 (medrules 1.2), consult rules 87/87 (51 rules), vital rules 13 cases + band coverage, all passing | docs/reports/w20-docs.md |
| End to end and QA | e2e journey 113/113 (115/115 with strict roles); qa suites, landing, English-default, security and Playwright flows green against a local `next start` (03:19 to 03:31 ICT run, before the later fixes) | docs/reports/w20-qa.md |
| Videos | done: 60-second film `medx-promo.mp4` (critic round 3 not run) and 60-second product walkthrough `medx-demo.mp4` with captions, re-recorded on the current UI | docs/reports/w20-promo.md, w20-video.md |
| Model on AMD | done: live demo on the AMD Token Factory, Gemma-4-31B-IT for the add-only red-flag screen and the next question, DeepSeek-V4-Flash (`AMD_EXTRACT_MODEL`) for the extraction (Gemma took 72 s and 300 s for one ~880-token strict-schema extraction; DeepSeek 17 to 48 s). Turn deadline 52 s, extraction timeout 40 s, next question 11 s, screen 12 s, 429 retries with a capped Retry-After, extraction max_tokens 1500, patient app waits 58 s per turn, Case trace reads model calls correctly. Every model call records its model id in the audit trail and the Case trace | eval/REPORT.md, README Tech stack |
| Evaluation on AMD | done, run `2026-10-18T05-38-22-421Z` (split test, 30 intake cases with 11 escalated and excluded from field metrics, 18-case blind holdout). M1 precision 88.1% (37/42) **NOT MET** (≥ 90%); M1 capture recall 26.2% (37/141) **NOT MET** (≥ 70%, depressed by provider failures); M1 hallucination 3.4% (3/87) met; M3 unsupported with verifier 11.9% (5/42, 12.5% without) **NOT MET** (≤ 5%); M4 in-sample red-flag recall 100% (8/8) met, false alarms 13.6% (3/22) **NOT MET** (≤ 10%); M11 holdout rules alone 7/10, rules + Gemma screen 8/10 **NOT MET** (≥ 9/10), false alarms 3/8 unchanged, the screen alone caught HO-04 (suicide risk); M8 turn p50 38.4 s / p95 42.2 s **NOT MET** (≤ 6 s / ≤ 12 s). Successful-call latency: screen p50 2.5 s / p95 10.6 s, extraction 25.9 s / 35.5 s, next question 4.1 s / 6.4 s. Shared key: 34 of 111 calls succeeded, 47 HTTP 429, 30 timeouts (failed calls abstain). The earlier run `2026-10-18T05-30-14-335Z` (63 of 70 calls rate-limited) is not evidence | eval/REPORT.md (orchestrator note), docs/ai/METRICS.md |
| Docs and pitch | done: README rewrite, English HANDOFF (Thai copy in docs/HANDOFF.th.md), SPEC.md, DEPLOY.md, ARCHITECTURE, DEMO, SUBMISSION, VIDEO-SCRIPT, SAFETY, deck numbers | docs/reports/w20-docs.md |
| Public repo | https://github.com/KingPhuripol/MedX-AI | |

## Open, in order

1. **Orchestrator:** commit and push the AMD changes still in the working tree (the evaluation was recorded on `26b1bb2` with uncommitted changes); every redeploy from the CLI (docs/DEPLOY.md) keeps `MEDX_STRICT_ROLES=1`, `CRON_SECRET`, `DEMO_TOKEN` and the AMD variables; run the post-deploy QA.
2. ~~**Owner:** AMD Token Factory key, `MODEL_PROVIDER=amd`, run the evaluation, fill the AMD results.~~ **Done:** live demo on AMD; evaluation run `2026-10-18T05-38-22-421Z` in `eval/REPORT.md`; README, SUBMISSION and SAFETY updated with its numbers. Still open: the deck sources (`pitch/deck/deck.html`, `deck-v2.html`, `build-v2.py`), `pitch/DECK-OUTLINE.md` and `pitch/VIDEO-SCRIPT.md` still carry placeholder AMD cells; refresh them from `eval/REPORT.md` and re-export the PDF.
3. **Doctor:** sign off CR-THROAT-05 (golden case), review the known red-flag paraphrase gaps and RF-ANAPH-01 on a past hives reaction.
4. **Owner:** team names for the deck and README, if they should be shown.
5. **Anyone fluent:** native review of Thai and Italian strings.

## Known limitations (also in README, SUBMISSION and pitch/SAFETY.md)

Synthetic data only; not a medical device. On the AMD Token Factory, turns are slow (p50 38.4 s against a 6 s target) and field precision, capture recall, unsupported claims and in-sample false alarms miss their targets; the shared team key's rate limits made most evaluation calls fail (34 of 111 succeeded; failures abstain). The walkthrough video was recorded on the mock model. Keyword red-flag rules miss paraphrases (holdout 7/10; 8/10 with the Gemma screen, target 9/10). Voice uses the device's cloud speech service. No real login: identity is self-declared. Pattern-based redaction. Small prescribing rule set. Thai and Italian need native review.
