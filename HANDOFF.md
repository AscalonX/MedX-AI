# MedX: handoff for teammates

Updated: Sun 18 Oct 2026, about 07:30 ICT. Submission deadline: **Sun 18 Oct 2026, 17:00 ICT** (internal target 15:00) on lablab, AMD Developer Hackathon ACT III, Track 2 (Health and Wellbeing).
The earlier Thai copy of this handoff (Sat 17 Oct, 22:00) is kept at [docs/HANDOFF.th.md](docs/HANDOFF.th.md). This English file is the current one.

## 1. What MedX is (30 seconds)

Multilingual pre-visit intake and care journey for clinics where patient and staff do not share a language (Thai, Italian, English; English is the default everywhere, Thai and Italian are one toggle away).

**Patient** tells Fin what brings them in, by voice or text, and checks the words before sending → **Nurse** reviews fields that each cite the patient's sentence, records vitals and confirms a NEWS2-based triage suggestion → **Doctor** runs the consult with doctor-only considerations (not a diagnosis), signs the note and writes orders with deterministic checks (allergy, interaction, duplicate, pregnancy, dose range) → **Pharmacist 1** verifies, or returns with a report and options for prescriber review → **Pharmacist 2** does a six-item final check and dispenses (the verifier cannot dispense) → **Pickup**: the phone shows the counter and the code → **Ops** sees the queue and the pharmacy pipeline; **Case trace** shows every rule check, model call and human decision.

Every field points back to the patient's own words. Red flags are deterministic code that runs before any model. **The AI never diagnoses, prescribes or decides urgency; a person confirms every step.** Synthetic data only. Mascot: **Fin** the dolphin.

## 2. Links

| What | Where |
|---|---|
| Live demo | **https://medx.areazeroai.com** (persona hub: https://medx.areazeroai.com/demo) |
| 60-second film | `apps/web/public/media/medx-promo.mp4` (served at `/media/medx-promo.mp4`) |
| 60-second product walkthrough | `apps/web/public/media/medx-demo.mp4` (served at `/media/medx-demo.mp4`, captions `/media/medx-demo.en.vtt`) |
| Repo | https://github.com/KingPhuripol/MedX-AI |
| Deck | `pitch/deck/MedX-deck.pdf` (source `pitch/deck/deck.html`) |
| Submission copy | `pitch/SUBMISSION.md` |
| Deploy guide | `docs/DEPLOY.md` |
| Spec of record | `docs/SPEC.md` |

The older Vercel URL medx-bridge.vercel.app is retired and is not the demo; do not share it.

Production status at about 07:15 ICT: https://medx.areazeroai.com still served the previous build (`/api/health` returned the old three-field body, no `/media` files). The wave 20 deploy is pending (orchestrator, M-13).

## 3. Run it locally (5 minutes)

```bash
git clone https://github.com/KingPhuripol/MedX-AI.git && cd MedX-AI
npm --prefix apps/web install
cd apps/web && MODEL_PROVIDER=mock DEMO_SEED=1 DEMO_AUTOSEED=1 DEMO_TOKEN=pick-a-secret npm run dev
# open http://localhost:3000 (14 synthetic demo cases are seeded automatically)
# reset the demo data: curl -X POST -H "x-demo-token: pick-a-secret" localhost:3000/api/demo/reset
```

- Pages: `/` (landing) · `/demo` (pick a role) · `/review` (nurse, doctor) · `/review/<id>/consult?mode=nurse|doctor` · `/review/<id>/vitals` · `/review/<id>/orders` · `/review/<id>/trace` · `/pharmacy` · `/ops` · `/patient/` (patient app, web export).
- Native patient app: `cd apps/mobile && npm install && npx expo start` (see `docs/DEMO.md`). After changing `apps/mobile/src` or `packages/shared/src`, run `bash scripts/build-patient-web.sh`.
- Docker: `docker build -f apps/web/Dockerfile -t medx . && docker run -p 3000:3000 -e MODEL_PROVIDER=mock -e DEMO_SEED=1 -e DEMO_AUTOSEED=1 -e DEMO_TOKEN=pick-a-secret medx`
- Tests: `cd apps/web && ./node_modules/.bin/vitest run` (2,436 tests in 51 files, all passing at 07:14 ICT). Clinical rules, from the repo root: `node docs/clinical/check-redflags.mjs` (175/175), `check-medrules.mjs` (253/253), `check-consultrules.mjs` (87/87), `check-vitalrules.mjs` (all passed).
- Whole journey against a running server: `BASE=http://localhost:3000 node scripts/e2e-journey.mjs`.

## 4. What is left before submission (in priority order)

| # | Task | Who | How |
|---|---|---|---|
| 1 | **Commit the wave 20 work** | Orchestrator | Many build inputs are untracked (landing, `/demo`, store, media, brand art, patient export, `tsconfig.build.json`, `vercel.json`, both `.vercelignore` files). A partial commit breaks the GitHub copy; see `docs/reports/w20-gates.md`. Push to GitHub. |
| 2 | **Deploy to Vercel** (M-13) | Orchestrator | Follow `docs/DEPLOY.md`: from the repo root, `vercel deploy --prod --build-env MEDX_COMMIT=$(git rev-parse --short HEAD)`. Set `MEDX_STRICT_ROLES=1`, `CRON_SECRET`, `DEMO_TOKEN`, `DEMO_SEED=1`, `DEMO_AUTOSEED=1`, `MODEL_PROVIDER=mock`. `DATABASE_URL` (Neon) is already set. Then run the post-deploy QA commands in `docs/DEPLOY.md` and check `/api/health` reports `store: "postgres"`. |
| 3 | **AMD key (required by the hackathon rules)** | Team owner on lablab | Finish the team on lablab → https://notebooks.amd.com/tokenfactory → copy the base URL, API key and Gemma model id. Locally put them in `apps/web/.env.local` (`MODEL_PROVIDER=amd`, `AMD_BASE_URL`, `AMD_API_KEY`, `AMD_MODEL`; never commit it), restart, and check `curl localhost:3000/api/health` reports `amd-tokenfactory` with `providerConfigured: true`. On Vercel, add the same variables and redeploy. |
| 4 | Evaluation on AMD | Done 18 Oct (AI lane) | Results are in `eval/REPORT.md` (Gemma-4-31B-IT on AMD-hosted models, synthetic, small n): thresholds for field accuracy and latency not met; holdout recall 7/10 rules only, 9/10 with the Gemma screen. Open follow-up: raise the pipeline turn/extract timeouts (extraction takes about 39 s p50) and re-run; commands in `eval/README.md`. Placeholders replaced in README, SUBMISSION, SAFETY and deck v2; `pitch/deck/deck.html` (v3) and the older docs still say pending. |
| 5 | Fill in the lablab form | Team owner | Text from `pitch/SUBMISSION.md` (short and long description, tags, limitations). Cover `pitch/cover/cover-v6.png`, deck `pitch/deck/MedX-deck.pdf`, the GitHub repo, the live demo link, and the film (`medx-promo.mp4`) and walkthrough (`medx-demo.mp4`). While `/api/health` reports mock, **do not claim the demo uses AMD hardware**: say Gemma on AMD is the designed target and the measurement is pending. |
| 6 | Clinical sign-offs | Doctor | CR-THROAT-05 (consult rules 1.3, the golden demo case), the known red-flag gaps listed in `docs/reports/w20-qa.md` (two paraphrased chest-pain lines that rules alone miss), and RF-ANAPH-01 firing on a past hives reaction. |
| 7 | Native-speaker review (if time allows) | Anyone fluent | Thai and Italian strings were written with AI help: `apps/mobile/src/i18n.ts`, `apps/web/app/**/_i18n.ts`, `apps/web/app/_landing/copy.ts`, `packages/shared/src/redflags.json` (patient messages). |

## 5. How the demo works (for whoever presents it)

- Visitors pick one of six roles on the landing page or `/demo`: Patient, Nurse (Anna Rossi), Doctor (Marco Bianchi), Pharmacist 1 (Laura Conti), Pharmacist 2 (Nattaya Wong), Clinic operations (Elena Greco). Staff cards open a fresh synthetic case at that person's step. Runbook: `docs/DEMO.md`.
- **Account menu** on every staff page: "Signed in as", "Demo identity · synthetic staff", **Switch role** (to `/demo`) and **Sign out** (clears the demo identity from this browser and returns to `/demo` with a "Signed out." notice).
- **"Who's signing in?"** sheet: a staff page opened with no identity can be read, but any write waits until a synthetic staff member is chosen. It never covers a red flag.
- Patient app: **Start a new visit** on Home and Help clears the visit from this phone only (the care team keeps what was sent), with an extra warning if medicine is still waiting at the pharmacy.
- The public demo resets daily at 03:00 ICT (Vercel Cron). A manual reset: `curl -X POST -H "x-demo-token: $DEMO_TOKEN" https://medx.areazeroai.com/api/demo/reset`.

## 6. Key files

- Team rules: `CLAUDE.md` · decisions: `docs/DECISIONS.md` · status: `docs/PROGRESS.md` · spec of record: `docs/SPEC.md`
- Clinical rules (Doctor-owned): `packages/shared/src/{redflags,medrules,consultrules,vitalrules,investigations}.json`, `docs/clinical/*`
- AI design, prompts and metrics: `docs/ai/DESIGN.md`, `docs/ai/METRICS.md`, `apps/web/lib/pipeline/`
- Design: `docs/design/DIRECTION.md` (v3.1: Plus Jakarta Sans and Noto Sans Thai, motion system, Fin rules in section 11), components in `apps/web/components/ui/`
- Deploy: `docs/DEPLOY.md`, `apps/web/vercel.json`, `.vercelignore`, `render.yaml`
- Every wave report (reviews, QA, UX, safety): `docs/reports/`
- Pitch: `pitch/` (deck, cover, film source, video script, submission copy, safety answers)

## 7. Limits to say out loud (already in README and SUBMISSION)

Synthetic data only, not clinically validated, not a medical device. The demo runs a mock model; Gemma on AMD is not measured yet. Keyword red-flag rules miss paraphrases (7 of 10 emergencies on the 18-case blind holdout). Speech goes to the browser's or phone's cloud speech service. There is no real login: reviewer identity is self-declared, so the two-person dispense check is procedural. Redaction is pattern-based. The prescribing rule set is small (59 drugs, 18 interactions, adult dose ceilings for 31). Considerations come from a fixed 12-presentation list. The earlier SCBXBeta2 font is no longer used by the web or the patient app (now Plus Jakarta Sans and Noto Sans Thai, both OFL).
