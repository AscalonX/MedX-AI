# w20 orchestrator report: launch wave, merge, deploy

STATUS: done

## SUMMARY
- Wave 19 (two-stage pharmacy, pickup, CRLF-safe tests) and wave 20 (landing + /demo personas, redesign with 3D Fin, Plus Jakarta Sans + Noto Sans Thai, motion, sign-out, Neon shared store, security, English default, promo + walkthrough videos) are committed on `feat/pharmacy-two-stage`.
- origin/main (af48f8a visit-workflow + review UI fixes, pitch deck v2, submission copy) was merged with both sides kept; an independent verifier checked every hunk of the team's commits.
- `main` was fast-forwarded to `caf2918` and pushed. Production is live at https://medx.areazeroai.com (Vercel project `medx`, region sin1, Neon Postgres store).

## FILES CHANGED
- Commits: `38e3382` (wave 19), `be1ce42` (wave 20), `caf2918` (merge of origin/main).
- Orchestrator edits before commit: `apps/web/app/globals.css` (page guard no longer sets transform/translate, so the sign-in sheet stays on screen on urgent pages), `apps/web/app/(ops)/components/OpsDashboard.tsx` (no identity write on mount), `apps/web/components/ui/motion.test.ts` (asserts the new page guard), removed unused SCBXBeta2 `.otf` copies from `apps/web/app/fonts` and `apps/mobile/assets/fonts`.

## TESTS RUN + RESULTS
- Pre-merge gate (working tree): vitest 2,436/2,436 (51 files); tsc 0 errors; eslint 0 errors; `next build` 24/24 pages; clinical checkers: consult 87/0, medrules 253/0, red flags 175/0, vitals all passed.
- Post-merge gate (verifier agent): vitest 2,451/2,451 (53 files), tsc, eslint, next build, clinical checkers, apps/mobile tsc + lint, patient export freshness: all green; no conflict markers.
- Production smoke (https://medx.areazeroai.com, commit caf2918):
  - Pages 200: `/`, `/th`, `/it`, `/demo`, `/home`, `/review`, `/pharmacy`, `/ops`, `/patient`; media 200: `/media/medx-promo.mp4` (24.3 MB), `/media/medx-demo.mp4` (3.5 MB).
  - `/api/health`: store `postgres`, storeOk true, provider `mock`, region sin1.
  - Demo autoseed: 14 cases with journey stages; `/api/demo/cases` maps all 6 personas.
  - Cross-instance consistency: one session created, read 8/8 times (200); a patient turn written and read back 3/3 times with the same state.
  - Security headers present (CSP, HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy microphone=self); `POST /api/demo/reset` without a token returns 404.
  - QA scripts against production: qa/30 deploy coherence 7/7, qa/31 landing 34/34, qa/32 English default 15/15.

## EVIDENCE
- Workflow reports: `docs/reports/w19-*.md`, `docs/reports/w20-*.md`, `docs/reports/2026-10-18-merge-main-engineer.md`.
- Video stills and checks: `docs/reports/w20-video.md`, `docs/reports/w20-promo.md`.

## ASSUMPTIONS
- Production runs the deterministic mock model (`MODEL_PROVIDER=mock`): no AMD key is configured, and the UI and health endpoint say so.
- Production env passed at deploy time: `MODEL_PROVIDER=mock`, `DEMO_SEED=1`, `DEMO_AUTOSEED=1`, `MEDX_STRICT_ROLES=1`, `NEXT_PUBLIC_SITE_URL`. `DATABASE_URL` comes from the Neon store connected to the project.
- `DEMO_TOKEN` and `CRON_SECRET` are not set, so manual demo reset and the daily cron reset are disabled (fail closed).

## RISKS
- The Neon credentials were pasted in a chat during setup; rotate the database password after the event.
- Preview and production share one Neon database; any test against a preview writes to the production demo data.
- The new consult rule CR-THROAT-05 and the new golden-case pathway were written during review fixes and need Doctor sign-off.
- Thai and Italian strings added in waves 19-20 still need native review.
- SCBXBeta2 copies remain in `docs/readme/` and older `pitch/cover/*` files (not used by the product).

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- Clinician header: the merge kept "Orders" visible for every role (the orders page blocks nurse writes server-side) and the Consult link on approved cases; the team's ui-fixes report proposed doctor-only Orders. Product owner to confirm.
- `packages/shared/src/tokens.ts` still names `--font-scbx` as a fallback in the web stack and keeps the unused mobile SCBX helpers; harmless, clean up when the patient export is next rebuilt.

## PROMO FINAL CUT
- `apps/web/public/media/medx-promo.mp4`: 60.00 s, 1920x1080, 60 fps, H.264 + AAC, 19.56 MB, -14.3 LUFS, true peak -1.6 dBTP; QR decodes to https://medx.areazeroai.com. Motion and brand critics both pass after the fix round (true-scale statistic on a 0-100% track with source, Fin only on the end card, no double exposures, readable holds >= 1.2 s, real 2x/3x UI captures). Source to re-render: `pitch/promo/`.

## NEXT ACTION
- Optional: set `DEMO_TOKEN` and `CRON_SECRET` in the Vercel project to enable demo resets.
