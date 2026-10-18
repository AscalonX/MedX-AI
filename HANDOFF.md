# MedX: handoff for teammates

Updated: Sun 18 Oct 2026, after the AMD evaluation run (12:38 ICT). Submission deadline: **Sun 18 Oct 2026, 17:00 ICT** (internal target 15:00) on lablab, AMD Developer Hackathon ACT III, Track 2 (Health and Wellbeing).
The earlier Thai copy of this handoff (Sat 17 Oct, 22:00) is kept at [docs/HANDOFF.th.md](docs/HANDOFF.th.md). This English file is the current one.

## 1. What MedX is (30 seconds)

Multilingual pre-visit intake and care journey for clinics where patient and staff do not share a language (Thai, Italian, English; English is the default everywhere, Thai and Italian are one toggle away).

**Patient** tells Fin what brings them in, by voice or text, and checks the words before sending → **Nurse** reviews fields that each cite the patient's sentence, records vitals and confirms a NEWS2-based triage suggestion → **Doctor** runs the consult with doctor-only considerations (not a diagnosis), signs the note and writes orders with deterministic checks (allergy, interaction, duplicate, pregnancy, dose range) → **Pharmacist 1** verifies, or returns with a report and options for prescriber review → **Pharmacist 2** does a six-item final check and dispenses (the verifier cannot dispense) → **Pickup**: the phone shows the counter and the code → **Ops** sees the queue and the pharmacy pipeline; **Case trace** shows every rule check, model call and human decision.

Every field points back to the patient's own words. Red flags are deterministic code that runs before any model. **The AI never diagnoses, prescribes or decides urgency; a person confirms every step.** Synthetic data only. Mascot: **Fin** the dolphin.

## 2. Links

| What | Where |
|---|---|
| Live demo | **https://medx.areazeroai.com** (persona hub: https://medx.areazeroai.com/demo) |
| 60-second film (voice-over) | `apps/web/public/media/medx-promo-voice.mp4` (served at `/media/medx-promo-voice.mp4`) |
| Narrated product walkthrough (2 min 15 s) | `apps/web/public/media/medx-demo-narrated.mp4` (served at `/media/medx-demo-narrated.mp4`, captions `/media/medx-demo-narrated.en.vtt`) |
| Repo | https://github.com/KingPhuripol/MedX-AI |
| Deck | `pitch/deck/MedX-deck.pdf` (source `pitch/deck/deck.html`) |
| Submission copy | `pitch/SUBMISSION.md` |
| Deploy guide | `docs/DEPLOY.md` |
| Spec of record | `docs/SPEC.md` |

The older Vercel URL medx-bridge.vercel.app is retired and is not the demo; do not share it.

Production status: https://medx.areazeroai.com runs on the hackathon's AMD Token Factory (OpenAI-compatible endpoint, base `https://developer.amd.com.cn/radeon/api/v1`). Gemma-4-31B-IT runs the add-only red-flag safety screen and the next question; DeepSeek-V4-Flash (`AMD_EXTRACT_MODEL`) runs the long structured extraction. `/api/health` reports provider `amd-tokenfactory`, model `Gemma-4-31B-IT`, extractModel `DeepSeek-V4-Flash`, hardware `AMD (via Token Factory)`. Every model call records its model id in the audit trail and the Case trace. The narrated walkthrough video was recorded on the deterministic mock model for reproducibility.

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
| 1 | **Commit the AMD changes** | Orchestrator | The working tree still holds the AMD changes (pipeline timeouts and 429 retries, `AMD_EXTRACT_MODEL`, the Case trace fix, the patient app's 58 s wait and its rebuilt web export, `eval/REPORT.md`, these docs); the evaluation was recorded on `26b1bb2` with uncommitted changes. Commit them together and push to GitHub. |
| 2 | **Deploy to Vercel** (M-13) | Orchestrator | The live site already runs on AMD. For every redeploy follow `docs/DEPLOY.md`: from the repo root, `vercel deploy --prod --build-env MEDX_COMMIT=$(git rev-parse --short HEAD)`. Production env: `MEDX_STRICT_ROLES=1`, `CRON_SECRET`, `DEMO_TOKEN`, `DEMO_SEED=1`, `DEMO_AUTOSEED=1`, `MODEL_PROVIDER=amd`, `AMD_BASE_URL`, `AMD_API_KEY` (secret), `AMD_MODEL=Gemma-4-31B-IT`, `AMD_EXTRACT_MODEL=DeepSeek-V4-Flash`, `AMD_JSON_SCHEMA=true`. `DATABASE_URL` (Neon) is already set. Then run the post-deploy QA commands in `docs/DEPLOY.md` and check `/api/health` reports `store: "postgres"` and `provider: "amd-tokenfactory"`. |
| 3 | ~~AMD key (required by the hackathon rules)~~ **Done** | Team owner on lablab | The team key is set on Vercel and the live demo runs on the AMD Token Factory. Locally: put the same variables in `apps/web/.env.local` (never commit it), restart, and check `curl localhost:3000/api/health` reports `amd-tokenfactory` with `providerConfigured: true`. One key is shared by the whole team, so its concurrency and spend limits are shared too. |
| 4 | ~~Evaluation on AMD~~ **Done** | Anyone | Run `2026-10-18T05-38-22-421Z`, split test, in `eval/REPORT.md` (read its orchestrator note: extraction used DeepSeek-V4-Flash). Headline: precision 88.1% (NOT MET, ≥ 90%), capture recall 26.2% (NOT MET, ≥ 70%, depressed by provider failures), hallucination 3.4% (met), unsupported with verifier 11.9% (NOT MET, ≤ 5%), in-sample red-flag recall 8/8 (met) with 13.6% false alarms (NOT MET, ≤ 10%), blind holdout rules alone 7/10 and rules + Gemma screen 8/10 (NOT MET, ≥ 9/10), turn p50 38.4 s / p95 42.2 s (NOT MET, ≤ 6 s / ≤ 12 s). Shared key: 34 of 111 calls succeeded (47 HTTP 429, 30 timeouts). README, SUBMISSION and SAFETY carry these numbers. Still to do: refresh the AMD cells in `pitch/deck/deck.html` (and `deck-v2.html` / `build-v2.py`), then re-export the deck PDF (`docs/reports/w20-docs.md` has the command). |
| 5 | Fill in the lablab form | Team owner | Text from `pitch/SUBMISSION.md` (short and long description, tags, limitations). Cover `pitch/cover/cover-v6.png`, deck `pitch/deck/MedX-deck.pdf`, the GitHub repo, the live demo link, and the film (`medx-promo-voice.mp4`) and walkthrough (`medx-demo-narrated.mp4`). Say the live demo runs on the hackathon's AMD Token Factory (Gemma-4-31B-IT and DeepSeek-V4-Flash), report every NOT MET as not met, and say the walkthrough was recorded on the mock model. |
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

Synthetic data only, not clinically validated, not a medical device. The live demo runs on the AMD Token Factory, and the measured results miss several targets: a patient turn takes p50 38.4 s (target 6 s), field precision 88.1% (target 90%), unsupported claims 11.9% (target 5%), capture recall 26.2% (target 70%, depressed because only 34 of 111 calls succeeded on the shared team key; failed calls abstain to human review). The walkthrough video was recorded on the mock model. Keyword red-flag rules miss paraphrases (7 of 10 emergencies on the 18-case blind holdout; 8 of 10 with the Gemma screen, target 9 of 10). Speech goes to the browser's or phone's cloud speech service. There is no real login: reviewer identity is self-declared, so the two-person dispense check is procedural. Redaction is pattern-based. The prescribing rule set is small (59 drugs, 18 interactions, adult dose ceilings for 31). Considerations come from a fixed 12-presentation list. The earlier SCBXBeta2 font is no longer used by the web or the patient app (now Plus Jakarta Sans and Noto Sans Thai, both OFL).
