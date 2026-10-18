# Demo runbook (v3 journey)

Synthetic data only. Say "supports", "suggests for review" and "flags for the clinician"; never "diagnoses". The live demo runs on the AMD Token Factory (`/api/health`: `provider: "amd-tokenfactory"`, model Gemma-4-31B-IT, extractModel DeepSeek-V4-Flash). Quote only numbers from eval/REPORT.md, including the missed targets (turn latency p50 38.4 s). A local run with `MODEL_PROVIDER=mock` shows the label "mock model, not AMD"; say so if you record locally.

## 1. The live demo in 2 minutes

Open https://medx.areazeroai.com and use **Try a role**, or go to https://medx.areazeroai.com/demo. Each card signs the visitor in as one synthetic person (`DEMO_PERSONAS`, `packages/shared/src/demo.ts`) and opens their starting point. Staff cards build a **fresh copy of the golden case** at that person's step through the real engine (`POST /api/demo/start`); if that fails they open the shared seeded case instead.

| Persona | Signed in as | Case starts at | Lands on | Show this |
|---|---|---|---|---|
| Patient | (patient) | Intake | `/patient/?new=1&lang=en` | Pick the "Try saying" example "Sore throat, white spots on the tonsils, penicillin allergy", check the words, send, read the visit code and the timeline. Or tap the mic and speak. |
| Nurse | Nurse Anna Rossi | Intake | `/review/<id>` | Click Allergies: the patient's sentence "penicillin, it gave me a rash" highlights. "Approve supported fields". Open Vitals: the NEWS2-based suggestion, then "Confirm level". |
| Doctor | Dr. Marco Bianchi | Ready for doctor | `/review/<id>/consult?mode=doctor` | The considerations card ("consider bacterial tonsillitis: check the FeverPAIN or Centor score", labelled not a diagnosis, NICE NG84 link): "Keep in note". Draft and sign the note. Orders: amoxicillin 500 mg raises the deterministic High "Allergy conflict" with "Options to review" (clarithromycin, doxycycline). |
| Pharmacist 1 (verify) | Pharmacist Laura Conti | Pharmacy check | `/pharmacy/<id>` | The order with the allergy alert and the prescriber's override reason. "Return to prescriber", then "Return with report" with a note, the flagged alert and clarithromycin as an option for prescriber review; or "Verify". |
| Pharmacist 2 (dispense) | Pharmacist Nattaya Wong | Dispensing | `/pharmacy/<id>` | The six-item final check, every box unticked; "Record final check and dispense" stays disabled until all six are ticked. Then "Call patient" to counter 2 and, later, "Mark collected". |
| Clinic operations | Head Nurse Elena Greco | Ready to collect | `/ops` | Queue by urgency, escalations, abstain rate, the pharmacy flow (to verify, to dispense, called to the counter, collected today) and the model label "Mock model (not AMD)". |

To show the two-person rule, sign in as Pharmacist Laura Conti on a case she verified: the dispense panel shows "A second pharmacist must dispense" and offers "Sign in as Pharmacist Nattaya Wong".

The patient and the nurse share one record: scan the landing page QR with a phone, send an intake, and it appears in the nurse queue. When pharmacist 2 calls the patient, the phone shows "Please go to pharmacy counter 2 and show code B-0xx".

## 2. Identity, roles and starting over

There are no real accounts; the identities are synthetic staff stored in the browser.

- **Account menu** (avatar at the top right of every staff page): "Signed in as" with the name and role, a "Demo identity · synthetic staff" chip, **Switch role** (opens `/demo`) and **Sign out**. Sign out clears every demo identity key and the tab's consult-consent flags, keeps the language, and opens `/demo?signedOut=1` with a "Signed out." notice.
- **"Who's signing in?"** When a staff page opens with no identity for its role (for example a copied link), a bottom sheet lists that role's synthetic staff; pharmacists also see "Pharmacist 1 · verify or return" and "Pharmacist 2 · final check and dispense". The page stays readable and scrollable, but buttons that write wait until a name is chosen ("Choose who is signing in before making changes."). Red-flag interrupts stay above the sheet, and "Hide for now" collapses it to a pill. Every change is recorded in the audit log under the chosen name.
- **Start a new visit** (patient app, Home and Help): clears the visit from this phone only. The care team keeps what was sent. The sheet shows the code to write down and, if medicine is still being prepared or waiting at the counter, warns that this phone will stop showing the pickup call. Buttons: "Clear and start again", "Keep my visit".
- Language: every page starts in English. The EN / Thai / IT control switches the patient app, the staff pages and the landing page (`/th`, `/it`). Thai and Italian are marked as pending native review.

## 3. Local setup

```bash
git clone https://github.com/KingPhuripol/MedX-AI.git && cd MedX-AI
npm --prefix apps/web install
cd apps/web
MODEL_PROVIDER=mock DEMO_SEED=1 DEMO_AUTOSEED=1 DEMO_TOKEN=pick-a-secret npm run dev   # or next build + next start for recording
curl localhost:3000/api/health          # provider "mock" unless AMD_* are set and MODEL_PROVIDER=amd
curl -X POST -H "x-demo-token: pick-a-secret" localhost:3000/api/demo/reset   # wipe and reseed the 14 synthetic cases
```

The patient app is served from `apps/web/public/patient` at http://localhost:3000/patient/. After any change in `apps/mobile/src` or `packages/shared/src`, rebuild it with `bash scripts/build-patient-web.sh` and restart the server (`next start` reads `public/` once at boot). Native: `cd apps/mobile && EXPO_PUBLIC_API_URL=http://<LAN-ip>:3000 npx expo start --no-dev --minify`, then press `i` for the iOS Simulator (no dev menu in recordings).

Browser for recordings: 1440 wide (the walkthrough recorder uses 1280x720), bookmarks bar hidden. The Next dev badge is off (`devIndicators: false`). Capture tools should pass `?motion=off` or use reduced motion so scroll reveals do not hide sections.

## 4. Seeded cases (after `POST /api/demo/reset` on an empty store)

Codes follow creation order, so they hold after a reset on an empty store; a visitor who starts a case first shifts later codes. Use the fixture to identify a case if codes differ. The first new visit after a reset is B-015.

| Code | Fixture | Language | Stage or status | Use it to show |
|---|---|---|---|---|
| B-001 | EN-05 | en | escalated | Suicide-risk red flag interrupt; zero model calls |
| B-002 | TH-05 | th | escalated | Chest pain with sweating, red flag (RF-CHEST-01), Thai patient |
| B-003 | EN-01 | en | Ready to collect | Paracetamol dispensed, patient called to counter 2 (shared ops case) |
| B-004 | IT-01 | it | Dispensing | Ibuprofen verified by pharmacist 1, waiting for pharmacist 2 (shared pharmacist 2 case) |
| B-005 | EN-04 | en | needs human | Abstain on vague input |
| B-006, B-007 | EN-03, IT-03 | en, it | collecting | Open follow-up question |
| B-008 | EN-02 | en | approved | Audit log after approval |
| B-009 | MED-01 | th | Pharmacy check | Amoxicillin against a penicillin allergy: High alert with alternatives for pharmacist 1 |
| B-010 | MED-05 | it | collecting | Medicine list with a maximum-dose alert in reconciliation |
| B-011 | MED-03 | th | needs human | Warfarin with ibuprofen interaction; abstained summary with unsupported fields in pencil style |
| B-012 | DEMO-GOLD | en | Intake (awaiting review) | Golden case for the nurse (shared nurse and patient case) |
| B-013 | DEMO-GOLD | en | Ready for doctor | Golden case for the doctor |
| B-014 | DEMO-GOLD | en | Pharmacy check | Golden case for pharmacist 1 |

## 5. The golden path (about 3 minutes live, 60 seconds in the walkthrough)

The narrated walkthrough (`apps/web/public/media/medx-demo-narrated.mp4`, 2 min 15 s, recorded by `scripts/record-demo.mjs`) follows exactly these steps on one fresh case:

1. Patient: picks the synthetic golden example, checks every word, sends; gets the visit code.
2. Nurse: the new visit in the queue; signs in through the "Who's signing in?" sheet as Nurse Anna Rossi; the evidence highlight on Allergies; approves the supported fields.
3. Nurse: records vitals; NEWS2 suggests a triage level; the nurse confirms it.
4. Doctor: keeps the rule-based consideration (not a diagnosis); signs the note.
5. Doctor: prescribes amoxicillin; the deterministic penicillin-allergy alert appears with options to review.
6. Pharmacist 1: returns the order with a report and clarithromycin as an option for prescriber review.
7. Doctor: "Edit with clarithromycin", re-check, resubmit.
8. Pharmacist 1: verifies.
9. Pharmacist 2: the two-person block, then signs in as Nattaya Wong, ticks the six-item check, dispenses, calls the patient to counter 2.
10. Patient: the phone shows the medicine is ready at counter 2.
11. Ops: queue and pharmacy flow, and the honest model label read from /api/health (on the live demo: Gemma-4-31B-IT + DeepSeek-V4-Flash on AMD Token Factory; on a local mock run: "mock model, not AMD").
12. Case trace: every rule check, model call and human decision in order.
13. Closing card: "Research prototype. Synthetic data. Clinicians decide."

For a live demo, add the red flag: type the TH-05 sample (or pick it under "Try saying"); the phone goes straight to the still "go to the desk" screen and the nurse queue shows the escalation, with no model call in the case trace.

## 6. Reset between takes

```bash
curl -X POST -H "x-demo-token: $DEMO_TOKEN" http://localhost:3000/api/demo/reset   # idempotent; wipes sessions and audit, reseeds
```

On the public demo the same call works with the production token, and Vercel Cron resets everything daily at 03:00 ICT.
