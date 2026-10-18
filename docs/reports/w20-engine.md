# w20 · Engine + shared contracts

## STATUS
done for my scope. Every engine and shared-contract item routed to me is done and tested: M-01, M-04, M-05, the engine parts of S-01, S-04 and S-05, my part of M-03 (maxDuration exports), and gate decisions (a), (b) and (c). Decision (d) (CR-18 strings) was "only if trivial"; it needs UI edits outside my scope, so I did not do it. The UI, mobile and config parts of these items belong to other owners (see open questions). Whole-suite vitest (final run): 2163 of 2164 pass. The one failure is in `llm-api.test.ts` and comes from the platform agent's in-progress `/api/health` change, not from engine code. Nothing is committed.

## SUMMARY
- **Shared contracts (M-01).** packages/shared now exports:
  - `DEMO_PERSONAS`: 6 personas. Each has `id`, `role`, a `staffName` taken from STAFF (null for the patient), a `stage`, an English `label` and a `task`.
  - `DEMO_SAMPLES`: EN-01, EN-02, IT-01, DEMO-GOLD and TH-05. Each has `lang`, `text` copied verbatim from its fixture, `fixtureId`, `synthetic: true` and a `redFlag` flag.
  - `type JourneyStage`, `JOURNEY_STAGES`, `JOURNEY_STAGE_LABELS` (en/it/th words) and the pure `journeyStage(session, consult|null)`.
  - A runtime `AUDIT_TYPES`. A compile-time check fails in both directions if it and the union diverge (`satisfies` plus `AUDIT_TYPES_COMPLETE`); I proved this with a missing member and with an extra member.
  - `roleOf(actor)` and `staffMemberOf`. They match by name or id, ignore case and extra spaces, and return undefined for unknown actors.
  - `WRITE_ROLES`.
  - `SessionListItem` (`stage?`), `PatientSessionView` (`seenByStaff?`), `DemoCasesRes`, `DemoStartReq` and `DemoStartRes`.
  - New type fields: AuditType `order_recheck`, `MedicationOrder.recheck` and `MedicationOrder.pharmacistHistory`.
- **Demo entry (M-04).**
  - Seeded ids are `sha256('medx-demo:'+caseId)` in UUID shape (`demoSessionId`), so links survive a reset. Patient sessions stay `randomUUID`, and a deterministic id never overwrites an existing record (409).
  - New synthetic fixture `data/cases/DEMO-GOLD.json`: English sore throat, worse on one side, trismus, penicillin rash allergy, plus a `demo` block of synthetic staff steps. It is seeded through the real pipeline at three points: nurse-ready (`intake`), doctor-ready (`nurse_done`) and pharmacist-1-ready (`pharmacy_verify`, amoxicillin with MR-ALLERGY-PEN high and a prescriber reason). Consult rules give the doctor the quinsy consideration `consider:CR-THROAT-03:CR-THROAT-03-C1`; the doctor keeps it and orders FBC and CRP from it.
  - EN-01, IT-01 and MED-01 now go through the whole visit before their medication order: intake approval where every required field is supported (EN-01, IT-01), vitals, triage confirmation, a nurse consult turn, and a signed doctor note. EN-01 and IT-01 are therefore `approved` and no longer `awaiting_review`.
  - `GET /api/demo/cases` returns `{personaId:{id,code,status,stage}}`. It is 404 unless DEMO_SEED=1. With DEMO_AUTOSEED=1 it seeds any missing persona case.
  - `POST /api/demo/start {stage}` builds a fresh golden case up to any of the 10 stages and returns `{id, code, stage}`. `stage` is the stage actually reached, so a provider failure stops the case early and visibly instead of faking a step.
    - In the golden journey, pharmacist 1 returns amoxicillin with clarithromycin as an option for prescriber review. The doctor re-orders, and Laura Conti verifies.
    - At `pharmacy_dispense`, Nattaya Wong can dispense and Laura is blocked (409).
    - Limits: at most 150 demo-start sessions (then 429), and an in-memory per-client limit of 20 starts per 10 minutes per server instance (429).
  - `ensureDemoSeed` logs failures with `console.error`. `startDemoSeed(options, keepAlive)` hands its task to next/server `after`. demo/reset and dev/seed pass `after` and export `maxDuration = 300`.
- **Approved sessions continue (M-05).**
  - `addConsultTurn` accepts `approved`. Patient lines go through `addTurnInLock(…, {fromConsult:true})`, which lifts only the approved guard in `runTurn`. Redaction and red-flag rules still run first; a red-flag sentence escalates with zero model calls for that turn.
  - On a benign line the approved intake stays `approved` and no intake follow-up is pushed to the patient. Conflicting new evidence on an approved field still sends it to `awaiting_review`, and abstention still gives `needs_human`.
  - A plain `POST /turns` on an approved session is still 409. Note sign returns 403 for STAFF who are not doctors.
- **Roles (S-05).** `requireStaffRole(actor, roles)` in clinicalWrites.ts is built on `roleOf`. It is called with the raw actor, before redaction, after shape validation. A STAFF member with the wrong role gets 403:
  - vitals and triage confirm: nurse;
  - medication draft, submit, cancel, investigation orders and consult note sign: doctor;
  - pharmacy verify/return, dispense, pickup and pharmacy-review: pharmacist.

  Actors not in STAFF are allowed unless `MEDX_STRICT_ROLES=1`.
- **Stage and seen-by-staff (S-01, S-04 engine parts).**
  - `GET /api/sessions` rows carry `stage` (lib/pipeline/journey.ts `listSessionItems`).
  - The patient view adds one boolean, `seenByStaff`. It is true when the intake is approved or taken over, triage is confirmed, or a consult note is signed (read from the consult record, which never reaches the phone). It is always present as a boolean.
- **Gate decisions.**
  - (a) Submitting a medication order while pickup is `ready` or `collected` clears pickup and audits `pickupReset:true, previousPickup`. The next call and collection list only the orders of the new cycle.
  - (b) Drafts no longer block "Call patient". Submitted, returned and verified orders block it. At least one newly dispensed order is required.
  - (c) `refreshOrders` runs:
    - at the start and end of every order write;
    - after every patient turn (intake and consult);
    - after pharmacy review.

    A verified, not yet dispensed order that now carries a high alert with no override on that order goes back to `submitted`, with `recheck`, the earlier pharmacist record moved to `pharmacistHistory`, and an `order_recheck` audit event (actor system, with a reason and message). Alerts that involve a draft or returned order wait until that order is submitted. A re-check found during a dispense is saved before the 409. Pharmacist 1 must then return the order, because verify still needs an override for every high alert. The trace shows an `order_check` node "Re-check needed: new high alert".

## FILES CHANGED
Shared (orchestrator rights; tokens.ts not touched):
- `packages/shared/src/types.ts`: `order_recheck`, `AUDIT_TYPES` + compile-time check, `MedicationOrder.recheck` / `pharmacistHistory`, PickupState doc.
- `packages/shared/src/journey.ts` (new): JourneyStage, JOURNEY_STAGES, JOURNEY_STAGE_LABELS, JourneySession, JourneyConsult, journeyStage.
- `packages/shared/src/demo.ts` (new): DEMO_PERSONAS, DEMO_SAMPLES.
- `packages/shared/src/staff.ts`: staffMemberOf, roleOf, WRITE_ROLES.
- `packages/shared/src/api.ts`: SessionListItem, PatientSessionView, DemoCasesRes, DemoStartReq/Res, OrderRecheckAudit, and the pickup, re-check and role docs.
- `packages/shared/src/index.ts`: exports journey and demo.

Engine:
- `apps/web/lib/pipeline/errors.ts` (new): PipelineError, which `pipeline.ts` re-exports. Moving it broke the import cycle once pipeline.ts imports orders.ts.
- `pipeline.ts`: demoSessionId, deterministic or demo-start ids in createSession, `fromConsult` / keepApproved in runTurn, and the order re-check after each turn in addTurnInLock.
- `orders.ts`:
  - role checks;
  - refreshOrders, auditRechecks, refresh-at-start and commit-at-end;
  - the (a) pickup reset after collected;
  - the (b) call rule, with orderIds per cycle;
  - recheck cleared by pharmacist 1 action or resubmit;
  - dispense 409 "Re-check needed".
- `consult.ts`: accepts approved, patient lines use fromConsult, sign is doctor-only.
- `clinicalWrites.ts`: requireStaffRole, PipelineError from errors.ts.
- `vitals.ts`: nurse-only vitals and triage confirm.
- `pharmacyReview.ts`: pharmacist-only, order re-check after review.
- `patientView.ts`: seenByStaff, PatientSessionView return type.
- `journey.ts` (new): sessionStage, listSessionItems.
- `seed.ts`:
  - golden visit, advanceVisit, the 14-plan seed with stageMismatches;
  - demoCaseSession, PERSONA_CASES, demoCases, ensureDemoCases;
  - startDemoCase, DEMO_START_LIMIT, demoStartAllowed;
  - console.error logging and the keepAlive hook.
- `trace.ts`: order_recheck node.

API:
- `app/api/demo/cases/route.ts` (new), `app/api/demo/start/route.ts` (new).
- `app/api/demo/reset/route.ts` and `app/api/dev/seed/route.ts`: `after`, maxDuration 300.
- `app/api/sessions/route.ts`: stage.
- `app/api/sessions/[id]/route.ts`: seenByStaff via the consult record.
- maxDuration 60 on `app/api/sessions/[id]/turns/route.ts` (which also passes the consult record), `consult/route.ts`, `consult/turns/route.ts`, `consult/note/route.ts` and `orders/medications/route.ts`.

Data:
- `data/cases/DEMO-GOLD.json` (new, synthetic; not added to `index.json`, and the eval's `^[A-Z]{2}-\d+\.json$` filter skips it).

Tests (new):
- `__tests__/contracts.test.ts` (14), `demo-entry.test.ts` (27), `approved-consult.test.ts` (6), `roles.test.ts` (49), `journey.test.ts` (17), `patient-seen.test.ts` (6), `pickup-cycle.test.ts` (13).

Tests updated only where behaviour legitimately changed:
- `wave2.test.ts`:
  - the seed is now 14 sessions, with the new byStatus;
  - the approval-only check looks up EN-02 by case id;
  - the AMD fake also answers the consult-suggestion prompt the seeded visits now send;
  - the failure test expects 14/12/10 and adds an assertion that no staff step runs after provider failure.
- `wave4.test.ts` and `wave5.test.ts`: 14 sessions. Seeded ids are now the same after a reset, which wave5 asserted against before; the records are proven rebuilt from a fresh audit.
- `wave11.test.ts`: approved is moved from "rejects" to "accepts" consult (M-05); taken_over still rejects.
- `wave15.test.ts`: the patient allowlist adds `seenByStaff` (false in that case).
- `wave17.test.ts`: non-doctor staff now get 403 on sign. The draft receipt still keeps every name; doctors still sign with their names.
- `wave19.test.ts`: the "draft blocks call" step is removed (decision b). Seed counts are 14, with toVerify 2 and the new byStatus.

No red-flag, abstention, evidence or two-person test was weakened.

Report: `docs/reports/w20-engine.md` (this file).

## TESTS RUN + RESULTS
All web commands were run from `apps/web`.

| Command | Result |
|---|---|
| `./node_modules/.bin/vitest run` (final) | exit 1: `Test Files 1 failed / 37 passed (38)`, `Tests 1 failed / 2163 passed (2164)`, 57.39 s. The previous full run gave 2161/2162 in 51.23 s, before the platform agent added tests. The only failure is `llm-api.test.ts > HTTP contracts and CORS > returns health metadata…`, which expects the old `/api/health` body; the platform agent's `app/api/health/route.ts` now adds `status`, `commit`, `region`, `providerConfigured`… No `onTaskUpdate` or Unhandled lines |
| `./node_modules/.bin/vitest run` (first run after the engine changes, before test updates) | 15 failures, all expected contract changes (seed counts, allowlist, approved consult, sign role, draft call) plus one message mismatch with the pharmacy UI's local mirror. I restored the server message "Every active medication order must be dispensed before calling the patient", so `app/(pharmacy)/pharmacy-live.test.ts` passes unchanged |
| `./node_modules/.bin/tsc --noEmit -p .` | exit 0 after my last change. The very last run shows only TS2304/TS7006 in `lib/pipeline/__tests__/w20-platform.test.ts` (platform agent's new file, being edited: `getAudit` not imported). None of these errors are in my files |
| `apps/mobile`: `./node_modules/.bin/tsc --noEmit -p .` (TS 6.0.3) | exit 0; `--listFiles` shows it type-checks shared `journey.ts` and `demo.ts` |
| `tsc` on a copy of types.ts with one AUDIT_TYPES member removed or one extra added | TS1360 `Type 'true' does not satisfy the expected type 'false'` (missing) and TS2322 + TS1360 (extra), as intended |
| `./node_modules/.bin/eslint` on every engine, API and test file I touched | exit 0, no output |
| `node docs/clinical/check-{consultrules,medrules,redflags,vitalrules}.mjs` | 80/0 · 253/0 (medrules 1.2) · 175/0 · 13 cases all passed (rule files untouched) |
| `next build` | not run (task instruction: parallel builds collide on .next) |

## EVIDENCE
- **Mock seed** (vite-node run of `seedDemo()`): `created 14`, byStatus `{collecting 4, escalated 2, awaiting_review 1, needs_human 2, approved 5, taken_over 0}`, `mismatches []`, `stageMismatches []`. Stages:
  - EN-01: ready_for_pickup, paracetamol dispensed;
  - IT-01: pharmacy_dispense, ibuprofen verified;
  - MED-01: pharmacy_verify, amoxicillin MR-ALLERGY-PEN high + MR-DUP-02;
  - DEMO-GOLD: intake, nurse_done, and pharmacy_verify (amoxicillin MR-ALLERGY-PEN high, FBC and CRP from the kept quinsy consideration).

  No signed note needed a synthetic "Not assessed" edit; only the informational `missing:fields` line was unsupported.
- **GET /api/demo/cases** on that seed:
  - patient and nurse-rossi → B-012 (awaiting_review, intake);
  - doctor-bianchi → B-013 (approved, nurse_done);
  - pharm-conti → B-014 (approved, pharmacy_verify);
  - pharm-wong → B-004 (approved, pharmacy_dispense);
  - ops-head → B-003 (approved, ready_for_pickup).
- **POST /api/demo/start**: all 10 stages are reached through the real pipeline in the tests. At `collected`, the audit holds review, vitals_recorded, triage_confirmed, consult_turn, consult_note_signed, order_drafted, order_submitted, order_pharmacy_action ×2 (return, verify), order_dispensed, pickup_called and pickup_collected.
- **Re-check (c)**: a penicillin allergy stated after amoxicillin was verified gives:
  - `status submitted`;
  - `recheck.alertIds = [MR-ALLERGY-PEN-…]`;
  - `pharmacistHistory[0].by = Pharmacist Laura Conti`;
  - audit `order_recheck` (actor system, `previousPharmacist`, `message`);
  - dispense 409 "Re-check needed…";
  - verify 409 without an override.

  Then the order goes return → resubmit with reason → verify → dispense. A draft NSAID duplicate does not re-check the verified order until the draft is submitted; the audit tail is then `order_submitted, order_recheck`.

## ASSUMPTIONS
- **M-05 status.** A benign consult line keeps an approved intake `approved` and skips the intake follow-up model call. The status still means "every required field approved", and approved fields are preserved. Conflicts, red flags and abstention still change the status.
- **nurse_done.** It means triage is confirmed and the consult has moved on: a clinician-speech turn, a nurse note or a doctor note exists. The UI's "Ready for doctor" handoff is navigation only, with no API call.
- **Pharmacy stage rules.** "Dispensed, patient not called yet" maps to `pharmacy_dispense`, because pharmacist 2 still has to call the patient. A returned order maps to `orders_submitted`, because it is back with the prescriber.
- **Persona cases.** The patient persona shares the nurse-ready golden record ("phone and web, one record"). Pharm-wong maps to the seeded IT-01 (Italian patient words, English UI). Ops maps to EN-01.
- **Demo-start cap.** At most 150 demo-start sessions may exist, so the request that would create the 151st returns 429. The per-client limit (20 per 10 min) is in memory per instance and adds to the platform's per-IP POST limit.
- **seenByStaff.** Always present as a boolean. A missing consult record never infers "signed".
- **Re-check scope.** "New high alert" means a high alert with no override on that order. An interaction alert shared with another order that already has its own override still re-checks the verified order. This is conservative and follows the decision literally.
- **Cancel audit.** Cancel stays audited as `order_drafted` + `action: cancel`, because the orders UI timeline and the trace read that form. `order_cancelled` remains in AUDIT_TYPES, unused.
- **Line endings.** Files edited with the Edit tool kept their existing CRLF working-tree endings (HEAD is LF; `.gitattributes eol=lf` normalises on add). Files rewritten by script are LF.

## RISKS
- **UI role checks.** Server roles now return 403 where the UI sends the wrong identity:
  - vitals or triage confirm from doctor mode;
  - orders from nurse mode;
  - consult sign by a non-doctor.

  Until the UI owners restrict these controls (WRITE_ROLES is exported for that), users will see 403 errors in those modes.
- **Re-check timing.** Re-checks happen on writes and patient turns, not on GET. An order whose checks went stale through a path I do not refresh would still be caught at the latest on the dispense attempt (tested).
- **Seeding with a real provider.** With a real provider, `GET /api/demo/cases` with DEMO_AUTOSEED=1 runs a paced seed inside the request (60 s maxDuration). Production should keep `MODEL_PROVIDER=mock` for the demo seed, or seed via `/api/demo/reset` with `after`.
- **Shared store.** The background seed (`after`) and demo-start write outside, or nested in, the request scope of the platform's store sync. They rely on the store's `withSessionLock` write-sets (`dev-demo-seed`, `demo-start`, per session). I did not test them against the Neon fake.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
1. **Platform.**
   - `lib/pipeline/__tests__/llm-api.test.ts` expects the old `/api/health` shape and fails after your `health/route.ts` change; please update it with your change. I did not touch store.ts or _http.ts.
   - Please confirm that background writes from `startDemoSeed(…, after)` and `startDemoCase` land in shared mode.
2. **Pharmacist web, `app/(pharmacy)`.**
   - Show "Re-check needed" when `order.recheck` is set (status submitted), list `pharmacistHistory`, and render the `order_recheck` audit event.
   - Update the local mirrors `canCall` and `applyPickup` in `_lib.ts`. Drafts no longer block. Returned, submitted and verified orders block. At least one newly dispensed order is needed. After `collected`, a new submitted order starts a new cycle. The server messages are unchanged.
   - CR-18 (move the pickup and "Options for prescriber review" strings to shared i18n) needs edits in `(pharmacy)/_orders.tsx`, so I left it.
3. **Clinician and orders web.**
   - S-01 UI: use `row.stage` with `JOURNEY_STAGE_LABELS` for the word chip, apply the triage sort, and add the "Ready for doctor" button in `_vitals.tsx`.
   - Gate writes by `WRITE_ROLES` and show the 403 message.
4. **Patient mobile.** For S-04, add `seenByStaff` to the `PatientView`/`toPatient` allowlist in `apps/mobile/src/api.ts`, light steps 2 and 3 in `done.tsx`, keep polling until `pickup.status === "collected"`, and rebuild the /patient export.
5. **Landing.**
   - Use DEMO_PERSONAS and DEMO_SAMPLES, `GET /api/demo/cases` (shared fallback) and `POST /api/demo/start {stage: persona.stage}` (per visitor). Fall back to demo/cases on 429.
   - Style `redFlag` samples with urgency and never next to Fin.
6. **Doctor.**
   - Review DEMO-GOLD's synthetic journey for clinical plausibility: vitals; nurse lines in en, it and th; amoxicillin, then return, then clarithromycin 500 mg twice daily for 5 days; and pickup for a quinsy consideration, where real practice may refer for drainage.
   - Review the th/it stage labels.
7. **Orchestrator.** M-03's config files (vercel.json, package.json engines, next.config, tsconfig.build, Dockerfile, .vercelignore, .env.example) are outside my scope and are being changed by the platform agent. Mine are only the maxDuration exports. `next build` still needs a run on the merged tree.

## NEXT ACTION
Orchestrator:
- Get the platform agent to update the health test.
- Hand open questions 2 to 5 to the UI, mobile and landing owners.
- Run `next build` and the whole suite on the merged tree, then commit.
