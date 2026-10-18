# Progress board: Sun 18 Oct 2026, 07:30 ICT

## Status: wave 20 built and green on the working tree; commit and Vercel deploy pending; Gemma on AMD still unmeasured (no key)

Deadline: Sun 18 Oct 2026, 17:00 ICT (internal 15:00). Live demo: https://medx.areazeroai.com (at 07:15 ICT it still served the previous build; the wave 20 deploy is pending, M-13).

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
| Docs and pitch | done: README rewrite, English HANDOFF (Thai copy in docs/HANDOFF.th.md), SPEC.md, DEPLOY.md, ARCHITECTURE, DEMO, SUBMISSION, VIDEO-SCRIPT, SAFETY, deck numbers | docs/reports/w20-docs.md |
| Public repo | https://github.com/KingPhuripol/MedX-AI | |

## Open, in order

1. **Orchestrator:** commit every wave 20 file (many are untracked; see docs/reports/w20-gates.md), push, then deploy from the CLI (docs/DEPLOY.md) with `MEDX_STRICT_ROLES=1`, `CRON_SECRET`, `DEMO_TOKEN`; run the post-deploy QA.
2. **Owner:** AMD Token Factory key → `MODEL_PROVIDER=amd` with `AMD_BASE_URL`, `AMD_API_KEY`, `AMD_MODEL` → run the evaluation (`cd apps/web && npx vite-node ../../eval/run.ts -- --split dev`, then test and holdout) → fill "[pending AMD run]" in the deck, SUBMISSION and README.
3. **Doctor:** sign off CR-THROAT-05 (golden case), review the known red-flag paraphrase gaps and RF-ANAPH-01 on a past hives reaction.
4. **Owner:** team names for the deck and README, if they should be shown.
5. **Anyone fluent:** native review of Thai and Italian strings.

## Known limitations (also in README, SUBMISSION and pitch/SAFETY.md)

Synthetic data only; not a medical device. The demo runs a mock model. Keyword red-flag rules miss paraphrases (holdout 7/10). Voice uses the device's cloud speech service. No real login: identity is self-declared. Pattern-based redaction. Small prescribing rule set. Thai and Italian need native review.
