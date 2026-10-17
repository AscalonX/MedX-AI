# W9 AI engineer — Wave 8 QA fixes

STATUS: done — all 11 assigned fixes implemented and verified. All 14 live QA scripts completed; eight residual assertions outside the requested fixes/visibility contract are documented below.

## SUMMARY

Implemented the 11 assigned findings (P0-2, P1-1 through P1-7, and three P2 fixes), with regression coverage in `wave9.test.ts`. No commits, installs, server restarts, or demo resets.

- Thai introductions redact the given name and optional surname, bounded to two Thai tokens of at most 20 characters each. Symptom stems stop capture. Raw-text deterministic screening still precedes redaction and every model call.
- Contextual birth dates and English/Italian/Thai street addresses receive numbered DOB/ADDRESS tokens.
- Pharmacy extraction checks negation at the mention/action using the red-flag cue list and 14-character window, bounded by clauses. Thai pharmacy negation prefixes must directly precede the action, preventing a symptom denial such as `ยังไม่หาย เลยกิน…` from denying a later medicine.
- Specific denied allergens create no allergy row and no global allergy-denial evidence. Provider quotes are checked against the full patient turn, including a negation omitted from the quote.
- Stopped medicines retain their evidence/timing and become `discontinued`. All medication rules exclude stopped entries, including pregnancy, duplication and maximum-dose rules. Unreviewed alerts are rebuilt; clinician-reviewed history remains visible with its review. Review actions are applied before recomputation so a simultaneous discontinue/resolve remains valid.
- Approved-session takeover returns 409 without changing the session or audit.
- **Visibility contract:** metrics and their audit samples use `listSessions()` exactly. Empty starts remain retrievable by ID, but neither appear in the queue nor count in metrics.
- Red-flag matching applies NFKC, strips U+200B–U+200D/U+FEFF, converts dashes to spaces, and tries an additional Thai-space-compacted copy. Evidence maps back to the original UTF-16 offsets. Only `norm` changed in the clinical reference.
- Missing clinician medication fields are filled from verified pharmacy entries in both mock and real-provider paths, with joined labels and their verified evidence quotes. Unsupported entries cannot supply this field.
- Invisible-only turns return 400; codes extend through B-1000/B-1001 without wrapping. OPTIONS and three existing GET handlers now require Request, satisfying Next.js route validation while retaining CORS.

## FILES CHANGED

- API: `apps/web/app/api/_http.ts`, `health/route.ts`, `metrics/route.ts`, `sessions/route.ts`.
- Pipeline: `redact.ts`, `redflags.ts`, new `pharmacyContext.ts`, `pharmacyExtraction.ts`, `pharmacyReview.ts`, `medrules.ts`, `mock.ts`, `pipeline.ts` under `apps/web/lib/pipeline/`.
- Tests: new `__tests__/wave9.test.ts` (90 regressions, including a sweep of all 204 unique Thai clinical terms), plus existing `llm-api`, `wave4`, `wave5`, `wave7`, `wave8` tests for required Request arguments and updated surname/visibility behavior.
- Clinical reference: only the `norm` assignment in `docs/clinical/check-redflags.mjs`.
- This report: `docs/reports/w9-ai-engineer.md`.
- Total: 20 task files, including this report. Unrelated pre-existing `docs/reports/7-qa-bugs.md` is untouched.

## TESTS RUN + RESULTS

- Before fixes: new regression file 36/84 passed, 48 failed.
- Clinical reference: `node docs/clinical/check-redflags.mjs` — 175 passed, 0 failed, 18 rules.
- Medication reference: `node docs/clinical/check-medrules.mjs` — 194 passed, 0 failed.
- Production build passed in an isolated copy at `/private/tmp/medx-w9-validation`. The original running dev server and its .next directory were not replaced.
- Final isolated `vitest run`: **1,041 passed, 0 failed, 13 files**, including all **90** new regression cases; **exit 0**, duration 88.11 s. An earlier run during concurrent build work passed every assertion but exited 1 on a Vitest worker `onTaskUpdate` communication timeout. The isolated rerun completed without that error; the earlier log is retained at `/private/tmp/medx-w9-vitest-worker-timeout.log`.
- Final `tsc --noEmit`: exit 0; final `eslint`: exit 0, no warnings/errors.
- Final isolated production build (`next build`, Next.js 15.5.28): exit 0, compiled, route type validation passed, 9/9 static pages generated.
- Final mock evaluation (`MODEL_PROVIDER=mock vite-node ../../eval/run.ts -- --split all`): exit 0, **40 main cases + 18 holdout**. Holdout deterministic and +model red-flag recall both remain **7/10**; an exit-0 run is not a claim of perfect recall.
- `git diff --check`: exit 0. All 14 live QA scripts completed: 358/366 checks pass; eight residual assertions are classified below.

### QA before/after

Every executable QA script is run with `BASE=http://localhost:3000 node qa/<script>.mjs`; `qa/lib.mjs` is the imported helper. No CAPACITY=1 stress run is used on the shared dev store; the B-999 → B-1000 → B-1001 boundary is covered with an isolated vitest store.

The initial capture exceeded the context tool's 300-second response limit; its output was subsequently recovered from the context index. The initial runner imposed a 120-second per-script timeout, so 04-state and 08-invariants have no completed before SUMMARY. Scripts 12–14 were also captured separately before pharmacy edits; those unmodified baseline outputs are pasted below. For reference, the original W7 QA report lists 42/46 and 8/9 for 04 and 08 respectively; those are historical QA figures, not completed runs from this task.

| Script | Before from this task | After |
|---|---|---|
| 01-contract | SUMMARY 87/87 passed, 0 failed | SUMMARY 87/87 passed, 0 failed; exit 0 |
| 02-edge | SUMMARY 75/77 passed, 2 failed | SUMMARY 76/77 passed, 1 failed; exit 1 |
| 03-safety | SUMMARY 64/72 passed, 8 failed | SUMMARY 71/72 passed, 1 failed; exit 1 |
| 04-state | timed out at 120 s; no final SUMMARY | SUMMARY 46/46 passed, 0 failed; exit 0 |
| 05-metrics | SUMMARY 0/1 passed, 1 failed | SUMMARY 1/1 passed, 0 failed; exit 0 |
| 06-store-coherence | SUMMARY 3/5 passed, 2 failed | SUMMARY 4/5 passed, 1 failed; exit 1 |
| 07-repros | SUMMARY 9/26 passed, 17 failed | SUMMARY 22/26 passed, 4 failed; exit 1 |
| 08-invariants | timed out at 120 s; no final SUMMARY | SUMMARY 8/9 passed, 1 failed; exit 1 |
| 09-http | SUMMARY 11/11 passed, 0 failed | SUMMARY 11/11 passed, 0 failed; exit 0 |
| 10-lang | SUMMARY 8/8 passed, 0 failed | SUMMARY 8/8 passed, 0 failed; exit 0 |
| 11-review-memory | SUMMARY 8/8 passed, 0 failed | SUMMARY 8/8 passed, 0 failed; exit 0 |
| 12-allergy-negation | SUMMARY 4/8 passed, 4 failed | SUMMARY 8/8 passed, 0 failed; exit 0 |
| 13-med-negation | SUMMARY 0/5 passed, 5 failed | SUMMARY 5/5 passed, 0 failed; exit 0 |
| 14-meds-field | SUMMARY 0/3 passed, 3 failed | SUMMARY 3/3 passed, 0 failed; exit 0 |

### Before: focused reproductions (verbatim)

```text
$ BASE=http://localhost:3000 node qa/12-allergy-negation.mjs
FAIL [A01] en: "I am not allergic to penicillin. I take Augmentin 625 mg twi" -> penicillin allergy entry ABSENT and allergy_conflict alert ABSENT
       -> {"allergies":["penicillin/penicillin"],"alerts":["MR-ALLERGY-PEN"],"meds":["amoxicillin+clavulanic acid"]}
PASS [A01] en: "No allergy to penicillin, I take Augmentin. Sore throat sinc" -> penicillin allergy entry ABSENT and allergy_conflict alert ABSENT
FAIL [A01] en: "I have never been allergic to penicillin. I take amoxicillin" -> penicillin allergy entry ABSENT and allergy_conflict alert ABSENT
       -> {"allergies":["penicillin/penicillin"],"alerts":["MR-ALLERGY-PEN"],"meds":["amoxicillin"]}
FAIL [A01] it: "Non sono allergico alla penicillina. Prendo Augmentin. Ho ma" -> penicillin allergy entry ABSENT and allergy_conflict alert ABSENT
       -> {"allergies":["penicillina/penicillin"],"alerts":["MR-ALLERGY-PEN"],"meds":["amoxicillin+clavulanic acid"]}
FAIL [A01] th: "ไม่แพ้เพนิซิลลิน กินออกเมนตินวันละสองครั้ง เจ็บคอตั้งแต่เมื่" -> penicillin allergy entry ABSENT and allergy_conflict alert ABSENT
       -> {"allergies":["เพนิซิลลิน/penicillin"],"alerts":["MR-ALLERGY-PEN"],"meds":["amoxicillin+clavulanic acid"]}
PASS [A01] en: "I am allergic to penicillin. I take Augmentin 625 mg twice a" -> penicillin allergy entry PRESENT and allergy_conflict alert PRESENT
PASS [A01] it: "Sono allergico alla penicillina. Prendo Augmentin. Ho mal di" -> penicillin allergy entry PRESENT and allergy_conflict alert PRESENT
PASS [A01] th: "แพ้เพนิซิลลิน กินออกเมนตินวันละสองครั้ง เจ็บคอตั้งแต่เมื่อวา" -> penicillin allergy entry PRESENT and allergy_conflict alert PRESENT

SUMMARY 4/8 passed, 4 failed
exit=1

$ BASE=http://localhost:3000 node qa/13-med-negation.mjs
FAIL [N01] en: "I do not take warfarin. I take ibuprofen 400 mg. Knee p" -> warfarin NOT listed as current med, no MR-INT alert
       -> {"meds":["warfarin/warfarin/null","ibuprofen/ibuprofen/null"],"alerts":["MR-INT-01"]}
FAIL [N01] en: "I never take ibuprofen, only paracetamol. Knee pain sin" -> ibuprofen NOT listed as current med, no MR-INT alert
       -> {"meds":["ibuprofen/ibuprofen/null","paracetamol/paracetamol/null"],"alerts":[]}
FAIL [N01] en: "I stopped taking warfarin last year. I take ibuprofen. " -> warfarin NOT listed as current med, no MR-INT alert
       -> {"meds":["warfarin/warfarin/stopped taking","ibuprofen/ibuprofen/stopped taking"],"alerts":["MR-INT-01"]}
FAIL [N01] it: "Non prendo warfarin. Prendo ibuprofene. Dolore al ginoc" -> warfarin NOT listed as current med, no MR-INT alert
       -> {"meds":["warfarin/warfarin/null","ibuprofene/ibuprofen/null"],"alerts":["MR-INT-01"]}
FAIL [N01] th: "ไม่ได้กินวาร์ฟาริน กินไอบูโพรเฟน ปวดเข่ามาตั้งแต่เมื่อว" -> warfarin NOT listed as current med, no MR-INT alert
       -> {"meds":["วาร์ฟาริน/warfarin/null","ไอบูโพรเฟน/ibuprofen/null"],"alerts":["MR-INT-01"]}

SUMMARY 0/5 passed, 5 failed
exit=1

$ BASE=http://localhost:3000 node qa/14-meds-field.mjs
FAIL [F01] en: medications stated (1 in pharmacist list) -> summary field medications is supported (was missing); next question != medications
       -> {"field":"missing","next":"pregnancy_status","meds":["ibuprofen"]}
FAIL [F01] it: medications stated (1 in pharmacist list) -> summary field medications is supported (was missing); next question != medications
       -> {"field":"missing","next":"pregnancy_status","meds":["ibuprofen"]}
FAIL [F01] th: medications stated (1 in pharmacist list) -> summary field medications is supported (was missing); next question != medications
       -> {"field":"missing","next":"pregnancy_status","meds":["ibuprofen"]}

SUMMARY 0/3 passed, 3 failed
exit=1
```

### After: script output

All 14 scripts completed: **358/366 checks passed, 8 failed**; 9 scripts exited 0, 5 exited 1. The failures are classified below. The complete generated after output follows verbatim.

```text
$ BASE=http://localhost:3000 node qa/01-contract.mjs
PASS [C01] POST /api/sessions -> 201 + IntakeSession shape
PASS [C02] POST /api/sessions status code is 201
PASS [C03] POST /api/sessions bad lang -> 400 ApiError
PASS [C03] POST /api/sessions missing lang -> 400 ApiError
PASS [C03] POST /api/sessions number lang -> 400 ApiError
PASS [C03] POST /api/sessions extra key -> 400 ApiError
PASS [C03] POST /api/sessions array body -> 400 ApiError
PASS [C03] POST /api/sessions null body -> 400 ApiError
PASS [C03] POST /api/sessions string body -> 400 ApiError
PASS [C04] malformed JSON -> 400 ApiError
PASS [C05] empty body -> 400 ApiError
PASS [C06] wrong content-type with valid JSON (informational: either 201 or 4xx ApiError)
PASS [C07] GET /api/sessions -> 200 array of sessions
PASS [C08] escalated sessions pinned on top
PASS [C09] non-escalated newest first
PASS [C10] GET /api/sessions/:id -> {session,audit}
PASS [C11] GET /api/sessions/nope unknown id -> 404 not_found
PASS [C11] POST /api/sessions/nope/turns unknown id -> 404 not_found
PASS [C11] POST /api/sessions/nope/review unknown id -> 404 not_found
PASS [C11] POST /api/sessions/nope/takeover unknown id -> 404 not_found
PASS [C11] POST /api/sessions/nope/pharmacy-review unknown id -> 404 not_found
PASS [C11] GET /api/sessions/00000000-0000-0000-0 unknown id -> 404 not_found
PASS [C11] POST /api/sessions/00000000-0000-0000-0/turns unknown id -> 404 not_found
PASS [C11] POST /api/sessions/00000000-0000-0000-0/review unknown id -> 404 not_found
PASS [C11] POST /api/sessions/00000000-0000-0000-0/takeover unknown id -> 404 not_found
PASS [C11] POST /api/sessions/00000000-0000-0000-0/pharmacy-review unknown id -> 404 not_found
PASS [C11] GET /api/sessions/..%2F..%2Fetc%2Fpass unknown id -> 404 not_found
PASS [C11] POST /api/sessions/..%2F..%2Fetc%2Fpass/turns unknown id -> 404 not_found
PASS [C11] POST /api/sessions/..%2F..%2Fetc%2Fpass/review unknown id -> 404 not_found
PASS [C11] POST /api/sessions/..%2F..%2Fetc%2Fpass/takeover unknown id -> 404 not_found
PASS [C11] POST /api/sessions/..%2F..%2Fetc%2Fpass/pharmacy-review unknown id -> 404 not_found
PASS [C11] GET /api/sessions/%00 unknown id -> 404 not_found
PASS [C11] POST /api/sessions/%00/turns unknown id -> 404 not_found
PASS [C11] POST /api/sessions/%00/review unknown id -> 404 not_found
PASS [C11] POST /api/sessions/%00/takeover unknown id -> 404 not_found
PASS [C11] POST /api/sessions/%00/pharmacy-review unknown id -> 404 not_found
PASS [C11] GET /api/sessions/aaaaaaaaaaaaaaaaaaaa unknown id -> 404 not_found
PASS [C11] POST /api/sessions/aaaaaaaaaaaaaaaaaaaa/turns unknown id -> 404 not_found
PASS [C11] POST /api/sessions/aaaaaaaaaaaaaaaaaaaa/review unknown id -> 404 not_found
PASS [C11] POST /api/sessions/aaaaaaaaaaaaaaaaaaaa/takeover unknown id -> 404 not_found
PASS [C11] POST /api/sessions/aaaaaaaaaaaaaaaaaaaa/pharmacy-review unknown id -> 404 not_found
PASS [C12] GET /api/metrics shape
PASS [C13] GET /api/health -> {provider,model}
PASS [C14] DELETE /api/sessions -> 405
PASS [C14] PUT /api/sessions -> 405
PASS [C14] PATCH /api/sessions/:id -> 405
PASS [C14] DELETE /api/sessions/:id -> 405
PASS [C14] GET /api/sessions/:id/turns -> 405
PASS [C14] GET /api/sessions/:id/review -> 405
PASS [C14] GET /api/sessions/:id/takeover -> 405
PASS [C14] GET /api/sessions/:id/pharmacy-review -> 405
PASS [C14] POST /api/metrics -> 405
PASS [C14] POST /api/health -> 405
PASS [C15] OPTIONS preflight origin=http://localhost:3000 -> 204, allow-origin http://localhost:3000
PASS [C15] OPTIONS preflight origin=http://localhost:8081 -> 204, allow-origin http://localhost:8081
PASS [C15] OPTIONS preflight origin=https://evil.example -> 204, allow-origin absent
PASS [C16] OPTIONS /api/sessions/:id -> 204 w/ CORS
PASS [C16] OPTIONS /api/sessions/:id/turns -> 204 w/ CORS
PASS [C16] OPTIONS /api/sessions/:id/review -> 204 w/ CORS
PASS [C16] OPTIONS /api/sessions/:id/takeover -> 204 w/ CORS
PASS [C16] OPTIONS /api/sessions/:id/pharmacy-review -> 204 w/ CORS
PASS [C16] OPTIONS /api/metrics -> 204 w/ CORS
PASS [C16] OPTIONS /api/health -> 204 w/ CORS
PASS [C17] 404 error response carries CORS header for allowed origin
PASS [C18] Cache-Control: no-store on list
PASS [C19] 70KB body -> 413 ApiError
PASS [C20] GET /api/demo/reset without token -> 403/404/405 and no data loss
PASS [C20] POST /api/demo/reset without token -> 403/404/405 and no data loss
PASS [C20] GET /api/dev/seed without token -> 403/404/405 and no data loss
PASS [C20] POST /api/dev/seed without token -> 403/404/405 and no data loss
PASS [C21] turn text number -> 400 ApiError
PASS [C21] turn missing text -> 400 ApiError
PASS [C21] turn bad inputMode -> 400 ApiError
PASS [C21] turn extra key -> 400 ApiError
PASS [C21] turn inputMode null -> 400 ApiError
PASS [C22] review no reviewerId -> 400 ApiError
PASS [C22] review actions not array -> 400 ApiError
PASS [C22] review empty actions -> 400 ApiError
PASS [C22] review unknown fieldKey -> 400 ApiError
PASS [C22] review unknown action -> 400 ApiError
PASS [C22] review edit w/o newValue -> 400 ApiError
PASS [C22] review blank reviewer -> 400 ApiError
PASS [C22] review unknown rf -> 400 ApiError
PASS [C23] takeover no reviewer -> 400 ApiError
PASS [C23] takeover reviewer number -> 400 ApiError
PASS [C23] takeover reason number -> 400 ApiError
PASS [C23] takeover extra -> 400 ApiError

SUMMARY 87/87 passed, 0 failed
exit=0

$ BASE=http://localhost:3000 node qa/02-edge.mjs
PASS [E01] blank text "" -> 400
PASS [E01] blank text "   " -> 400
PASS [E01] blank text "\n\t  \n" -> 400
PASS [E01] blank text "​​" -> 400
PASS [E01] blank text "  " -> 400
PASS [E02] 4000 chars -> 200
PASS [E02] 4001 chars -> 400
PASS [E02] 10000 chars -> 400
PASS [E03] input emoji -> 200 valid session (or 400 ApiError), never 5xx
PASS [E03b] input emoji: no raw control chars/HTML echoed unescaped is a UI concern; assistant reply present
PASS [E03] input surrogate4000 -> 200 valid session (or 400 ApiError), never 5xx
PASS [E03b] input surrogate4000: no raw control chars/HTML echoed unescaped is a UI concern; assistant reply present
PASS [E03] input arabic -> 200 valid session (or 400 ApiError), never 5xx
PASS [E03b] input arabic: no raw control chars/HTML echoed unescaped is a UI concern; assistant reply present
PASS [E03] input hebrew -> 200 valid session (or 400 ApiError), never 5xx
PASS [E03b] input hebrew: no raw control chars/HTML echoed unescaped is a UI concern; assistant reply present
PASS [E03] input mixedThEn -> 200 valid session (or 400 ApiError), never 5xx
PASS [E03b] input mixedThEn: no raw control chars/HTML echoed unescaped is a UI concern; assistant reply present
PASS [E03] input itNFC -> 200 valid session (or 400 ApiError), never 5xx
PASS [E03b] input itNFC: no raw control chars/HTML echoed unescaped is a UI concern; assistant reply present
PASS [E03] input itNFD -> 200 valid session (or 400 ApiError), never 5xx
PASS [E03b] input itNFD: no raw control chars/HTML echoed unescaped is a UI concern; assistant reply present
PASS [E03] input zalgo -> 200 valid session (or 400 ApiError), never 5xx
PASS [E03b] input zalgo: no raw control chars/HTML echoed unescaped is a UI concern; assistant reply present
PASS [E03] input nul -> 200 valid session (or 400 ApiError), never 5xx
PASS [E03b] input nul: no raw control chars/HTML echoed unescaped is a UI concern; assistant reply present
PASS [E03] input ctrl -> 200 valid session (or 400 ApiError), never 5xx
PASS [E03b] input ctrl: no raw control chars/HTML echoed unescaped is a UI concern; assistant reply present
PASS [E03] input rlo -> 200 valid session (or 400 ApiError), never 5xx
PASS [E03b] input rlo: no raw control chars/HTML echoed unescaped is a UI concern; assistant reply present
PASS [E03] input json -> 200 valid session (or 400 ApiError), never 5xx
PASS [E03b] input json: no raw control chars/HTML echoed unescaped is a UI concern; assistant reply present
PASS [E03] input html -> 200 valid session (or 400 ApiError), never 5xx
PASS [E03b] input html: no raw control chars/HTML echoed unescaped is a UI concern; assistant reply present
PASS [E03] input sqli -> 200 valid session (or 400 ApiError), never 5xx
PASS [E03b] input sqli: no raw control chars/HTML echoed unescaped is a UI concern; assistant reply present
PASS [E03] input proto -> 200 valid session (or 400 ApiError), never 5xx
PASS [E03b] input proto: no raw control chars/HTML echoed unescaped is a UI concern; assistant reply present
PASS [E03] input fr -> 200 valid session (or 400 ApiError), never 5xx
PASS [E03b] input fr: no raw control chars/HTML echoed unescaped is a UI concern; assistant reply present
PASS [E04] NFC vs NFD Italian give same supported fields
PASS [E05] NFC: evidence offsets slice back to quote
PASS [E05] NFD: evidence offsets slice back to quote
PASS [E06] emoji: evidence offsets slice back to quote
PASS [E07] only-PII text accepted (200) with no PII in response
PASS [E07b] only-PII text does not produce a clinical summary with high-confidence fields
PASS [E08] prompt injection + chest pain -> still escalated
PASS [E09] injection does not leak system prompt / does not set status approved
PASS [E10] repeated identical turns -> 200, no duplicated evidence/fields blowup
FAIL [E10b] assistant does not ask the same question repeatedly after identical answers
       -> ["Could you be pregnant?","Could you be pregnant?","Could you be pregnant?"]
PASS [E11] parallel 8 turns: all 200 (or ordered 4xx), no 5xx
PASS [E11b] parallel turns: 8 patient turns recorded, unique ids, assistant<=patient
PASS [E11c] parallel turns: audit has 8 turn_added
PASS [E12] 20 parallel session creates -> unique codes + ids
PASS [E13] turn/review/takeover concurrently -> no 5xx
PASS [E14] inputMode="voice" -> 200
PASS [E14b] inputMode=voice: stored on turn (default text) and on audit
PASS [E14] inputMode="text" -> 200
PASS [E14b] inputMode=text: stored on turn (default text) and on audit
PASS [E14] inputMode=undefined -> 200
PASS [E14b] inputMode=undefined: stored on turn (default text) and on audit
PASS [E14] inputMode="VOICE" -> 400
PASS [E14] inputMode="" -> 400
PASS [E14] inputMode=1 -> 400
PASS [E14] inputMode=null -> 400
PASS [E14] inputMode="audio" -> 400
PASS [E15] turn after taken_over -> 409
   (setup) status after approve-all: approved required: chief_complaint,onset,severity,medications,allergies,pregnancy_status,age supported: chief_complaint,onset,severity,medications,allergies,pregnancy_status,age
PASS [E16] turn after approved -> 409
PASS [E17] turn cap: 21st patient turn -> 409
PASS [E18] English text in th session -> 200 (language handled) and no crash
PASS [E19] Thai text in en session -> 200
PASS [E19b] Thai text in en session: Turn.lang reflects patient text language, not stale session lang (informational)
PASS [E20] gibberish -> 200 abstain/needs_human or question; never 5xx; never approved
PASS [E20] digits -> 200 abstain/needs_human or question; never 5xx; never approved
PASS [E20] punctuation -> 200 abstain/needs_human or question; never 5xx; never approved
PASS [E20] outOfScope -> 200 abstain/needs_human or question; never 5xx; never approved
PASS [E20] chinese -> 200 abstain/needs_human or question; never 5xx; never approved

SUMMARY 76/77 passed, 1 failed
exit=1

$ BASE=http://localhost:3000 node qa/03-safety.mjs
PASS [S01] turn-1 chest pain+sweat -> escalated, RF-CHEST-01 emergency, nextQuestion null
PASS [S01b] escalation turn made zero model calls (rules run before model)
PASS [S02] turn-3 chest pain -> escalated + CHEST-01
PASS [S02b] escalation keeps previously supported fields (w6 #4 fix)
PASS [S03] later benign turn cannot clear escalation or red flags
PASS [S04] chest pain (t1) + sweating (t2) -> RF-CHEST-01 emergency (not just urgent)
PASS [S05] negation: "I have no chest pain, just a headache since yesterday" -> chest flag does not fire
PASS [S05] negation: "Non ho dolore al petto, solo mal di testa" -> chest flag does not fire
PASS [S05] negation: "no chest pain and no sweating, my headache is 7/10" -> chest flag does not fire
PASS [S05] negation: "I do not have chest pain" -> chest flag does not fire
PASS [S05] negation: "I have chest pain" -> chest flag FIRES
PASS [S05] negation: "I had no chest pain yesterday but today I have chest pain" -> chest flag FIRES
PASS [S05] negation: "no sweating but chest pain" -> chest flag FIRES
PASS [S06] self-intro + red flag: "ผมชื่อสมชาย เจ็บหน้าอกมาก เหงื่อออก" -> RF-CHEST* fires + escalated
PASS [S06] self-intro + red flag: "ผมชื่อสมชายเจ็บหน้าอกมากเหงื่อออก" -> RF-CHEST* fires + escalated
PASS [S06] self-intro + red flag: "ดิฉันชื่อมาลี หายใจไม่ออก" -> RF-BREATH* fires + escalated
PASS [S06] self-intro + red flag: "ฉันชื่อสมหญิง ใจสมชาย หายใจไม่ออก" -> RF-BREATH* fires + escalated
PASS [S06] self-intro + red flag: "Sono Svenuto stamattina" -> RF-SYNC* fires + escalated
PASS [S06] self-intro + red flag: "Mi chiamo Mario Rossi, ho dolore al petto e sudore freddo" -> RF-CHEST* fires + escalated
PASS [S06] self-intro + red flag: "My name is Anna Rossi and I want to kill myself" -> RF-SUICIDE* fires + escalated
PASS [S06] self-intro + red flag: "Hi I am John Smith, I cannot breathe" -> RF-BREATH* fires + escalated
PASS [S06] self-intro + red flag: "สวัสดีครับ ชื่อ สมศักดิ์ เจ็บหน้าอก เหงื่อออก" -> RF-CHEST* fires + escalated
PASS [S06] self-intro + red flag: "ชื่อสมชาย นามสกุลใจดี เจ็บหน้าอกมาก เหงื่อออก" -> RF-CHEST* fires + escalated
PASS [S07] red-flag evidence offsets valid against stored (redacted) turn
PASS [S08] bypass variant upper: "I HAVE CHEST PAIN AND I AM SWEATING" -> escalated
PASS [S08] bypass variant dblspace: "I have chest   pain and sweating" -> escalated
PASS [S08] bypass variant newline: "I have chest\npain and sweating" -> escalated
PASS [S08] bypass variant tab: "chest\tpain and sweat" -> escalated
PASS [S08] bypass variant hyphen: "chest-pain and sweating" -> escalated
PASS [S08] bypass variant zwsp: "chest​ pain and sweating" -> escalated
PASS [S08] bypass variant nbsp: "chest pain and sweating" -> escalated
PASS [S08] bypass variant fullwidth: "ｃｈｅｓｔ ｐａｉｎ and sweating" -> escalated
PASS [S08] bypass variant itNFD: "ho dolore al petto e sudóre" -> escalated
PASS [S08] bypass variant thaiTone: "เจ็บ หน้า อก มาก เหงื่อ ออก" -> escalated
PASS [S08] bypass variant emoji: "chest pain 😰 and sweating" -> escalated
PASS [S08] bypass variant typoPlural: "chest pains and sweating" -> escalated
PASS [S09] lang th: "เจ็บหน้าอกมาก เหงื่อออก" -> escalated
PASS [S09] lang th: "ฉันหายใจไม่ออก" -> escalated
PASS [S09] lang it: "ho un forte dolore al petto e sudo freddo" -> escalated
PASS [S09] lang it: "non riesco a respirare" -> escalated
PASS [S09] lang it: "voglio uccidermi" -> escalated
PASS [S09] lang th: "อยากฆ่าตัวตาย" -> escalated
PASS [S09] lang en: "my face is drooping and my arm is weak" -> escalated
PASS [S10] PII (EN) absent from turn response
PASS [S10b] PII (EN) absent from GET session+audit
FAIL [S10c] PII (EN) absent from list + metrics
       -> ["15/03/1985","Sukhumvit"]
PASS [S11] PII (TH) absent from turn response + session + audit
PASS [S12] PII (IT) absent from turn response + session + audit
PASS [S13] PII in reviewer id/newValue not echoed in session/audit
PASS [S14] PII in takeover reason not in audit
PASS [S15] approve without reviewer (empty) -> 400
PASS [S15b] approve without reviewerId key -> 400
PASS [S16] approve missing field (location) -> 400
   (setup) vague input status: collecting unsupported: []
   (skip S17: mock produced no unsupported field for vague input; w5/w6 unit tests cover this)
PASS [S18] red flag false_alarm without note -> 400
PASS [S18b] red flag false_alarm with blank note -> 400
PASS [S19] false_alarm with note -> 200; flag retained with review; session stays escalated (never deleted)
PASS [S19b] acknowledge after false_alarm replaces review but flag still present
PASS [S20] approving all fields on an escalated session does not set status approved
PASS [S20b] audit contains red_flag + review entries
   (setup) meds: [
  'med-b3a0238caa46f2473658871c:Augmentin/amoxicillin+clavulanic acid/supported'
] alerts: [ 'MR-ALLERGY-PEN-e62c6e960c7f5270c8bc7632:MR-ALLERGY-PEN:high' ] allergies: [ 'penicillin' ]
PASS [S21] pharmacy sign-off with open high alert -> 409
PASS [S21b] rejected sign-off leaves pharmacyStatus != reconciled and no pharmacy_review audit
PASS [S22] alert false_alarm without note -> 400
PASS [S23] ack high alert + complete -> 200 reconciled
PASS [S23b] alert is never deleted after review
PASS [S24] med edit dose:"" clears dose to null, keeps review.previous
PASS [S24b] med edit generic:"" is rejected (400)
PASS [S24c] med edit with no value -> 400
PASS [S24d] verify with correction fields -> 400
PASS [S25] allergy edit reaction:"" clears reaction
PASS [S26] duplicate medId actions in one request -> 400
PASS [S26b] unknown medId -> 400
PASS [S26c] empty pharmacy review (no actions, no complete) -> 400

SUMMARY 71/72 passed, 1 failed
exit=1

$ BASE=http://localhost:3000 node qa/04-state.mjs
PASS [T01] review on session without summary -> 400
PASS [T02] pharmacy-review on session without summary -> 400
PASS [T03] partial approve (1 of required) does not reach approved (was collecting, now awaiting_review)
PASS [T03b] review moved a collecting session to awaiting_review? (status after partial approve is a defined state)
PASS [T04] approve all supported required -> approved
PASS [T05] edit after approved -> 200 and status remains approved (all required still approved/edited)
PASS [T06] reject a required field after approved -> status leaves approved (re-opens review)
PASS [T06b] after re-open, turn accepted again (not approved => 200) or 409; never 5xx
PASS [T07] takeover on an APPROVED session is rejected (409) or at least keeps approval record (informational)
PASS [T08] takeover twice: 200 then 200/409; audit takeover count == number of 200s
PASS [T08b] takeover by second reviewer does not silently re-assign (informational: audit actorIds)
PASS [T09] review on taken_over keeps status taken_over
PASS [T09b] turn on taken_over -> 409
PASS [T10] takeover of escalated session retains red flags in summary
PASS [T10b] takeover keeps turns/complaint visible (UX audit: complaint lost)
PASS [T11] takeover on brand-new session -> 200 taken_over
PASS [T12] duplicate fieldKey actions in one review -> no 5xx; final state deterministic
PASS [T13] edit newValue >300 chars -> 400
PASS [T13b] edit blank newValue -> 400
PASS [T13c] 25 actions -> 400
PASS [T13d] unknown action prop -> 400
PASS [T13e] reviewerId >200 chars -> 400
PASS [T14] edit sets status edited, value in all 3 langs, evidence retained for audit/UI
PASS [T15] red flag action on session without that flag -> 400
PASS [T16] red-flag-only review: audit has red_flag_review, no empty review event
PASS [T16b] red_flag_review audit actor is clinician with actorId
PASS [T17] audit grows after each action
PASS [T17b] audit earlier entries unchanged (append-only)
PASS [T17c] audit timestamps non-decreasing
PASS [T17d] audit ids unique
PASS [T17e] audit has types session_created, turn_added, summary_generated, review, takeover
PASS [T17f] failed (400) review leaves audit unchanged
PASS [T18] pharmacy partial review -> pharmacyStatus in_review
PASS [T19] sign-off with no high alerts/unmatched meds -> reconciled
PASS [T20] pharmacy review after reconciled: documented behaviour (reopens to in_review?)
PASS [T21] pharmacy unknown top-level key -> 400
PASS [T21b] pharmacy medActions wrong type -> 400
PASS [T21c] pharmacy complete non-boolean -> 400
PASS [T22] metrics.byStatus == recount from /api/sessions
PASS [T22b] metrics.escalations == sessions with >=1 red flag
PASS [T22c] metrics.sessionsToday == sessions created today (UTC)
PASS [T22d] abstainRate == abstained/summaries
PASS [T22e] sum(byStatus) == sessions listed
PASS [T22f] autoCapturedRate in [0,1]; p50<=p95; medianReviewSeconds>=0
PASS [T22g] latency p50/p95 match recount from audit modelCalls
PASS [T23] metrics.provider honest in mock mode (name mock, hardware not claiming Instinct/ROCm)

SUMMARY 46/46 passed, 0 failed
exit=0

$ BASE=http://localhost:3000 node qa/05-metrics.mjs
PASS [M01] metrics.byStatus matches recount from /api/sessions (quiescent snapshot)

SUMMARY 1/1 passed, 0 failed
exit=0

$ BASE=http://localhost:3000 node qa/06-store-coherence.mjs
FAIL [K01] newly created session appears in GET /api/sessions
       -> {"listed":625}
PASS [K02] list reflects new turn (turns.length >= 2)
PASS [K03] list reflects takeover status
PASS [K04] metrics total == list length (same store in all routes)
PASS [K05] GET :id agrees with list on status

SUMMARY 4/5 passed, 1 failed
exit=1

$ BASE=http://localhost:3000 node qa/07-repros.mjs
PASS [R1] Thai full name (first + surname) fully redacted in stored turn
PASS [R1b] Thai "ชื่อ <first> <last>" with space fully redacted
PASS [R1c] English full name hyphenated surname redacted
PASS [R2] bare DOB "born 15/03/1985" redacted
PASS [R2b] street address redacted
PASS [R2c] DOB with "date of birth is" redacted
PASS [R2d] IT "nata il 15 marzo 1985" redacted
PASS [R2e] Bangkok landline "02 123 4567" redacted
PASS [R3] red-flag variant hyphen: "chest-pain and sweating" -> escalated
PASS [R3] red-flag variant zwsp: "chest​ pain and sweating" -> escalated
PASS [R3] red-flag variant fullwidth: "ｃｈｅｓｔ ｐａｉｎ and sweating" -> escalated
PASS [R3] red-flag variant thaiSpaced: "เจ็บ หน้า อก มาก เหงื่อ ออก" -> escalated
PASS [R3] red-flag variant thaiSpaced2: "ฉัน หายใจ ไม่ ออก" -> escalated
FAIL [R3] red-flag variant itApostrophe: "ho un dolore all'altezza del petto e sudo freddo" -> escalated
       -> ["collecting",[]]
PASS [R3] red-flag variant enContraction: "I can't breathe" -> escalated
PASS [R3] red-flag variant enCurly: "I can’t breathe" -> escalated
FAIL [R3] red-flag variant slang: "my chest is killing me, cold sweat" -> escalated
       -> ["collecting",[]]
FAIL [R4] negation (th) "ไม่เจ็บหน้าอก แต่ปวดหัวตั้งแต่เมื่อวาน" -> chest flag does not fire
       -> ["RF-CHEST-02"]
PASS [R4] negation (th) "ไม่มีอาการเจ็บหน้าอก ปวดหัว" -> chest flag does not fire
PASS [R4] negation (it) "senza dolore al petto, solo mal di testa" -> chest flag does not fire
PASS [R4] negation (it) "nessun dolore al petto" -> chest flag does not fire
PASS [R4] negation (th) "ไม่เจ็บหน้าอก แต่เหงื่อออกมาก เจ็บหน้าอกตอนนี้" -> chest flag fires
PASS [R5] approved session cannot be silently moved to taken_over
PASS [R6] invisible-only text rejected like blank
PASS [R7] metrics total sessions == queue (GET /api/sessions) length
FAIL [R8] documented `curl localhost:3000/api/demo/reset` (GET, docs/DEMO.md:11, README.md:63) works
       -> [405,""]

SUMMARY 22/26 passed, 4 failed
exit=1

$ BASE=http://localhost:3000 node qa/08-invariants.mjs
PASS [I-offsets] invariant offsets over 648 sessions
PASS [I-supportedNoEv] invariant supportedNoEv over 648 sessions
PASS [I-loc] invariant loc over 648 sessions
PASS [I-statusMismatch] invariant statusMismatch over 648 sessions
PASS [I-ids] invariant ids over 648 sessions
PASS [I-nq] invariant nq over 648 sessions
PASS [I-audit] invariant audit over 648 sessions
PASS [I-abstain] invariant abstain over 648 sessions
FAIL [I-unsupportedShown] invariant unsupportedShown over 648 sessions
       -> ["B-669 onset unsupported but has evidence","B-669 medications unsupported but has evidence","B-641 onset unsupported but has evidence","B-469 onset unsupported but has evidence","B-288 onset unsupported but has evidence","B-011 allergies unsupported but has evidence"]

SUMMARY 8/9 passed, 1 failed
exit=1

$ BASE=http://localhost:3000 node qa/09-http.mjs
PASS [H01] chunked 100KB body without Content-Length -> 413
PASS [H02] invalid UTF-8 body -> 400 ApiError
PASS [H03] JSON with BOM -> 400 ApiError or 201 (never 5xx)
PASS [H04] duplicate keys -> no 5xx
PASS [H05] __proto__ key rejected (400) and no prototype pollution
PASS [H06] patientLang uppercase -> 400
PASS [H07] deeply nested JSON -> 400 ApiError (not 500)
PASS [H08] GET /api/sessions/ (trailing slash) -> 200 or 308 redirect to /api/sessions
PASS [H09] GET /api/sessions?x=1 -> 200
PASS [H10] HEAD /api/sessions -> 200/204/405 (no 5xx)
PASS [H11] unknown /api route -> 404 (informational: body shape)

SUMMARY 11/11 passed, 0 failed
exit=0

$ BASE=http://localhost:3000 node qa/10-lang.mjs
PASS [L01] assistant question for th session is in th: "มีโอกาสตั้งครรภ์ไหม"
PASS [L01] assistant question for it session is in it: "Potrebbe essere incinta?"
PASS [L01] assistant question for en session is in en: "Could you be pregnant?"
PASS [L02] th: escalation patientMessage present in th and nextQuestion null
PASS [L02] it: escalation patientMessage present in it and nextQuestion null
PASS [L02] en: escalation patientMessage present in en and nextQuestion null
PASS [L03] th session: assistant reply still Thai even if patient typed English
PASS [L04] patient turn lang == session lang

SUMMARY 8/8 passed, 0 failed
exit=0

$ BASE=http://localhost:3000 node qa/11-review-memory.mjs
PASS [V00] setup review accepted
PASS [V01] edited value survives later patient turn
PASS [V02] approved value survives later patient turn
PASS [V03] reject -> field missing
PASS [V04] rejected value does not silently come back as supported on unrelated turn
   (setup) allergies: supported no known allergies
PASS [V05] approved "no allergies" + later "allergic to penicillin": conflict surfaced (not silently kept approved)
PASS [V05b] penicillin allergy appears in summary.allergies list for pharmacist
PASS [V05c] status returned to awaiting_review (clinician must re-confirm)

SUMMARY 8/8 passed, 0 failed
exit=0

$ BASE=http://localhost:3000 node qa/12-allergy-negation.mjs
PASS [A01] en: "I am not allergic to penicillin. I take Augmentin 625 mg twi" -> penicillin allergy entry ABSENT and allergy_conflict alert ABSENT
PASS [A01] en: "No allergy to penicillin, I take Augmentin. Sore throat sinc" -> penicillin allergy entry ABSENT and allergy_conflict alert ABSENT
PASS [A01] en: "I have never been allergic to penicillin. I take amoxicillin" -> penicillin allergy entry ABSENT and allergy_conflict alert ABSENT
PASS [A01] it: "Non sono allergico alla penicillina. Prendo Augmentin. Ho ma" -> penicillin allergy entry ABSENT and allergy_conflict alert ABSENT
PASS [A01] th: "ไม่แพ้เพนิซิลลิน กินออกเมนตินวันละสองครั้ง เจ็บคอตั้งแต่เมื่" -> penicillin allergy entry ABSENT and allergy_conflict alert ABSENT
PASS [A01] en: "I am allergic to penicillin. I take Augmentin 625 mg twice a" -> penicillin allergy entry PRESENT and allergy_conflict alert PRESENT
PASS [A01] it: "Sono allergico alla penicillina. Prendo Augmentin. Ho mal di" -> penicillin allergy entry PRESENT and allergy_conflict alert PRESENT
PASS [A01] th: "แพ้เพนิซิลลิน กินออกเมนตินวันละสองครั้ง เจ็บคอตั้งแต่เมื่อวา" -> penicillin allergy entry PRESENT and allergy_conflict alert PRESENT

SUMMARY 8/8 passed, 0 failed
exit=0

$ BASE=http://localhost:3000 node qa/13-med-negation.mjs
PASS [N01] en: "I do not take warfarin. I take ibuprofen 400 mg. Knee p" -> warfarin NOT listed as current med, no MR-INT alert
PASS [N01] en: "I never take ibuprofen, only paracetamol. Knee pain sin" -> ibuprofen NOT listed as current med, no MR-INT alert
PASS [N01] en: "I stopped taking warfarin last year. I take ibuprofen. " -> warfarin NOT listed as current med, no MR-INT alert
PASS [N01] it: "Non prendo warfarin. Prendo ibuprofene. Dolore al ginoc" -> warfarin NOT listed as current med, no MR-INT alert
PASS [N01] th: "ไม่ได้กินวาร์ฟาริน กินไอบูโพรเฟน ปวดเข่ามาตั้งแต่เมื่อว" -> warfarin NOT listed as current med, no MR-INT alert

SUMMARY 5/5 passed, 0 failed
exit=0

$ BASE=http://localhost:3000 node qa/14-meds-field.mjs
PASS [F01] en: medications stated (1 in pharmacist list) -> summary field medications is supported (was supported); next question != medications
PASS [F01] it: medications stated (1 in pharmacist list) -> summary field medications is supported (was supported); next question != medications
PASS [F01] th: medications stated (1 in pharmacist list) -> summary field medications is supported (was supported); next question != medications

SUMMARY 3/3 passed, 0 failed
exit=0
```

## EVIDENCE

Regression tests cover name/surname privacy through stored sessions and audit, zero-model-call red-flag escalation, normalized evidence offsets, provider negation omissions, stopped-drug timing and alerts, approved takeover audit immutability, queue/metric visibility, contextual DOB/address redaction, missing medication fields on both provider paths, invisible input and code capacity. No screenshots are needed for backend-only changes.

Validation artifacts: `/private/tmp/medx-w9-{vitest,tsc,eslint,build,eval}.log`; full live QA outputs: `/private/tmp/medx-w9-qa-after/*.log`. Evaluation writes are confined to the isolated copy; repository eval files are untouched. Isolated eval warns that .git is absent, so its provenance SHA is unavailable.

## ASSUMPTIONS

Synthetic inputs only. Existing reviewed pharmacy history remains part of clinician decision support; automatic extraction never deletes a clinician review. Stopped medicines are excluded without a 48-hour exception, as requested. Empty sessions keep their existing visibility rule.

## RISKS

Heuristic redaction/extraction is bounded and intentionally narrow; this remains a research prototype requiring clinician review. Existing stored synthetic sessions from before the fixes are not migrated. Old DOB/address strings can therefore still cause QA's whole-store list scan to fail even though fresh turn/session/audit checks pass. The full QA scripts also contain checks for behavior outside this assignment.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS

All assigned reproductions pass. Eight residual QA assertions remain:

| Script/check | Count | Finding and handoff |
|---|---:|---|
| 02 / E10b | 1 | Identical nonanswers repeat the pregnancy question within the existing three-follow-up budget. W7 labels this a non-bug; bounded follow-up UX was not one of the assigned P2 fixes. |
| 03 / S10c | 1 | Whole-store list scan finds DOB/address strings in pre-fix synthetic sessions. Fresh response, GET-session/audit, Thai and Italian privacy checks pass. Existing store/audit was preserved; no reset or migration was performed. |
| 06 / K01 | 1 | Test expects an empty newly created session in the queue. This contradicts the explicitly chosen visibility contract: hide empty starts in both queue and metrics. QA owner should update the assertion. |
| 07 / R3 | 2 | Italian lay phrasing and English slang are outside the supplied dictionary; W7 explicitly excludes these from the spelling/spacing bug. Clinical owner may add phrases after review. A mock model is not an oracle for uncatalogued clinical paraphrases. |
| 07 / R4 | 1 | Bare Thai negation `ไม่เจ็บหน้าอก` is absent from the clinical negation cue list. Changing shared clinical cues is outside ownership; Doctor/orchestrator review is needed. |
| 07 / R8 | 1 | Documentation still uses GET reset, which safely returns 405. Documentation owner should replace it with the existing guarded POST/token command, rather than enabling destructive GET. |
| 08 / I-unsupportedShown | 1 | This scans 648 sessions and treats any evidence retained on an unsupported field as failure. Examples include the deliberate abstain seed B-011 and abstained QA turns. Evidence retained for review is not a supported factual assertion; the W7 report already identifies this check as a non-bug. QA should assert status/rendering instead. |

No shared contract/schema changes are required for the implemented fixes.

## NEXT ACTION

Hand off the uncommitted 20-file diff. QA/documentation/clinical owners can reconcile the eight residual assertions above; use the guarded synthetic reset separately when an old-store-free demo is desired.

