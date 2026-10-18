# w20 · Docs and pitch lead (README, HANDOFF, SPEC, DEPLOY, number and link sync)

## STATUS
done for my scope (README.md, HANDOFF.md, docs/, pitch/). Backlog items:
- M-10: my part is done. HANDOFF.md is English, and the Thai copy is kept at docs/HANDOFF.th.md.
- M-11: done.
- C-06: done.

The qa half of M-10 is not mine. `qa/32-english-default.mjs` already exists (QA agent, docs/reports/w20-qa.md). Its live-server checks were not run here (no server allowed); see TESTS.

Nothing is committed.

## SUMMARY
- **README.md, full rewrite in English.**
  - Banner (new, rendered from brand art), value proposition and honest badges: tests 2,436 passing, clinical rule checks 528 passing, demo model "mock · Gemma on AMD designed".
  - Live demo https://medx.areazeroai.com.
  - A "Watch" section with both videos. Each poster links to the live URL, with a link to the file in the repo. These are `/media/medx-promo.mp4` (60-second film) and `/media/medx-demo.mp4` (60-second walkthrough, captions).
  - "Try it in 2 minutes": a persona table that matches `DEMO_PERSONAS` (ids, staff names, stages, tasks, landing routes). It also covers the account menu (Sign out, Switch role), the "Who's signing in?" sheet, "Start a new visit" and the daily reset.
  - The problem, with sourced numbers (Divi 2007, the M1 to M6 range, Sinsky 2016, the 2025 arrivals figure).
  - The full 8-step journey table, using real current screen captures: patient, nurse, doctor, doctor orders, pharmacist 1 verify or return with options, pharmacist 2 dispense with the two-person check, pickup, ops and case trace.
  - Safety by design (8 rules).
  - A mermaid architecture diagram with the Neon snapshot store.
  - Tech stack with an honest model row (mock today, Gemma via AMD Token Factory designed).
  - Design: typography, motion, brand art.
  - Quick start (local, native patient app, Docker, AMD).
  - **"Deploy on Vercel":**
    - project settings;
    - the Neon step, with Upstash as an optional extra;
    - an env table;
    - CLI deploy from the repo root;
    - post-deploy QA commands;
    - `render.yaml` as the single-instance fallback.
  - Full env var table.
  - Tests, clinical checkers, the e2e and qa script table, and evaluation.
  - Project structure, limitations, team and licence.
  - The limitations keep "identity is self-declared" and "The demo runs a mock model", with the correct clone URL.
- **HANDOFF.md, English.**
  - Rewritten for the current state: links, local run, a prioritized pre-submission table (commit, deploy, AMD key, eval, lablab form, Doctor sign-offs, native review), how the demo works, key files and limits.
  - It names https://medx.areazeroai.com as the demo. The old medx-bridge.vercel.app appears once, marked "retired and is not the demo".
  - The Thai text is preserved verbatim at **docs/HANDOFF.th.md**, under a one-line English note.
- **docs/SPEC.md (new, C-06).** The spec of record. It covers:
  - a link table to docs/clinical/SPEC.md, CONSULT-SPEC.md and PHARMACY-SPEC.md (plus AI, design, architecture and deploy);
  - the claim boundary;
  - the 6 safety invariants with where each is enforced;
  - users and surfaces;
  - the end-to-end journey with audit events;
  - the `JourneyStage` model (10 stages, rules, precedence);
  - the 6 demo personas and the golden case;
  - identity in the demo (account menu, sign out, "Who's signing in?");
  - patient app behaviour ("Start a new visit");
  - a design summary (type, motion, Fin);
  - out of scope.
- **docs/DEPLOY.md (new).** It covers:
  - Vercel project `medx` (account kanompung1988). Its project settings: root `apps/web` with files outside the root included, Node 22, `sin1`, Fluid compute, and the `vercel.json` cron (`0 20 * * *` = 03:00 ICT).
  - The Neon store: setup, table, concurrency, size guard. Upstash is optional, and the in-memory per-instance rate limit is documented.
  - An env table that includes `MEDX_STRICT_ROLES=1`.
  - CLI deploy from the repo root with `--build-env MEDX_COMMIT`. The project is not Git-connected, by owner decision.
  - Domain medx.areazeroai.com: Vercel DNS in another account, possible `_vercel` TXT verification, CNAME.
  - Post-deploy checks, the daily reset, security, Docker and Render.
- **docs/ARCHITECTURE.md.**
  - The store row now describes the Neon Postgres snapshot store (optimistic concurrency; Upstash optional; file store locally). This is the owner decision 6 override of the "Redis" wording.
  - New sections: the request flow, a table of clinical writes after intake (two-stage pharmacy, pickup, trace), the patient-view allowlist, and contract updates.
  - Deployment covers Vercel, Docker and Render.
- **docs/DEMO.md.** Rewritten as the v3 runbook:
  - the persona table with what to show per role;
  - identity, sign out, "Who's signing in?" and "Start a new visit";
  - local setup;
  - the 14 seeded cases, with B-009 now at "Pharmacy check" (the old "collecting" path is gone);
  - the 13-step golden path that matches the walkthrough;
  - reset.
- **docs/PROGRESS.md.** New board (07:30 ICT) with the test count, checker results, the open items and the production status.
- **docs/DECISIONS.md.** Appended the six wave 20 owner decisions, the SCBX removal and the docs decisions.
- **Pitch:**
  - **SUBMISSION.md:**
    - live demo and both video URLs, and cover-v6;
    - a short description of 253 characters (checked with Node);
    - the long description with two-stage pharmacy and pickup;
    - evidence numbers synced: 175, 253 and 87 reference tests, 2,436 tests, e2e 113/113 (last recorded run);
    - an honest AMD paragraph and limitations.
  - **VIDEO-SCRIPT.md v4:** the two delivered videos (specs, re-render path, the walkthrough caption table), plus an updated narrated 3:00 script with the pharmacist 1 return, pharmacist 2 two-person dispense, pickup and the "mock model" ops beat.
  - **SAFETY.md:**
    - "About 18" became 18, and [TBD-METRIC] became [pending AMD run];
    - the consult consent step (verified in `_consult.tsx`) is now marked as built;
    - added the two-stage pharmacy, re-checks, redactActor, the sign-in sheet and strict roles, the consult outbox and store fail-closed.
  - **DECK-OUTLINE.md:** the header now describes the current 10-slide deck. The stale "1,041 tests" is gone, and "AMD hardware serves every model call" is reworded to the designed target.
  - **deck.html:**
    - Plus Jakarta Sans replaces SCBX, with local OFL woff2 files in `pitch/deck/fonts` and a licence;
    - current UI captures (`img/v3-*`) and 3D Fin;
    - slide 3 shows one journey with 6 steps and the current phone screens;
    - slide 6 shows the two-stage pharmacy and pickup;
    - slide 8 numbers: 59/253, 51/87, 2,436;
    - the live demo URL on slides 1 and 10.
  - **MedX-deck.pdf and png/slide-1..10.png** re-exported by the new `pitch/deck/render.mjs`.
  - **New submission cover `pitch/cover/cover-v6.png`.** cover-v4.png had a "Gemma on AMD" chip and a "chest pain" chip next to Fin; both break DIRECTION 11 and 12.1, and v6 has neither.
- **Fonts.** I deleted the unused SCBXBeta2 files in my scope (`docs/readme/*.otf`, `pitch/deck/fonts/*.otf`). The legacy `cover-v2.html` now points at the Jakarta files, because it referenced the deleted deck fonts.

## FILES CHANGED
- Rewritten:
  - `README.md`
  - `HANDOFF.md`
  - `docs/ARCHITECTURE.md`
  - `docs/DEMO.md`
  - `docs/PROGRESS.md`
  - `pitch/SUBMISSION.md`
  - `pitch/VIDEO-SCRIPT.md`
  - `pitch/SAFETY.md`
  - `pitch/deck/deck.html`
- New:
  - `docs/SPEC.md`
  - `docs/DEPLOY.md`
  - `docs/HANDOFF.th.md`
  - `docs/readme/banner.html`, `docs/readme/banner.png` (1600x800), `docs/readme/render-banner.mjs`
  - `pitch/deck/render.mjs`
  - `pitch/deck/fonts/plus-jakarta-sans-latin-{300,400,600,700,800}-normal.woff2`
  - `pitch/deck/fonts/LICENSE-plus-jakarta-sans.txt`
  - `pitch/deck/img/v3-{nurse.png,doctor.png,patient-intake,patient-pickup-phone,nurse-case,consult,pharmacy-verify,pharmacy-dispense,ops,trace}.webp` (copies of current captures)
  - `pitch/deck/img/fin3d-hello.webp`, `pitch/deck/img/fin3d-happy.webp`
  - `pitch/cover/cover-v6.html`, `pitch/cover/cover-v6.png`, `pitch/cover/render-cover-v6.mjs`
  - `docs/reports/w20-docs.md`
- Edited:
  - `docs/DECISIONS.md` (appended)
  - `pitch/DECK-OUTLINE.md` (header and AMD wording)
  - `pitch/cover/cover-v2.html` (font URLs)
- Re-exported:
  - `pitch/deck/MedX-deck.pdf` (5,643,002 bytes; it was 2,625,539)
  - `pitch/deck/png/slide-1.png` to `slide-10.png`
- Deleted:
  - `docs/readme/SCBXBeta2-{Bold,Light,Regular}.otf` (unreferenced; I checked with grep)
  - `pitch/deck/fonts/SCBXBeta2-{Bold,Light,Regular}.otf` (their only users were deck.html and cover-v2.html, both switched)

## TESTS RUN + RESULTS
- **Web unit tests.** `./node_modules/.bin/vitest run` (apps/web, Sun 18 Oct 07:14 ICT): exit 0.
  - `Test Files 51 passed (51)`, `Tests 2436 passed (2436)`, duration 61.10 s.
  - This matches the orchestrator's figure: 51 files, 2,436 tests, 59.60 s.
- **Clinical checkers** (node, repo root), all exit 0:
  - check-consultrules: `87 passed, 0 failed, 51 rules`
  - check-medrules: `253 passed, 0 failed · medrules 1.2 · 59 drugs, 13 allergen classes, 11 allergy rules, 18 interactions, 5 alternative entries`
  - check-redflags: `175 passed, 0 failed, 18 rules`
  - check-vitalrules: `13 cases + band coverage: all passed`
- **M-10 repo checks.** I ran the exact EN07, EN08 and EN09 logic of `qa/32-english-default.mjs` (same regexes) with node. The full script needs a server for EN01 to EN06; with no server it fails at the first fetch, as expected. Results:
  - EN07: PASS (0 Thai lines in HANDOFF.md)
  - EN08: PASS (docs/HANDOFF.th.md has Thai)
  - EN09: PASS (it names https://medx.areazeroai.com; the one medx-bridge line contains "retired" and "not")
  - `LC_ALL=C.UTF-8 grep -cP '[\x{0E00}-\x{0E7F}]' HANDOFF.md` returns `0`; the same on docs/HANDOFF.th.md returns `29`.
- **M-11 grep.** `grep -rnE '1,382|1,872|1,934|\[URL pending\]|Video: \[pending\]' README.md pitch docs/PROGRESS.md` returns 0 lines (exit 1).
- **"runs on AMD".** The string appears only in docs/HANDOFF.th.md line 32, inside the preserved Thai instruction "do not say runs on AMD". It is in none of README, HANDOFF, docs/*.md (other than that one), pitch/*.md, deck.html, banner or cover-v6.
- **Test count everywhere is 2,436.** I grepped for `N,NNN tests` across README, HANDOFF, docs/*.md, pitch/*.md and deck.html. The only other figure is 1,872 in the verbatim Thai copy (historical, and outside the M-11 grep scope).
- **Link check.** Every relative `](...)`, `src=` and `href=` target in README, HANDOFF, SPEC, DEPLOY, ARCHITECTURE, DEMO, PROGRESS, SUBMISSION, SAFETY, VIDEO-SCRIPT and HANDOFF.th exists (scripted check, 0 missing). The backticked file paths resolve as well; the only exceptions are URL paths, a runtime `/tmp` path and this report.
- **Renders** (Playwright from `C:\Users\User\medx-tools`). Each script checks that Plus Jakarta Sans actually loaded. I viewed every output:
  - `node docs/readme/render-banner.mjs`: exit 0.
  - `node pitch/deck/render.mjs`: exit 0, "wrote MedX-deck.pdf and 10 PNGs". I fixed one overlap on slide 3 and re-rendered.
  - `node pitch/cover/render-cover-v6.mjs`: exit 0. I fixed one chip overlap and re-rendered.
- **Production read-only check** (07:15 ICT):
  - `curl https://medx.areazeroai.com/api/health` returned `{"provider":"mock","model":"deterministic-mock","hardware":"—"}`, the old three-field body, so the wave 20 build is not deployed yet.
  - `/` returned 200 (30,156 bytes).
  - `HEAD /media/medx-demo.mp4` returned 404.
- **Not run:** next build, dev or start (wave rule); any qa script against a live server; docker.

## EVIDENCE
- Verified facts and where they come from:
  - **Personas:** `packages/shared/src/demo.ts`, plus `staff.ts` for the names.
  - **Journey stages:** `packages/shared/src/journey.ts`.
  - **Seeded cases (14) and the golden case:** `apps/web/lib/pipeline/seed.ts` and `data/cases/DEMO-GOLD.json`.
  - **Rule counts:** I read the JSON with node: consult 1.3 (51 rules, 12 presentations), red flags 1.1.1 (18 rules), medrules 1.2 (59 drugs, 31 with max daily dose, 18 interactions, 11 allergy rules, 13 allergens, 5 alternatives).
  - **Health body:** `app/api/health/route.ts`.
  - **Environment:** `.env.example`.
  - **Vercel config:** `vercel.json`, `next.config.ts` and the root `.vercelignore`. The root `.vercel/project.json` names project `medx`.
  - **Button labels:** I grepped "Return to prescriber", "Return with report", "Record final check and dispense", "Call patient", "Mark collected", "Approve supported fields", "Keep in note" and "Mock model (not AMD)".
  - **Consult consent step:** `_consult.tsx` lines 55, 151 and 325.
  - **Clone URL:** `git remote -v` gives `https://github.com/KingPhuripol/MedX-AI.git`.
- Images, all viewed:
  - `docs/readme/banner.png`
  - `pitch/cover/cover-v6.png`
  - `pitch/deck/png/slide-1.png`, `slide-3.png`, `slide-4.png`, `slide-5.png`, `slide-6.png`, `slide-7.png`, `slide-8.png`, `slide-10.png`
- Deck re-export command (repo root): `node pitch/deck/render.mjs` (set `PLAYWRIGHT_DIR` if Playwright is not in `~/medx-tools`).

## ASSUMPTIONS
- **FIXED PATHS override M-11's `/media/medx-60s-v1.mp4`.** The README links `/media/medx-demo.mp4` (walkthrough) and `/media/medx-promo.mp4` (film), as the brief asks.
- **Owner decision 6 overrides M-11's "Upstash step" and "Redis snapshot store".** README, ARCHITECTURE and DEPLOY describe the Neon step and the Neon snapshot store, with Upstash optional.
- **"The test count shown everywhere equals the M-12 report".** I used the final count the orchestrator gave (2,436 in 51 files), which I re-ran and confirmed. The w20-qa report (M-12) recorded 2,372 at 03:31, before the fixer's later tests.
- **The README poster links point at the live URL**, which serves the media only after the wave 20 deploy. Each poster also has a "file in this repo" link that works now.
- **The vercel commands are standard Vercel CLI usage.** `vercel link --project medx` and `vercel deploy --prod --build-env ...` were not executed by me; the orchestrator deploys.
- **The "Include files outside the root directory" setting** is documented as required, because the build imports `packages/shared` and `data/cases`. I did not read the live project settings.
- **Team names are not shown.** PROGRESS lists them as an owner decision that is still open.
- **E2E figures.** The README and SUBMISSION quote the e2e 113/113 as the "last recorded run" (w20-qa, 03:19 to 03:31 ICT). It ran before the fixer's later changes and has not been re-run since.

## RISKS
- **Live media.** The README and SUBMISSION video links (`https://medx.areazeroai.com/media/...`) return 404 until the wave 20 deploy. The deploy must upload `apps/web/public/media`; the root `.vercelignore` keeps it.
- **The film's quality gate.** Its final render was not re-reviewed by the critic (w20-promo). I describe it factually and make no quality claim.
- **Leftover files.**
  - `apps/web/app/fonts/SCBXBeta2-*.otf` still exist (outside my scope). They are unused by the web, but `pitch/cover/cover-v3/v4/v5-og.html` and `docs/design/logo/readme-banner.html` still reference them. Those sources break visually if the folder is deleted; the rendered PNGs are unaffected.
  - The old deck images in `pitch/deck/img` (consult-nurse.png and others) are no longer used by deck.html. I left them in place.
- **The OG image is still SCBX.** `apps/web/app/opengraph-image.png` was rendered from cover-v5-og with the SCBX font (outside my scope).
- **DIRECTION.md section 3 is stale.** Its "Mobile" line still says SCBXBeta2; the patient app now uses Jakarta and Noto (w20-patient-polish). This is the design lead's file.
- **Deck size.** MedX-deck.pdf grew to 5.6 MB because the new captures are full colour. That is fine for lablab upload limits as far as I know, but I have not verified it against the form.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
1. **Orchestrator:**
   - commit the new and deleted files listed above together with the other w20 files;
   - deploy, then re-check that the README and SUBMISSION video URLs return 200;
   - optionally delete `apps/web/app/fonts/SCBXBeta2-*.otf` and the unused `pitch/deck/img` legacy images. If the fonts are deleted, switch cover-v3, cover-v4 and cover-v5-og and readme-banner.html to the Jakarta files in `pitch/deck/fonts` first.
2. **Design lead:**
   - update DIRECTION.md section 3 "Mobile" (the patient app now ships Plus Jakarta Sans and Noto Sans Thai);
   - optionally re-render `docs/design/logo/readme-banner.png` and the OG card with Jakarta.
3. **Owner:**
   - use `pitch/cover/cover-v6.png` as the lablab cover instead of cover-v4.png;
   - provide team names if they should appear.
4. **QA or orchestrator:** after the deploy, run the full `BASE=https://medx.areazeroai.com QA_REPO_CHECKS=1 node qa/32-english-default.mjs` (EN01 to EN09).
5. No contract change requests.

## NEXT ACTION
The orchestrator commits and deploys (M-13), then runs the post-deploy commands in docs/DEPLOY.md section 7. If the AMD key arrives, fill "[pending AMD run]" in README, SUBMISSION and deck.html from `eval/REPORT.md`, then run `node pitch/deck/render.mjs`.
