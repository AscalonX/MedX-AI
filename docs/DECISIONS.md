# Decisions log

- 2026-10-17 12:30 — Fresh build "MedX Bridge" in a new repo; old Senior Project untouched. Owner: user.
- 2026-10-17 12:40 — Model: Gemma on AMD (Token Factory). Public GitHub repo approved (cleaned, MIT). Owner: user.
- 2026-10-17 12:45 — Patient app native (Expo). Full TH/IT/EN. Owner: user.
- 2026-10-17 14:55 — Full standalone pharmacist screen added. Owner: user.
- 2026-10-17 15:00 — Visual direction v2: modern banking-app style (ref u-talk-ten.vercel.app), teal → ocean blue; supersedes "Clinical paper" palette. Safety semantics unchanged. Owner: user.
- 2026-10-17 14:30 — Red-flag rules v1.0 frozen for evaluation (eval/redflags.v1.0.frozen.json); blind holdout never used for tuning. Owner: orchestrator.
- 2026-10-17 15:30 — Font: SCBXBeta2 (Light/Regular/Bold .otf, from the owner's scbx-rd-template-deck.zip) used across web and mobile and committed to the public repo. Font metadata reads "Copyright © 2022 by __Designer__. All rights reserved." with no license text; orchestrator flagged the public-redistribution / affiliation risk; owner chose to use it everywhere including the public repo. Owner: user.
- 2026-10-17 16:45 — Owner approved pushing the repo to a public GitHub repository and asked the team to continue fixing/reviewing autonomously until production-ready. Deployment (Vercel) not yet approved. Owner: user.
- 2026-10-17 17:05 — Medication alerts: revert to PHARMACY-SPEC fail-safe — patient-reported "stopped" medicines are still checked by all med rules (alert text notes "patient says stopped — confirm"); no automatic discontinued status. Only a pharmacist marks a medicine discontinued. Owner: orchestrator (owner delegated autonomous fixing), per clinical safety review MF-2.
- 2026-10-17 17:05 — Patient "I'm at the desk" button: wording only (no false promise a nurse is coming), per clinical safety review MF-1. Owner: orchestrator.
