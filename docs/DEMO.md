# Demo runbook (recorded 3-minute video)

Script: [pitch/VIDEO-SCRIPT.md](../pitch/VIDEO-SCRIPT.md). Synthetic data only. Say "supports" and "flags for the clinician", never "diagnoses".

## 0. Setup (before recording)

```bash
# server, with or without a live AMD key
cd apps/web
DEMO_SEED=1 MODEL_PROVIDER=amd npm run dev        # or MODEL_PROVIDER=mock; or the Docker one-liner in README
curl -X POST -H "x-demo-token: $DEMO_TOKEN" localhost:3000/api/demo/reset   # needs DEMO_SEED=1 and DEMO_TOKEN set on the server; wipes and replays 11 synthetic cases
curl localhost:3000/api/health                    # must say provider "amd-tokenfactory" if you narrate "Gemma on AMD"
```

If `/api/health` says `mock`, do **not** say Gemma on AMD in the voice-over and do not show the AMD footer as live (video script, recording notes).

Mobile without the dev menu: use a release-like web build or a clean Simulator.

```bash
scripts/build-patient-web.sh     # patient app at http://localhost:3000/patient/index.html
# or native: cd apps/mobile && EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --no-dev --minify
#   then press i (iOS Simulator). --no-dev removes the dev menu/overlays. Shake/Cmd+D must not be used.
```

Browser: window 1440 wide, hide bookmarks bar, language switch set per segment. The Next dev badge is already off (`devIndicators: false`).

## Seeded cases (after `POST /api/demo/reset`; codes follow creation order)

| Code | Fixture | Language | State | Use it to show |
|---|---|---|---|---|
| B-001 | EN-05 | en | escalated | Suicide-risk red flag interrupt (rule RF-SUICIDE-01) |
| B-002 | TH-05 | th | escalated | Chest pain red flag (RF-CHEST-01/02), Thai patient |
| B-003 | EN-01 | en | awaiting review | Clean summary, evidence highlight, approve |
| B-004 | IT-01 | it | awaiting review | Italian patient, English clinician summary, click field to highlight Italian sentence |
| B-005 | EN-04 | en | needs human | Abstain on vague input ("I don't feel right") |
| B-006, B-007 | EN-03, IT-03 | en, it | collecting | Open follow-up question (live conversation start) |
| B-008 | EN-02 | en | approved | Audit log after approval |
| B-009 | MED-01 | th | collecting | Pharmacist: penicillin allergy vs Augmentin (MR-ALLERGY-PEN) |
| B-010 | MED-05 | it | collecting | Pharmacist: max dose alert (MR-MAXDOSE-01) |
| B-011 | MED-03 | th | needs human | Pharmacist: warfarin plus ibuprofen (MR-INT-01), abstained summary with unsupported fields in pencil |

Live segments (Italian tourist, buried Thai red flag) are typed fresh in the patient app, not seeded. Use the fixtures' wording from `data/cases/IT-03.json` and `data/cases/TH-05.json`, or write your own synthetic text. Ctrl-F the codes in `/review` and `/pharmacy` queues.

## 3-minute path

1. 0:00 Title and problem (slides, no app).
2. 0:20 Patient app, Italian: start a new intake (IT), describe stomach pain; the app asks one follow-up (e.g. allergies) in Italian; answer. Show "a nurse will review this".
3. 0:50 `/review`, clinician language English: open the new session (or B-004). Click "Onset": highlighter sweeps to the Italian sentence. Point at a pencil "unsupported" field and the ink-density confidence. Footer shows provider and latency (only if live AMD).
4. 1:25 Patient app, Thai: type a long message with chest pain and cold sweat buried mid-sentence. Phone goes to the red-flag screen with the session code. Cut to `/review` on that session (or B-002): red interrupt, rule label, patient sentence highlighted.
5. 1:55 Model-suggested flag: a lay-wording case where rules do not fire but the Gemma screen does (needs live AMD; skip on mock, per the script cut order).
6. 2:10 Edit one field (old value struck, initials), Approve, open the audit panel.
7. 2:30 `/ops`: queue by urgency, escalations, abstain rate, latency p50/p95. Optional `/pharmacy` B-011 for medication alerts if time allows.
8. 2:40 Results slide: copy numbers from `eval/REPORT.md` only if the run was on the AMD provider; otherwise say the evaluation harness exists and results are pending. Replace every [TBD-METRIC] first.
9. 2:50 Safety slide ([pitch/SAFETY.md](../pitch/SAFETY.md)) and close: "Supports clinicians. Research prototype."

## Reset between takes

```bash
curl -X POST -H "x-demo-token: $DEMO_TOKEN" localhost:3000/api/demo/reset   # idempotent; wipes sessions and audit, reseeds
```
