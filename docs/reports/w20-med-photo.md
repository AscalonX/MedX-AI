# w20 med-photo — medicine-pack photo to suggested medicine entry

STATUS: done (live-verified against AMD; provider latency is erratic, see EVIDENCE)

## SUMMARY
Pharmacist workspace gets "Add from photo". A photo (shrunk client-side to JPEG, max side 1600 px) goes to `POST /api/sessions/[id]/med-photo`, which makes one call to the AMD-hosted vision model (`AMD_MODEL_VISION`, default `MiniCPM-V-4.7-35B-A3B`, 75 s timeout) and returns SUGGESTED entries `{name, strength, form}`. Each name is matched against `medrules.json` with the existing `lookupDrug`: a match is `matched`, anything else is `unverified`. A suggestion changes nothing (medicine list, orders, alerts) until the pharmacist confirms; confirm adds a `MedicationEntry` (matched = `verified`, unknown = `unmatched`, both with `review` set, empty evidence) and runs `refreshMedAlerts` + `refreshOrders` + `auditRechecks`, so allergy / interaction / duplicate / unknown-medicine checks run exactly as for any entry. Discard changes nothing. Provider error, schema error, empty read, or a throwing client = "needs human review" (audited, no suggestion, no guess). Mock mode (`MODEL_PROVIDER=mock`) returns a deterministic pair: Paracetamol 500 mg tablet (matched) and Zorbexin 20 mg capsule (unverified).

## FILES CHANGED
- `apps/web/lib/pipeline/medPhoto.ts` (new): validation of image (type jpeg/png/webp, 4 MB, magic bytes), model call, matching, `suggestFromPhoto`, `decideMedPhoto`. 429 from the gateway is retried up to 5 times (2–5 s apart).
- `apps/web/app/api/sessions/[id]/med-photo/route.ts` (new): multipart (`reviewerId`, `image`) or JSON (`{reviewerId, mime, imageBase64}` / `{reviewerId, action: confirm|discard, suggestionId}`); byte-capped body read; goes through `handle()` so the per-IP rate limit (`rateLimit.ts`) applies; role = pharmacist via `requireStaffRole(WRITE_ROLES.pharmacy)`.
- `apps/web/lib/pipeline/llm.ts`: optional `images?: string[]` builds `image_url` parts; schema/max_tokens choice for `schemaName 'med_photo'`; image requests always use `json_object` (see RISKS). Existing behaviour unchanged for requests without images.
- `apps/web/lib/pipeline/schema.ts`: `MED_PHOTO_SCHEMA`, `validateMedPhoto` (extra keys on an item are dropped, missing/wrong-typed keys reject, control chars and `<>` reject, max 6 items).
- `apps/web/lib/pipeline/mock.ts`: deterministic `med_photo` path.
- `apps/web/lib/pipeline/trace.ts`: a model node "Medicine photo read (model, suggestion only)" plus a pharmacist-decision node (counts only).
- `apps/web/app/(pharmacy)/_photo.tsx` (new) and `_workspace.tsx` (one import + one line): "Add from photo" card; `_lib.ts`: pharmacy audit labels for the two new types.
- `apps/web/app/(clinician)/review/_lib.ts`, `_i18n.ts`, `audit-labels.test.ts`: audit labels (en/th/it) for the two new types (an existing test requires every AuditType to be labelled).
- `packages/shared/src/types.ts` (additive): `AuditType` `med_photo_suggested`, `med_photo_decision` (+ `AUDIT_TYPES`), `MedPhotoSuggestion`, `IntakeSession.medPhoto?`.
- `.env.example`: `AMD_MODEL_VISION` documented (a test requires it).
- `apps/web/public/patient/source.sha`: re-stamped (see RISKS).
- `apps/web/lib/pipeline/__tests__/med-photo.test.ts` (new, 29 tests).

## TESTS RUN + RESULTS
- `npm --prefix apps/web test`: 54 files, 2480 passed, 0 failed (baseline 2451; +29 from the new file).
- `tsc --noEmit` with a temporary tsconfig mapping `@medx/shared` to this worktree's `packages/shared/src` (the symlinked node_modules would otherwise resolve the main checkout's old shared types): clean for app, lib, components. `apps/mobile` is not part of that run.
- New tests cover: schema validation (valid, extra keys dropped, 8 invalid shapes), mock suggestion, matched vs unverified, suggestion-only (list/alerts/orders byte-identical before confirm), audit entries and no image bytes in audit or session, model id default and `AMD_MODEL_VISION` override and 75 s timeout, provider error / schema error / invalid shape / empty read / throwing client to needs human review, type/size/magic-byte/base64 rejection, non-pharmacist 403, confirm adds entry and raises MR-UNKNOWN-01 for the unknown name, confirmed duplicate runs duplicate/max-dose check, discard, double-decision 409, reconciled 409, trace nodes, route JSON + multipart, header and stream size caps (413), 415, unknown key 400, 404.

## EVIDENCE
Live runs through the dev server on port 3201 (real AMD API, synthetic label image "AMOXIL / Amoxicillin 500 mg / Capsules", made with PIL because Chrome headless could not be run in this sandbox):
- 35B-A3B via the route: suggested `AMOXIL, 500 mg, Capsules`, status matched (generic amoxicillin), 4.8 s wall, 4.4 s model; confirm gave `AMOXIL / amoxicillin / verified`; audit rows `med_photo_suggested` (model MiniCPM-V-4.7-35B-A3B) + `med_photo_decision`.
- 1B via the route (AMD_MODEL_VISION=MiniCPM-V-4.7-1B): same result in 2.2 s wall, 1.7 s model. In one direct probe 1B put "Amoxicillin 500 mg" in `strength` and added an extra `quantity` key (now dropped by the validator).
- Direct probe of 35B: 2.9 s once.
- Provider is erratic: the same call also timed out at 75 s three times, hit `429 token_concurrency_rate_limit_exceeded` repeatedly (even after retries), and one direct probe got no response headers for 300 s. Each of these correctly ended as "needs human review" with an audit row carrying `error: "Provider timeout or turn deadline"` / `"HTTP 429"`. The earlier 49 s measurement in `docs/ai/AMD-ENDPOINT.md` is consistent with this variance, not a constant.
- UI check (mock provider, port 3202, Browser pane): card renders under Medicines; rows show "From photo · check" (dashed pencil badge), "Possible match: paracetamol" vs "Not in the drug dictionary, unverified", Confirm / Discard. Screenshots are in the session scratchpad, not committed. I did not click Confirm in the UI (layout shifted under my click); the confirm path is covered by the API tests and the live run.

## ASSUMPTIONS
- "Role check consistent with pharmacy routes" = `requireStaffRole(reviewerId, WRITE_ROLES.pharmacy)`, i.e. the same soft check as `pharmacy-review` (unknown actors allowed unless `MEDX_STRICT_ROLES=1`).
- Confirmed photo items have `evidence: []` and `confidence: 0` (there is no patient quote); `review` is set so the reconciliation "requires review" blockers do not block sign-off. The audit row, not a quote, is the provenance.
- Names read from a pack pass through `redact()` before storage (a pack can carry a patient name).
- `step: 'extract'` is reused for the model call (no new `PipelineStep`), distinguished by `schemaName 'med_photo'`.

## RISKS
- `public/patient/source.sha` was re-stamped by hand with the script's own algorithm because `packages/shared/src/types.ts` changed (the stamp test failed). The edit is additive typing only, but the Expo export was NOT rebuilt: run `bash scripts/build-patient-web.sh` before deploy if you want the stamp to be honest (apps/mobile lane).
- Strict `json_schema` response format with an image hung on MiniCPM-V in my first runs, so image requests are forced to `json_object`; I did not isolate whether the hang was the format or gateway load (later json_object runs also hung once).
- The 4 MB cap is checked on the raw base64/stream; the web client shrinks to under about 1 MB, but a direct API client can send up to 4 MB, and the model call can still take the full 75 s. Vercel function `maxDuration` is set to 90 on the route (plan limits not checked).
- A later patient turn that regenerates the summary may overwrite confirmed photo entries in `summary.medications` (same as any pharmacist edit today; not changed here).
- No live confirmation that the camera `capture` attribute behaves on a real phone.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- Orchestrator: shared contract additions listed above (two `AuditType`s, `MedPhotoSuggestion`, `IntakeSession.medPhoto`); `docs/ai/AMD-ENDPOINT.md` could note the erratic latency and the 1B extra-key behaviour (not edited: other lane).
- Default model: kept 35B (cleaner output) over 1B (faster, sloppier strength field). Say if you prefer 1B as default.

## NEXT ACTION
Merge, rebuild the patient export (or accept the re-stamp), set `AMD_MODEL_VISION` only if overriding the default, and demo with a synthetic label; keep the "needs human review" fallback in the script because the gateway can stall.
