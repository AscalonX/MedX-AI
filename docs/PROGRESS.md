# Progress board — Sat 17 Oct 2026, 23:00 ICT

## Status: feature-complete on the mock model; blocked only on the AMD key for real Gemma numbers

| Area | State | Evidence |
|---|---|---|
| Patient app (Expo + /patient web) | done: 3 languages, voice agent with confirm-before-send, chips, live status, persistence, red flag not dismissable | docs/reports/w8-patient-mobile.md, w7-patient-mobile-voice.md |
| Clinician /review | done: evidence highlight, approve/edit/take over, receipts, emergency alerts, spoken/typed tags | docs/reports/w8-clinician-web.md |
| Pharmacist /pharmacy | done: reconciliation, med alerts (59 drugs, 18 interactions), server-enforced sign-off | docs/reports/w8-pharmacist-web.md |
| Ops /ops | done: "what needs you now", metrics, honest mock labels | docs/reports/w8-ops-dashboard.md |
| Engine | 1,872 tests (23 files, 2× clean runs); red flags 175/175, med rules 204/204, consult rules 80/80; consult assistant, vitals/NEWS2, orders + prescribing checks, Case trace | docs/reports/w18-engine.md |
| Reviews | Claude→Codex engine review, Codex→Claude UI reviews ×2, QA bug hunt, UX audit ×2, clinical safety review (CONDITIONAL_PASS → must-fixes done), Codex verification 22/25 then remaining fixed | docs/reports/w6-engine-review.md, w9-codex-final-review.md, w10-codex-verify.md, w7-qa-bugs.md, w8-ux-reaudit.md, w9-clinical-safety-review.md |
| Submission | deck PDF, cover v2, SUBMISSION.md, VIDEO-SCRIPT.md, SAFETY.md, README, Docker | pitch/, README.md |
| Public repo | https://github.com/KingPhuripol/MedX-AI | — |

## Blocked on the owner
1. AMD Token Factory key → set AMD_BASE_URL / AMD_API_KEY / AMD_MODEL in apps/web/.env.local, MODEL_PROVIDER=amd → run eval (`cd apps/web && npx vite-node ../../eval/run.ts -- --split dev`, then test + holdout), fill [pending AMD run] in deck/SUBMISSION.
2. Team names (deck slide 8, README).
3. Deploy approval (Vercel) if judges should get a live URL.

## Known limitations (also in pitch/SAFETY.md)
Keyword red-flag rules miss paraphrases (holdout 7/10); Gemma screen unmeasured; voice uses Apple/Google speech; no clinician login; pattern-based redaction; Thai/Italian need native review; SCBXBeta2 font licence risk accepted by owner.
