# MedX: spec of record

Version: wave 20, Sun 18 Oct 2026. This is the spec of record named in `CLAUDE.md`. It states what MedX is, the end-to-end journey, the journey stage model, the demo personas, and the rules no build may break. Detailed behaviour lives in the linked specs; where this file and a detailed spec disagree, the detailed spec wins for its own area and this file must be corrected.

| Area | Detailed spec | Rules and checks |
|---|---|---|
| Intake fields, escalation, abstain policy, nurse screen | [docs/clinical/SPEC.md](clinical/SPEC.md) | `packages/shared/src/redflags.json` (v1.1.1, 18 rules), [REDFLAG-TESTS.md](clinical/REDFLAG-TESTS.md), `node docs/clinical/check-redflags.mjs` |
| Consult assistant, considerations, draft note, vitals and NEWS2, investigations, doctor orders | [docs/clinical/CONSULT-SPEC.md](clinical/CONSULT-SPEC.md) | `consultrules.json` (v1.3, 51 rules, 12 presentations), `vitalrules.json` (v1.0), `investigations.json`, `check-consultrules.mjs`, `check-vitalrules.mjs` |
| Medicine reconciliation, prescribing checks, two-stage pharmacy, pickup, alternatives | [docs/clinical/PHARMACY-SPEC.md](clinical/PHARMACY-SPEC.md) | `medrules.json` (v1.2: 59 drugs, 13 allergen classes, 11 allergy rules, 18 interactions, 5 alternative entries), [MEDRULES-TESTS.md](clinical/MEDRULES-TESTS.md), `check-medrules.mjs` |
| Model pipeline, prompts, verifier, abstain thresholds | [docs/ai/DESIGN.md](ai/DESIGN.md), [docs/ai/METRICS.md](ai/METRICS.md) | `apps/web/lib/pipeline/` |
| Components, data flow, store, invariants to code | [docs/ARCHITECTURE.md](ARCHITECTURE.md) | `apps/web/lib/pipeline/__tests__` |
| Visual design, type, motion, Fin, marketing pages | [docs/design/DIRECTION.md](design/DIRECTION.md) | `packages/shared/src/tokens.ts`, `apps/web/components/ui/*.test.ts` |
| Hosting, store, environment | [docs/DEPLOY.md](DEPLOY.md) | `apps/web/vercel.json`, `.env.example` |
| Contracts | `packages/shared/src/types.ts`, `api.ts`, `journey.ts`, `demo.ts`, `staff.ts` | changed by the orchestrator only |

## 1. Claim boundary

MedX is a research prototype that **supports** clinicians. It suggests for review, flags for the clinician and offers decision support. It **never diagnoses, treats, prescribes or decides urgency** on its own. Nurses, doctors and pharmacists make every clinical decision in MedX, with deterministic checks and an append-only audit trail. **Synthetic data only**; no real patient data, ever. Not clinically validated, not a medical device.

Wording rules for every surface: "suggests for review", "flags for clinician", "decision support", "not a diagnosis". Never "diagnoses", "triages", "decides", "AI doctor". The model label is read from `/api/health`; no copy may claim the demo uses AMD hardware while health reports `mock`.

## 2. Safety invariants (never break)

| # | Invariant (from `CLAUDE.md`) | Where it is enforced |
|---|---|---|
| 1 | Red-flag rules are deterministic code, run before any model call, and no model output can clear them | `redflags.ts`; `pipeline.ts` returns before `extract` on a hit (zero model calls); the model screen (`redFlagScreen.ts`) can only add flags with a verified quote |
| 2 | A field with no verified evidence quote is `unsupported` and is never displayed as fact | `verify.ts`; the UI shows "Needs check" in pencil style; the consult page marks unsaved or fixture lines as not part of the record |
| 3 | Provider error, schema error or low confidence → abstain → "needs human review". Never a guess | `pipeline.ts`, `extract.ts`, `llm.ts`; a shared-store error answers 503 with "needs human review if it persists" |
| 4 | Nothing is final until a clinician approves it. Every action is in the append-only audit log | review, takeover, triage confirm, note sign, order, pharmacy, dispense and pickup routes; `store.ts` `appendAudit`; audit events merge as a union across instances |
| 5 | Raw patient text is redacted before storage or any model call. No real patient data | `redact.ts` (`redact`, `redactActor`), `runTurn`; actor strings keep only known synthetic staff names |
| 6 | API keys only from env vars. Never commit `.env` | `config.ts`, `llm.ts`, `kvStore.ts`; `.env*` git-, docker- and vercel-ignored; `/api/health` never returns a credential (tested) |

Further rules that follow from them: medication alerts are code, not model (`medrules.ts`); an option from the alternatives table is never written into an order; the pharmacist who verified an order cannot dispense it; the patient view is an explicit allowlist (no drug names, alerts, alternatives, staff ids or notes); urgent content never animates and Fin never appears next to it.

## 3. Users and surfaces

| User | Surface | Language |
|---|---|---|
| Patient | Expo app (`apps/mobile`), web export at `/patient` | English by default; Thai and Italian by toggle |
| Nurse, doctor | `/review`, `/review/<id>`, `/review/<id>/consult`, `/review/<id>/vitals`, `/review/<id>/orders`, `/review/<id>/trace` | English by default; staff language toggle |
| Pharmacist 1 and 2 | `/pharmacy`, `/pharmacy/<id>` | same |
| Clinic operations | `/ops` | same |
| Visitor or judge | `/` (landing), `/th`, `/it`, `/demo`, `/demo/<persona>` | English at `/` |

Every page renders English on first visit (owner decision 3); the chosen language is stored as `medx.lang` and the Thai and Italian pages say native review is pending.

## 4. End-to-end journey

| Step | Actor | Input | MedX does (decision support) | A person decides | Audit events |
|---|---|---|---|---|---|
| 1 Intake | Patient | Voice or text, TH/IT/EN | Redacts, runs red-flag rules first, extracts fields with evidence quotes, verifies each quote, asks up to 3 follow-ups in the patient's language, shows a visit code and live status | Patient checks the transcript before sending | `session_created`, `turn_added`, `pii_redacted`, `red_flag`, `summary_generated`, `abstained` |
| 1a Red flag | System → clinician | A rule hit | Stops the intake with zero model calls; patient sees a calm "go to the desk" screen; clinician screen is interrupted with the highlighted sentence | Clinician acknowledges or marks a false alarm with a reason; the flag stays visible | `red_flag`, `red_flag_review` |
| 2 Intake review | Nurse | The summary | Each field links to the patient's sentence; unsupported fields say "Needs check" | Approve, edit (old value kept) or take over | `review`, `takeover` |
| 3 Vitals and triage | Nurse | Vitals | NEWS2-based triage suggestion for adults (`vitalrules.json`) | Confirm, or record another level with a note | `vitals_recorded`, `triage_confirmed` |
| 4 Consult | Nurse, then doctor | Conversation (after a recorded consent step) or typed lines | Ask-next and rule-out prompts; doctor-only considerations from the curated list with guideline links, labelled not a diagnosis; draft note with evidence | Keep or dismiss each consideration; edit and sign the note (doctor only) | `consult_turn`, `consult_suggestion`, `consult_note_signed` |
| 5 Orders | Doctor | Investigation and medication orders | Deterministic checks: allergy, interaction, duplicate, pregnancy, dose range; alternatives from the sourced table, each re-checked against this patient | Writes every order; a high alert needs a written override reason; submit | `order_drafted`, `order_submitted`, `order_cancelled` |
| 6 Verify or return | Pharmacist 1 | The submitted order | Shows checks, override reasons and the patient's own medicine list; verify is refused while a high alert lacks a reason | Verify, or return with a note and a report (alert ids, up to 5 dictionary generics as options for prescriber review) | `order_pharmacy_action` |
| 6a Re-review | Doctor | A returned order | Shows the report labelled "options for prescriber review, not a prescription"; any edit re-runs every check | Edit, keep with a reason, or cancel | `order_drafted`, `order_submitted` |
| 7 Dispense | Pharmacist 2 | A verified order | Six-item final check, every box unticked; refuses the verifier (two-person check) and any partial checklist; a new high alert on a dispensed, uncollected order sends it back to pharmacist 1 | Dispense, or stop and send back | `order_dispensed`, `order_recheck` |
| 8 Pickup | Pharmacist | All medicines dispensed | Patient phone shows "ready" with the counter and code, never clinical detail | Call the patient to a counter; confirm identity and record the collection | `pickup_called`, `pickup_collected` |
| 9 Oversight | Clinic operations | All cases | Queue by urgency, escalations, abstain rate, pharmacy pipeline (to verify, to dispense, ready, collected today), honest model label | Reads counts only | none |
| 10 Case trace | Anyone on staff | One case | Executed graph of rule checks, model calls, skipped steps and human decisions, with evidence, JSON export and a deterministic replay digest; no PII | Reads | none |

Nothing becomes final without a person. Every write carries its actor; with `MEDX_STRICT_ROLES=1` the server refuses writes from unknown actors or the wrong role (`WRITE_ROLES` in `staff.ts`: vitals and triage by a nurse; orders and note signing by a doctor; pharmacy, dispense and pickup by a pharmacist).

## 5. Journey stage model

`journeyStage(session, consult)` in `packages/shared/src/journey.ts` derives a neutral label from the record only. It is pure, makes no model call, and never decides urgency (triage and red flags do that). Every queue and case header shows it as a word label, never colour alone.

| Order | Stage | Label (en) | Reached when |
|---|---|---|---|
| 1 | `intake` | Intake | The patient is answering, or the intake waits for a clinician |
| 2 | `intake_reviewed` | Intake reviewed | A clinician approved or took over the intake, or reviewed every red flag |
| 3 | `triaged` | Triaged | A nurse confirmed a triage level |
| 4 | `nurse_done` | Ready for doctor | Triaged, and the consult has moved on (a consult line or note exists) |
| 5 | `doctor_signed` | Doctor signed | The doctor signed the consult note |
| 6 | `orders_submitted` | Orders sent | Orders left the prescriber and none waits on the pharmacy (investigations only, or a medicine returned to the prescriber) |
| 7 | `pharmacy_verify` | Pharmacy check | A medication order waits for pharmacist 1 |
| 8 | `pharmacy_dispense` | Dispensing | A verified order waits for pharmacist 2, or dispensed medicines wait for the patient call |
| 9 | `ready_for_pickup` | Ready to collect | The patient was called to the counter |
| 10 | `collected` | Collected | The patient collected the medicines |

Precedence: pending pharmacy work wins over an earlier pickup (a submitted order means `pharmacy_verify`, a verified order `pharmacy_dispense`), so a late order sends the visit back. Drafts stay with the prescriber and never move the stage. Cancelled orders are ignored.

## 6. Demo personas and the golden case

Six synthetic people, from `DEMO_PERSONAS` in `packages/shared/src/demo.ts` (staff names from `STAFF` in `staff.ts`). The landing page and `/demo` show one card each; `/demo/<persona>` stores the identity in the browser and opens the persona's starting point.

| Persona id | Role | Staff name | Stage of the demo case | Task | Lands on |
|---|---|---|---|---|---|
| `patient` | Patient | none | `intake` | Tell Fin what brings you in, by voice or text, in English, Thai or Italian | `/patient/?new=1&lang=...` (fresh intake, no case created) |
| `nurse-rossi` | Nurse | Nurse Anna Rossi | `intake` | Review the intake, record vitals and confirm the triage level | `/review/<id>` |
| `doctor-bianchi` | Doctor | Dr. Marco Bianchi | `nurse_done` | Run the consult, review rule-based considerations, sign the note and write orders | `/review/<id>/consult?mode=doctor` |
| `pharm-conti` | Pharmacist 1 (verify) | Pharmacist Laura Conti | `pharmacy_verify` | Check the prescription, then verify it or return it with options for prescriber review | `/pharmacy/<id>` |
| `pharm-wong` | Pharmacist 2 (dispense) | Pharmacist Nattaya Wong | `pharmacy_dispense` | Do the final two-person check, dispense, and call the patient to the counter | `/pharmacy/<id>` |
| `ops-head` | Clinic operations | Head Nurse Elena Greco | `ready_for_pickup` | Watch the queue, escalations, abstentions and the pharmacy pipeline | `/ops` |

- Staff cards call `POST /api/demo/start { stage }`, which builds a fresh copy of the golden case through the real engine up to that stage (at most 150 such cases between daily resets, plus a per-client brake). On any failure they fall back to the shared seeded case from `GET /api/demo/cases`.
- **Golden case** (`data/cases/DEMO-GOLD.json`, English, synthetic): a 24-year-old man with a sore throat for two days and white spots on his tonsils, penicillin rash allergy, no medicines. The nurse records vitals (NEWS2 suggestion, confirmed); the doctor keeps CR-THROAT-05 ("consider bacterial tonsillitis: check the FeverPAIN or Centor score", NICE NG84; pending Doctor sign-off), orders a throat swab and prescribes amoxicillin, which raises the deterministic High allergy alert; pharmacist 1 returns it with clarithromycin as an option for prescriber review; the doctor re-orders clarithromycin; pharmacist 1 verifies; pharmacist 2 dispenses after the six-item check and calls the patient to counter 2.
- "Try saying" examples come from `DEMO_SAMPLES` (verbatim fixture text, synthetic): EN-01, EN-02, IT-01, DEMO-GOLD, TH-01 and the red-flag sample TH-05 (shown with urgency styling, never next to Fin).
- The seed (`DEMO_AUTOSEED=1`) creates 14 synthetic cases covering escalation, abstention, follow-up, approval, every pharmacy stage and the golden case at three hand-offs. The public demo resets daily at 03:00 ICT.

## 7. Identity in the demo

There is no real authentication, by design. Staff identities are the synthetic `STAFF` list, kept in the browser (`medx.role`, `medx.clinicianRole`, `medx.reviewer.<role>`, `medx.demo.persona`, `medx.demo.case`).

- **Account menu** on every staff surface (clinician, orders, vitals, trace, pharmacy, ops): "Signed in as" with name and role, a "Demo identity · synthetic staff" chip, **Switch role** (opens `/demo`) and **Sign out**. Keyboard: arrows, Home and End move through items; Escape closes and returns focus.
- **Sign out** clears every identity key and the tab's consult-consent flags, keeps the language preference, and opens `/demo?signedOut=1`, which shows a "Signed out." notice. Signing out in one tab signs out the others.
- **"Who's signing in?" sheet**: a staff page opened with no valid identity for its role shows a non-modal bottom sheet listing that role's synthetic staff (pharmacists see "Pharmacist 1 · verify or return" and "Pharmacist 2 · final check and dispense"). Reading, links, tabs and scrolling work; any write control is held until a name is chosen, and a blocked action brings the sheet back with a calm (not red) prompt. Red-flag interrupts stay above the sheet; "Hide for now" collapses it. The pharmacy shell's write functions also refuse to run without an identity. Ops has no writes, so it is not gated.
- Writes are attributed to the chosen name in the audit log. Because identity is self-declared, the two-person dispense rule is procedural, not authenticated.

## 8. Patient app behaviour

- English first; language control for English, Thai and Italian; Fin reads each question aloud; the patient edits the transcript before sending; "Try saying" examples are labelled synthetic.
- After sending: a visit code and a timeline (sent, seen by the care team, reviewed, preparing your medicine, ready to collect). A pickup card shows the counter and the code only.
- A red-flag visit shows a still, instant "go to the desk" screen that cannot be dismissed; Fin is absent.
- **Start a new visit** (Home and Help, only when a non-red-flag visit is stored) opens a confirm sheet: it clears the visit from this phone only, shows the code to write down, warns in amber when medicine is still being prepared or waiting, and offers "Clear and start again" or "Keep my visit". While medicine is pending, Home and the "+" tab open the current visit instead of discarding it.

## 9. Design system summary

- Look: "calm clinical banking" (mist background, white rounded cards, one dark gradient feature card, pill chips, translucent sticky nav); gradient teal `#0A8077` to ocean `#1A5FC4`; red reserved for urgency; the safety states verified, unverified, missing, edited and approved visually distinct. No emoji UI, no sparkle icons, no chat bubbles for clinical content.
- Type: Plus Jakarta Sans (Latin, Italian) and Noto Sans Thai, self-hosted via `next/font/google` on the web and bundled (OFL) in the patient app. SCBXBeta2 is removed from both. The logo wordmark is outlined vector paths.
- Motion: transform and opacity only, 150 to 450 ms on the `glide` curve, off under `prefers-reduced-motion` (and `?motion=off`); urgent content never moves and a container holding it drops its own motion. Marketing pages add reveals, Fin's float and parallax and count-ups; the app keeps page enters, press feedback and receipts.
- Fin: 3D art at 96 px and up for hero, landing and empty states; vector Fin and the Echo X mark for small sizes. Never near red flags, alerts, errors or clinical content.

## 10. Out of scope and known limits

No real patient data, accounts, EHR integration, lab system, barcode or stock check. The model on the public demo is a deterministic mock; Gemma via AMD Token Factory is the designed target and is not measured yet. Keyword red-flag rules miss paraphrases (7 of 10 emergencies on the 18-case blind holdout). Considerations come from a fixed 12-presentation list, not a differential. NEWS2 is for adults, not pregnancy. The prescribing rule set is small. Speech goes to the device's cloud speech service. Redaction is pattern-based. Thai and Italian need native-speaker review.
