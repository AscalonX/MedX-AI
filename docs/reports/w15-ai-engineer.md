# Wave 15 — AI engineer clinical safety fixes

## STATUS
Done — assigned engine fixes, regressions, live curl probes and final verification complete.

## SUMMARY
- **MF-1:** Model output emits `ask_next` only. All `consider` items are dropped; considerations come from `consultrules.json`. Every generated language and rationale is checked against normalized medrules generic names/aliases, dose/unit/route patterns (including `300mg`), treatment verbs and existing forbidden claims. Cached pre-fix model suggestions are filtered on refresh and on response serialization. The model prompt now requests questions only.
- **MF-2:** Drafts exclude dismissed considerations. Signing retains only curated consideration lines explicitly included in `edits`, including unchanged text, and labels them `edited` (the shared contract's clinician-adopted status). Dismissed questions remain as localized “Not asked (dismissed)”; asked questions remain labeled “Asked, no answer recorded.” Signing audits `keptConsiderationIds`.
- **MF-4 server:** `triage.reasons` includes a localized re-confirmation notice whenever the suggested level is more urgent than the confirmed level. Re-confirming remains allowed and audited; confirming the suggested level removes the notice. The earlier confirmation remains in audit history.
- **MF-5:** NEWS2 scores the latest defined value of each parameter across entries. `triage.vitalSources[parameter] = { entryId, at }` records provenance. A localized reason identifies carried-forward values. Explicit `false` oxygen and categorical values are preserved; omitted oxygen retains the existing documented room-air default.
- **MF-6:** Each order with missing dose range, unparsed mg dose, or unparsed daily frequency receives exactly one moderate `dose_range` alert, `MR-DOSE-UNCHECKED`: “Dose not checked — verify against a full reference”, localized in EN/TH/IT. Unknown drugs also receive it. Existing high dose-ceiling alerts still apply independently. Dictionary-matched methotrexate with parsed daily frequency receives an additional high `MR-METHOTREXATE-DAILY` weekly-dosing caution; high alerts require an override.
- **MF-7:** Unrecorded/unsupported allergy status without explicit no-known-allergies evidence produces moderate `allergy_conflict`, `MR-ALLERGY-UNKNOWN`, with localized “Allergy status not recorded — ask before prescribing”. Supported recorded allergy entries and clinician edits count as recorded status; unsupported entries do not. Existing allergy conflicts still fire.
- **MF-8:** Override reasons require at least five Unicode letters/digits; punctuation, whitespace, symbols and emoji do not count. Invalid submissions return HTTP 400 without changing the order or audit.
- **SHOULD-FIX:** Added patient response allowlists and CORS support for the patient client header. Signing rejects all edits to `red_flags` lines with HTTP 400; rejected batches do not save earlier edits or a signature.

## FILES CHANGED
All engine/API edits remain in assigned ownership; shared contracts, clinical docs and UI were not edited.

- `apps/web/lib/pipeline/consult.ts`
- `apps/web/lib/pipeline/prompts.ts`
- `apps/web/lib/pipeline/triage.ts`
- `apps/web/lib/pipeline/vitals.ts`
- `apps/web/lib/pipeline/orders.ts`
- `apps/web/lib/pipeline/patientView.ts` — new patient allowlist
- `apps/web/app/api/_http.ts`
- `apps/web/app/api/sessions/[id]/route.ts`
- `apps/web/app/api/sessions/[id]/turns/route.ts`
- `apps/web/lib/pipeline/__tests__/wave11.test.ts` — superseded model-consideration expectation
- `apps/web/lib/pipeline/__tests__/wave12.test.ts` — superseded silent-pass expectations
- `apps/web/lib/pipeline/__tests__/wave14.test.ts` — distinguish checked high limits from moderate unchecked/unknown status
- `apps/web/lib/pipeline/__tests__/wave15.test.ts` — reviewer probes and regression coverage
- `apps/web/lib/pipeline/__tests__/wave15-live.mjs` — reproducible synthetic curl probes
- `docs/reports/w15-ai-engineer.md`

## TESTS RUN + RESULTS
- `cd apps/web && npx vitest run --reporter=dot`: **20 files, 1,720 tests passed; exit 0**, including **338 Wave 15 cases**. Final run includes the additional `300mg` regression and legacy response filtering.
- `cd apps/web && npx tsc --noEmit`: **exit 0** on final implementation.
- `cd apps/web && npx eslint .`: **exit 0** on final implementation.
- `node docs/clinical/check-redflags.mjs`: **175 passed, 0 failed**.
- `node docs/clinical/check-medrules.mjs`: **204 passed, 0 failed**.
- `node docs/clinical/check-consultrules.mjs`: **50 passed, 0 failed**.
- `node docs/clinical/check-vitalrules.mjs`: **13 cases + band coverage, all passed**. All four `check-*` scripts pass **100%** on the final verification run.
- `node apps/web/lib/pipeline/__tests__/wave15-live.mjs`: **exit 0, 61 live curl requests**, existing server at `http://localhost:3000`, provider `mock`. No reset or restart. Synthetic probe sessions remain in the existing store.
- `git diff --check`: **exit 0** at implementation review.

## EVIDENCE
The live probe script prints one result per assigned must-fix and exits nonzero on any assertion failure. It uses `curl` for every request, not direct pipeline calls.

| Finding | Observed live result |
|---|---|
| MF-1 | All four reviewer sentences submitted through intake/consult; no model `consider` returned. **This does not inject adversarial provider output:** the direct regression tests exercise all four generated strings, dictionary aliases, rationale checks and treatment/unit patterns. |
| MF-2 | “Fever and sore throat.” → dismissed sepsis omitted from draft; dismissed question retained; only the explicitly kept unchanged consideration survives signing; zero edits leaves zero considerations. Audit includes the kept line ID. |
| MF-4 | Normal values confirmed level 4 → abnormal set suggests level 2 with re-confirm reason → second confirmation level 2 succeeds, clears notice and produces a second `triage_confirmed` event. |
| MF-5 | HR 130, SBP 88, RR 28, T 39.2, SpO2 89, confusion → NEWS2 **16**, level **2**. Subsequent `{ tempC: 37.5 }` → NEWS2 **14**, level **2**; SpO2 points to earlier entry, temperature to latest entry. |
| MF-6 | Separate sessions for methotrexate 10 mg daily; warfarin 50 mg daily; ibuprofen “800 mg x2” tid; paracetamol 1000 mg “every 4-6 hours prn”; insulin “100 units” tid. Each produced exactly **one** moderate unchecked alert. Methotrexate also produced the high daily-frequency caution. |
| MF-7 | Amoxicillin 1 g tid with allergies never asked produced moderate `MR-ALLERGY-UNKNOWN`. Regression tests also cover positive penicillin allergy and explicit no-known-allergies evidence. |
| MF-8 | `.`, `.....`, `a!b?c.d`, and five emoji returned **400**; a substantive reason submitted successfully with `order_submitted` audit. Regression tests additionally cover whitespace, short alphanumeric reasons and valid Thai/Italian reasons. |
| SHOULD-FIX | Red-flag edit returned **400** after flag acknowledgement. Patient GET omitted audit and clinical state; patient POST omitted orders and redacted the synthetic phone number. |

Audit types for the actions used here already exist in shared `AuditType`: `consult_suggestion`, `consult_note_signed`, `vitals_recorded`, `triage_confirmed`, `order_drafted`, `order_submitted`. New safety alerts are checks, not new clinical actions; order audit includes their stable IDs. No unchecked type casts or new undeclared audit event types were introduced.

## PATIENT CLIENT INTEGRATION
Mobile builder: switch polling to `GET /api/sessions/:id?view=patient`; read `response.session`. The envelope is `{ session: PatientView }`, with **no audit**.

Send `x-medx-client: patient` on `POST /api/sessions/:id/turns`; its response is the **bare** `PatientView`, preserving the existing POST envelope convention. CORS preflight allows this header. Requests without the opt-in retain the existing clinician responses.

`PatientView` contains only `id`, `code`, `patientLang`, `status`, `turns` and `summary`. Turns include only `role: patient`, explicit turn metadata and re-redacted text; no assistant/clinician speech or internal client IDs. Summary is `null` before extraction, otherwise only `nextQuestion` (`field`, localized `text`), `redFlags` (localized `patientMessage`, `severity`), and `abstained`. No fields, evidence, medication orders, override reasons, vitals, triage, model calls or consult state are serialized.

## ASSUMPTIONS
- Synthetic data only; no commits, installs, server restart, seed reset or environment changes.
- Latest means appended entry order, consistent with `recordVitals`; omitted parameters never erase earlier values.
- An edit entry is explicit adoption of a consideration. The existing shared note status `edited` represents that adoption; no unsupported `clinician` status was invented.
- Patient red-flag messages/status continue reflecting the current session, including consult-origin flags; changing that behavior needs a clinical/product decision.

## RISKS
- Live provider was deterministic mock. Adversarial provider response filtering is proven through direct regression tests; no claim of a live AMD/Gemma adversarial run.
- Carry-forward has no staleness cutoff. Adult/pregnancy NEWS2 applicability limits and UI re-confirm controls remain outside this engine assignment.
- Dictionary/verb rejection is deliberately conservative and may suppress otherwise useful model questions. Curated questions remain available.
- Patient projection is opt-in payload minimization, not access control. Mobile must switch requests; existing unscoped endpoints remain accessible as before.
- Existing signed historical notes are immutable and are not migrated. New drafts/signatures use the new rules.
- Clinical spec wording about model considerations and silent unchecked doses needs its owner's update.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
1. Orchestrator: promote optional `TriageAssessment.vitalSources` into `packages/shared/src/types.ts`: `Partial<Record<'respRate' | 'spo2' | 'onOxygen' | 'systolicBP' | 'heartRate' | 'consciousness' | 'tempC', { entryId: string; at: string }>>`. It is already returned/persisted by the engine using a local intersection type. Shared file left untouched under ownership rules.
2. Orchestrator/mobile: add a shared `PatientView` contract matching the allowlist above and switch the patient client GET/header. The inferred server type is currently in `patientView.ts`.
3. Doctor: update CONSULT-SPEC model suggestions to `ask_next` only, and prescribing sections for `MR-DOSE-UNCHECKED`, `MR-METHOTREXATE-DAILY`, `MR-ALLERGY-UNKNOWN`; dictionary ownership remains with the Doctor.
4. Clinician/vitals builder: show the re-confirm form/banner when `suggestedLevel < confirmed.level`; display `triage.reasons` and repeat confirmation. Server part is complete.

## NEXT ACTION
Mobile builder: switch patient polling/turn requests using the integration contract above. Orchestrator: promote the optional provenance and patient-view types. Clinical/UI owners: update spec wording and show re-confirmation controls. Assigned engine work and verification are complete; no commit created.
