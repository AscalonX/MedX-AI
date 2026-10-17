# W14 QA bug report (consult, vitals/triage, orders, pharmacy, cross-cutting)

Target: http://localhost:3000 (mock model), 17 Oct 2026. Scripts: `qa/20-consult.mjs`, `qa/21-vitals-triage.mjs`, `qa/22-orders.mjs`, `qa/23-cross-cutting.mjs`, helper `qa/lib2.mjs`. Run: `BASE=http://localhost:3000 node qa/2N-*.mjs`.
No product files were edited. Codex edited `lib/pipeline` while I ran (see "Fixed during QA").

## Summary

| Area | Script | Checks | Result |
|---|---|---|---|
| Consult turns/state/suggestions/note | 20 | 105 | 5 fail (C01c, C12, C33, C77, N07 = bugs below) |
| Vitals / NEWS2 / triage confirm | 21 | 161 (incl. 80-point NEWS2 boundary grid) | 1 "fail" = design question, not filed as bug (V26 note below) |
| Orders / prescribing checks / pharmacy | 22 | 106 | 2 fail (O03b, P09) |
| Audit PII, CORS, 404/405, concurrency | 23 | 78 | 0 fail |
| `npx vitest run` | | 1368 tests, 18 files (run before commit 2cda6f4; not re-run after) | all pass |
| `npx tsc --noEmit` | | | clean |
| qa/01-contract | | 87 | 87 pass |
| qa/03-safety | | 72 | 3 fail (S10c = real PII bug P1-1; S20/S20b = stale test, see below) |

Bug counts (open): P0 0, P1 3, P2 6. One further P1 (AI "consider" lines kept in the signed note) and one P1/P2 class (silent unparseable dose) were found and fixed by Codex while I ran (commit 2cda6f4); re-verified. Verified OK (no bug): critical NEWS2 case (HR118/SBP92/RR24/T39.1/SpO2 93 = level 2), incomplete normal = 3, complete normal = 4, every NEWS2 boundary, triage confirm rules, red flag after vitals recomputes triage, unknown drug/investigation, allergy conflict with patient quote evidence, warfarin interaction, duplicate with other active order and with current meds, pregnancy alerts, exactly one dose_range alert per order, override validation, 409 on double submit/verify/return, return then re-edit re-runs checks, parallel submit (1x200, 9x409), no lost updates under parallel drafts/vitals/consult, CORS preflight on all 11 new routes, 404/405, 70KB body 413, no raw PII from `recordedBy/orderedBy/reviewerId/note/reason/override` in session, audit, list or consult state, clinician speech never becomes evidence or a red flag, consult "consider" never in nurse mode.

## P1

### P1-1 Bare patient/clinician names and hospital numbers are stored unredacted (worst on the ambient consult path)
Repro:
```
S=$(curl -s -XPOST localhost:3000/api/sessions -H 'content-type: application/json' -d '{"patientLang":"en"}' | jq -r .id)
curl -s -XPOST localhost:3000/api/sessions/$S/consult/turns -H 'content-type: application/json' -d '{"speaker":"clinician","text":"Good morning Mr. Somchai Jaidee, what brings you in?","mode":"nurse"}' >/dev/null
curl -s -XPOST localhost:3000/api/sessions/$S/consult/turns -H 'content-type: application/json' -d '{"speaker":"patient","text":"Hi, I am Somchai Jaidee. My hospital number is HN 1234567. Headache since yesterday","mode":"nurse"}' >/dev/null
curl -s localhost:3000/api/sessions/$S | jq '.session.turns[].text'
```
Expected: `[NAME_n]` and an ID placeholder (invariant: raw PII never stored). Actual: all three kept verbatim:
`"Good morning Mr. Somchai Jaidee, what brings you in?"`, `"Hi, I am Somchai Jaidee. My hospital number is HN 1234567. Headache since yesterday"`. Also "Hello Somchai, ...", "Yes doctor, Somchai here", "Mrs. Malee Srisuk, are you ...", "Patient ID 7654321". Only cue phrases ("My name is X") are redacted; phones, emails, DOB, addresses work. Existing `qa/03-safety.mjs` S10c now fails because these names appear in `GET /api/sessions`. Greeting the patient by name is normal in a consult, so this is the most likely PII leak in the demo. Suspected: `apps/web/lib/pipeline/redact.ts` (name cues; no HN/ID pattern). Pre-existing limitation, newly reachable from clinician speech.

### P1-2 Nurse mode can sign the consult note
Spec CONSULT-SPEC §3/§6: nurse "cannot sign", signing is doctor only.
```
curl -s -XPOST localhost:3000/api/sessions/$S/consult/note -H 'content-type: application/json' -d '{"reviewerId":"nurse-1","mode":"nurse","action":"draft"}' >/dev/null
curl -s -XPOST localhost:3000/api/sessions/$S/consult/note -H 'content-type: application/json' -d '{"reviewerId":"nurse-1","mode":"nurse","action":"sign"}' | jq .note.signed
```
Expected: 4xx. Actual: 200 `{"reviewerId":"nurse-1","at":"..."}` and a `consult_note_signed` audit row. Suspected: `consultNote()` in `lib/pipeline/consult.ts` (no mode check on `action === 'sign'`). `qa/20` C33.

### P1-3 Signing succeeds while an `unsupported` line is unresolved
Spec §6: "Blocked while any unsupported line remains unresolved". Repro: patient says "I am a 45 year old man. I have a headache since yesterday 7/10. I take no medicines and have no allergies." via `/consult/turns`, then `draft`, then `sign` (no edits). The draft contains line `missing:fields` with `status:"unsupported"`; sign returns 200 and the signed note keeps it. Expected 409. Suspected: `consultNote()` sign branch checks only red flags. `qa/20` N07.

## P2

- **P2-1 Unrelated clinician speech marks "age" as asked.** `askedMatch` counts stop-words: "Are you OK? Do you want some water?" shares "are you" with "How old are you?" (2/4 tokens >= .5), so the age prompt leaves the open list and the clinician is never prompted. Repro: POST consult turn `{"speaker":"clinician","text":"Are you OK? Do you want some water?","mode":"nurse"}` then see `ask_next:field:age` status `asked`. Suspected: `askedMatch` in `consult.ts` (needs stop-word removal / content-word threshold). `qa/20` C12.
- **P2-2 `asked` never becomes `answered`.** Spec §5. Clinician "How old are you?", patient "I am 45 years old": `ask_next:field:age` stays `asked` and stays listed although the field is now supported. Suspected: `refresh()` preserves old status forever. `qa/20` C77.
- **P2-3 `clientTurnId` leaks into the public session JSON.** `GET /api/sessions/:id` turns contain `"clientTurnId":"c-1"` (not in the `Turn` type). Suspected: `consult.ts` / `pipeline.ts addTurnInLock` store it on the turn. `qa/20` C01c.
- **P2-4 `fromSuggestionId` is not validated.** `POST /orders/investigations {"code":"fbc","fromSuggestionId":"does-not-exist-anywhere"}` returns 200 and stores it, so the order claims provenance from a suggestion that does not exist. Suspected: `investigationOrder()` in `orders.ts`. `qa/22` O03b.
- **P2-5 A pharmacist-verified order can be cancelled by the doctor (200).** `submit` -> `pharmacy verify` -> `cancel` returns 200 and status `cancelled`, erasing the verified state; the audit row is type `order_drafted` with `payload.action:"cancel"` (no cancel audit type). Expected 409, or at least a dedicated audit type. Suspected: `medicationAction` cancel branch only rejects `cancelled`. `qa/22` P09.
- **P2-6 Spec/test docs still say MR-DOSE-01/02.** `docs/clinical/MEDRULES-TESTS.md` line 224 and CONSULT-SPEC §11 describe two alerts; the engine now emits one `MR-DOSE-RANGE` (plus `MR-DOSE-UNCHECKED`). Docs need syncing.

## Fixed during QA (found, then Codex changed the code while I ran)
- Signed consult note kept AI `considerations` lines the doctor never kept (spec §6). Now dropped at sign (`qa/20` N09 passes after 2cda6f4).
- Unparseable dose/frequency silently skipped the dose check: paracetamol "5,000 mg", "5 grams", "5000 milligrams", "5000 มก." daily, or 1000 mg "five times a day" / "every 4 hours as needed" / "6 hourly" returned zero alerts and could be submitted and verified. Now raises `MR-DOSE-UNCHECKED` (moderate). `qa/22` G01 passes. Note it is moderate, so no override is forced.
- Duplicate dose_range alert: verified one `MR-DOSE-RANGE` for single, daily and both exceeded (`qa/22` D01-D20).

## Observations (not filed)
- Triage confirm at level 4 is accepted with a note on a session with no vitals (suggestion is 3, so a note is required). Matches code; flagging only in case the team wants to block it (`qa/21` V26 intentionally asserts the stricter behaviour and will fail).
- Orders and vitals are still accepted on `taken_over` sessions (consult turns correctly 409).
- Third identical paracetamol order gets two `MR-MAXDOSE-01` alerts (one per pairing); alert count grows with order count.
- `consult_turn` audit rows have no `actorId` (the request carries no reviewer).
- Stale existing QA expectations, not product bugs: `qa/03` S20/S20b (server now 409s approval while red flags are unreviewed), `qa/06` K01 (sessions with no patient turn are intentionally hidden from the list), `qa/02` E10b (accepted in w9).
