# W14 clinical safety review: consult assistant, vitals and triage, orders and prescribing, mascot

Reviewer: clinical-safety reviewer (independent, read-only). Scope: the features added since `w9-clinical-safety-review.md`. Repo HEAD is `710b9b9`. Line numbers refer to that HEAD. The working tree also had uncommitted deck edits by another agent.

Method:
- Read the code and the specs.
- Ran `node docs/clinical/check-{consultrules,vitalrules,medrules,redflags}.mjs`. All pass: 50, 13+coverage, 204 and 175.
- Ran live probes against `http://localhost:3000` (mock provider). Every probe created a new session; nothing was reset. Probe scripts are in the session scratchpad (`probe1.py` to `probe4.py`).
- Ran one in-process vitest probe of `modelSuggestions` (see the process note at the end).

STATUS: done

## Verdict: **CONDITIONAL_PASS**

The core framing holds:
- **No path turns an AI suggestion into an order or a triage level without a clinician click.**
  - Workup chips only pre-fill a picker. A separate "Order X" click is needed (`app/(orders)/review/[id]/orders/_orders.tsx:95,145`).
  - Medication orders are typed by the doctor. No model is involved (`lib/pipeline/orders.ts:70-83`).
  - Triage is stored only by `confirmTriage` (`lib/pipeline/vitals.ts:27-37`). The engine output is labelled "Suggestion for nurse confirmation".
- "Consider" items are doctor-only at both server and UI level:
  - server: `mode: ['doctor']`, `consult.ts:73,94`
  - UI: `_guard.ts:11-12`
  - Probe: nurse mode returned only `rule_out` and `ask_next`.
  - Nothing from the consult record goes to the patient UI.
- Server-side enforcement:
  - High alerts block submit without an override (`orders.ts:107`; probe 409).
  - Pharmacist verify re-checks that every high alert has an override (`orders.ts:112`).
  - Checks are recomputed at submit and at verify (`orders.ts:97`).
  - Patient-reported "stopped" medicines are still checked (MF-2 from w9 holds, `medrules.ts:31,44-50`).
- Fin is placed within DIRECTION §11:
  - web landing hero and empty queue only
  - mobile home, voice listening, sending and done (hidden on `needs_human`)
  - deck slides 1 and 10 only
  - never on a red flag, an alert or clinical content

Submission is blocked until the must-fixes below are done:
- The model "consider" path can emit drug names and doses.
- AI considerations, including dismissed ones, are written into the signed note.
- Failed writes show as success.
- Triage does not prompt re-confirmation when vitals worsen, and a partial re-entry lowers the suggestion.
- Dose and allergy checks pass silently in common cases.
- The ambient-recording consent and wording are inadequate.
- The public safety docs do not describe the new features.

## MUST-FIX before submission

### MF-1 The model "consider" gate accepts drug names, doses and routes (P0, breaks DECISIONS 2026-10-17 18:50)
- **Where:** `apps/web/lib/pipeline/consult.ts:78` (forbidden list) and `:83-86` (accepts `kind: 'consider'` from the model). The forbidden regex has no dose, drug or route terms.
- **Probe:** `modelSuggestions()` with a verified patient quote accepted every one of these:
  - `"Consider aspirin 300 mg for clinician review"`
  - `"Consider morphine 5 mg IV for clinician review"`
  - `"Consider giving aspirin for clinician review"`
  - `"Consider nitroglycerin spray for clinician review"`
- **Why it matters:** with a real model this puts AI drug and dose text in front of the doctor and into the note. That is "treatment as medical advice", which Track 2 forbids.
- **Fix (smallest safe change):** stop accepting model considerations. Rule considerations are curated, and `check-consultrules.mjs` checks them for doses. Replace `:86` with:
  ```ts
  if (x.kind === 'consider') continue; // model never names conditions/drugs; considerations come only from consultrules.json
  ```
  - Update `CONSULT-SPEC.md` §3: the "Model suggestions" row becomes "`ask_next` only, both modes".
  - Also add a dose and route reject for `ask_next` to `forbidden`:
    ```ts
    |\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|μg|g|ml|units?|iu)\b|\b(?:iv|im|sc|po|bolus|infusion)\b
    ```
  - Add the four strings above as a regression test (expect rejected).

### MF-2 AI considerations stay in the signed note, including dismissed ones, although the UI says "Dropped at signing unless kept" (P0)
- **Where:**
  - Draft: `consult.ts:237-238` adds every `consider` suggestion whatever its status.
  - Sign: `consult.ts:257-267` never removes unkept consideration lines.
  - UI promise: `app/(clinician)/review/[id]/consult/_c18n.ts:73` and `_consult.tsx:404`.
  - The keep checkbox: `_consult.tsx:440-444,460`. It only sends kept lines as edits.
- **Probe 1:**
  1. Fever and sore throat.
  2. The doctor **dismissed** "Consider sepsis".
  3. Draft, then sign with nothing kept.
  4. Result: the signed note contains all 6 `considerations` lines with status `supported`, including the dismissed one.
- **Why it matters:** the signed clinical record carries an AI-generated differential the doctor never adopted. This is the "AI diagnosis in the record" failure the spec was written to prevent (§1, §6).
- **Fix:**
  - Draft (`:238`):
    ```ts
    if (x.kind === 'consider' && mode === 'doctor' && x.status !== 'dismissed') add(...)
    ```
  - Sign, after the edits loop (`:265`):
    ```ts
    note.lines = note.lines.filter(l => l.section !== 'considerations' || ids.has(l.id));
    for (const l of note.lines) if (l.section === 'considerations') l.status = 'clinician';
    ```
    The UI already sends kept lines as edits (`_consult.tsx:460`). Add `keptConsiderationIds` to the `consult_note_signed` audit payload (`:267`).

### MF-3 Failed clinical writes are shown as success (P0)
- **Consult sign**, `_consult.tsx:136-141`:
  - Any non-2xx (409 "Every red flag requires clinician review before signing", 409 "already signed", 400) or a network error sets fixture mode **and** `setSignedFx(...)`.
  - The doctor then sees "Note signed", with name and time, although the server refused.
  - Realistic trigger: the patient mentions chest pain in the room after the last 4 s poll. The server blocks the signature; the UI says it is signed. The error goes to `loadError`, which is only shown while `!session`, so it is never visible.
- **Orders, vitals and triage**, `app/(orders)/_lib.ts:122-132` (`call`):
  - On a POST, 404, 405, 5xx or a network error falls back to fixture data.
  - The doctor's card then reads "Submitted, waiting for pharmacist" (or "Triage confirmed by …") while nothing was saved and the pharmacist never receives it. Only a small "fixture" badge in the header shows this.
- **Fix:**
  - `_consult.tsx:138-141`:
    ```ts
    catch (e) { if (fixture && action === 'sign') setSignedFx(...); else setNoteError((e as Error).message); }
    ```
    Do not switch to fixture there. Render `noteError` as `role="alert"` next to the Sign button.
  - `_lib.ts` `call`: only reads may fall back. Writes throw:
    ```ts
    if (body !== undefined) throw new Error(json?.error ?? `Request failed (${res.status})`);
    ```
    Put this before the fixture branch, and also in the network `catch`.

### MF-4 Worsening vitals after a confirmed triage do not prompt re-confirmation (P0)
- **Where:**
  - `lib/pipeline/triage.ts:34` keeps the old `confirmed`.
  - `app/(orders)/review/[id]/vitals/_vitals.tsx:182-203` hides the confirm control for good once `triage.confirmed` exists.
- **Probe:**
  1. Normal set: suggestion 4, nurse confirmed 4.
  2. New set: HR 130, SBP 88, RR 28, T 39.2, SpO2 89, new confusion.
  3. Result: suggestion 2 (NEWS2 16), but `confirmed.level` is still 4.
  4. The UI shows "Suggested triage level 2" above a green "Triage confirmed … Level 4" receipt, with no way to re-confirm and no warning.
- **Fix (UI only; `confirmTriage` already re-confirms and the audit keeps the history):**
  - Show the confirm form when:
    ```ts
    !triage.confirmed || triage.suggestedLevel < triage.confirmed.level
    ```
  - Show a signal-tone notice above it:
    - en "Vitals now suggest level {n}, more urgent than the confirmed level {m}. Re-confirm triage."
    - th "สัญญาณชีพล่าสุดเสนอระดับ {n} ซึ่งเร่งด่วนกว่าระดับที่ยืนยันไว้ {m} กรุณายืนยันระดับคัดกรองอีกครั้ง"
    - it "I parametri ora suggeriscono il livello {n}, più urgente del livello confermato {m}. Riconfermare il triage."

### MF-5 A partial vitals entry erases earlier abnormal readings from the suggestion (P0, false reassurance on incomplete vitals)
- **Where:** `lib/pipeline/triage.ts:9`. The default `v = s.vitals?.at(-1)` scores only the latest entry.
- **Probe:**
  1. A full set scoring NEWS2 16 gives level 2.
  2. The nurse then records only `{ tempC: 37.5 }`.
  3. Result: suggestion **3**, "partial score from 2 of 7".
  4. The SpO2 of 89, SBP of 88 and confusion recorded minutes earlier no longer count.
- The "incomplete vitals only raise urgency" fix in `1ac50b4` does not cover this.
- **Fix:** score the latest value of each parameter across sets:
  ```ts
  v = Object.assign({}, ...(s.vitals || []).map(({ id, at, recordedBy, ...x }) => x))
  ```
  - Add the reason "Some values carried forward from an earlier set".
  - ponytail: no staleness window. Add a 60-minute window when real use needs it.

### MF-6 Dose checks pass silently for unparsed doses and for drugs without a ceiling (P0)
- **Where:**
  - `lib/pipeline/orders.ts:9-17`: the parser only accepts `^N mg|g|mcg$` and a short set of frequency forms.
  - `:30`: `if (drug?.doseRange && order.doseMg !== undefined)`.
  - `packages/shared/src/medrules.json`: 28 known drugs have no `doseRange`, including **methotrexate, warfarin, insulin, prednisolone, gliclazide, co-trimoxazole and rivaroxaban**.
- **Probe (each in a new session):**

| Order | Checks |
|---|---|
| `methotrexate 10 mg daily` | **0** |
| `warfarin 50 mg daily` | **0** |
| `ibuprofen "800 mg x2" tid` | `doseMg` unparsed, **0** |
| `paracetamol 1000 mg "every 4-6 hours prn"` | `timesPerDay` unparsed, **0** |
| `insulin "100 units" tid` | **0** |

- The doctor and the pharmacist see only "No rule fired" (`_lib.ts:88`).
- **Fix:** add one moderate alert. It is visible and needs no override.
  - Raise it when the drug is known and any of these is true:
    - it has no `doseRange`
    - `doseMg === undefined`
    - `maxDailyMg` is set but `timesPerDay === undefined`
  - Code, in `prescribingChecks` after `:49`:
    ```ts
    if (drug && (!drug.doseRange || order.doseMg === undefined || (drug.doseRange.maxDailyMg !== undefined && order.timesPerDay === undefined)))
      checks.push({ id: stableId('MR-DOSE-UNCHECKED', [order.id]), ruleId: 'MR-DOSE-UNCHECKED', kind: 'dose_range', severity: 'moderate',
        message: { en: 'Dose not checked against a usual range — check dose, frequency and units.', th: 'ยังไม่ได้ตรวจขนาดยาเทียบช่วงปกติ — โปรดตรวจขนาดยา ความถี่ และหน่วย', it: "Dose non verificata rispetto all'intervallo abituale: controllare dose, frequenza e unità." },
        action: MEDRULES.messages.dose_range.action, medIds: [order.id], allergyIds: [], evidence: [], source: `medrules ${MEDRULES.version}` });
    ```
  - Update CONSULT-SPEC §11, which still says "no dose alert".

### MF-7 Prescribing treats an unrecorded allergy status as "no allergies" (P0, contradicts SAFETY.md "missing is not negative")
- **Where:** `lib/pipeline/orders.ts:28` passes `s.summary?.allergies || []`. Nothing flags that allergy status is unknown.
- **Probe:** amoxicillin 1 g tid on a session where allergies were never asked gave **0 checks**. With "allergic to penicillin" recorded, it gave `allergy_conflict` high, as expected.
- **Fix:** in `prescribingChecks`, add a moderate alert when both of these hold:
  - the `allergies` field is not `supported`, `approved` or `edited`
  - `noKnownAllergiesEvidence` is empty

  Wording:
  - en "Allergy status not recorded — ask before prescribing."
  - th "ยังไม่ได้บันทึกประวัติแพ้ยา — สอบถามก่อนสั่งยา"
  - it "Allergie non registrate: chiedere prima di prescrivere."

  The same applies to an unknown pregnancy status (see SF-11).

### MF-8 The server accepts a meaningless override reason (P1)
- **Where:**
  - `lib/pipeline/orders.ts:93` (`text(value.reason, 'override reason')`) only needs one non-space character.
  - The UI asks for 5 or more characters (`_meds.tsx:85`).
  - The deck says "a high alert needs a written reason".
- **Probe:** an override reason `"."` was accepted, submitted, and then verified by the pharmacist.
- **Fix:** after `:93`:
  ```ts
  if (reason.replace(/[\s\p{P}]/gu, '').length < 5) invalid('Override reason must explain the decision');
  ```

### MF-9 The pharmacist's English "not a complete check" disclaimer is a literal placeholder (P1)
- **Where:** `app/(pharmacy)/_orders.tsx:20`. The English argument is the string `"{OL.noAlerts[lang]}"`, so an English pharmacist sees that text on every order with no alerts.
- **Replacement (en):** `"No rule alerts for this order. This is not a complete prescribing check."`

### MF-10 Ambient consult recording: vendor wording is incomplete and there is no consent step (P1, Track 2 "sensitive information")
- **Where:**
  - `app/(clinician)/review/[id]/consult/_c18n.ts:25`: "Speech is processed by your browser's speech service."
  - The mic starts listening continuously with no consent step (`_consult.tsx:216-225`, `_speech.ts:41,52`).
  - In Chrome and Edge, Web Speech audio is streamed to the vendor's cloud. The room audio includes the patient.
- **Replacement wording:**
  - en: "Listening sends the room audio to your browser's cloud speech service (Google in Chrome, Microsoft in Edge, Apple in Safari). Get the patient's agreement first. Synthetic demo only."
  - th: "การฟังจะส่งเสียงในห้องไปยังบริการรู้จำเสียงบนคลาวด์ของเบราว์เซอร์ (Google ใน Chrome, Microsoft ใน Edge, Apple ใน Safari) ขอความยินยอมจากผู้ป่วยก่อน ใช้กับข้อมูลสาธิตสังเคราะห์เท่านั้น"
  - it: "L'ascolto invia l'audio della stanza al servizio vocale cloud del browser (Google in Chrome, Microsoft in Edge, Apple in Safari). Chiedere prima il consenso del paziente. Solo dimostrazione con dati sintetici."
- **Logic:** disable the mic until a checkbox is ticked. Store the tick in component state; it does not need to persist.
  - en "Patient agreed to the conversation being transcribed"
  - th "ผู้ป่วยยินยอมให้ถอดความบทสนทนา"
  - it "Il paziente ha acconsentito alla trascrizione"

  Typing remains available without it.

### MF-11 The public safety docs do not describe the new features (P1, Track 2 rule)
- **Where:**
  - `pitch/SAFETY.md` and `pitch/SUBMISSION.md:21,31,35-44` describe intake and reconciliation only.
  - `README.md` and `pitch/VIDEO-SCRIPT.md` have no consult assistant, vitals and triage, or orders.
  - `SUBMISSION.md:44` "it does not diagnose, triage, treat or prescribe" is now ambiguous, because clinicians triage and prescribe **inside** MedX.
  - `SAFETY.md:17` covers phone speech only.
  - The working-tree deck has a "LIMITATIONS MARKER" on slide 7.
- **Fix:**
  - Replace the Limitations paragraph in SUBMISSION, README and the deck marker with the paragraph at the end of this report.
  - Add to SAFETY.md:
    - **High-risk decisions:**
      - The triage level is a NEWS2-based suggestion that the nurse confirms (`vitals.ts`, `triage.ts`).
      - The AI never proposes drugs or doses.
      - Orders and prescriptions are entered by the doctor.
      - Deterministic prescribing checks require a written override reason for high alerts (`orders.ts`).
      - A pharmacist verifies or returns each order.
    - **Incorrect responses:** consult "consider" items come only from a fixed rule bank, doctor-only, labelled "not a diagnosis", and dropped from the signed note unless kept.
    - **Sensitive information:** consult listening uses the browser's cloud speech service, after patient agreement.
  - Clinic-side speech must be added to "What we do not claim".

## SHOULD-FIX

| # | Finding (file:line) | Suggested change |
|---|---|---|
| SF-1 | Dismissed or asked-but-unanswered `rule_out` questions disappear from the note. `consult.ts:239` keeps only `status === 'open'`. CONSULT-SPEC §5 asks for "Not asked: …". | Include `rule_out` with status `dismissed` as "Not asked: …" and `asked` as "Asked, no answer recorded: …" in `open_questions`. |
| SF-2 | Signing is not blocked by unresolved `unsupported` lines, against CONSULT-SPEC §6. Probe: signed with the `unsupported` "Not yet asked" line present. | Block signing on `unsupported` lines outside `open_questions` (server `consult.ts:252`, UI `blockedReason`), or amend the spec. |
| SF-3 | Red-flag note lines can be fully rewritten (`consult.ts:261-264`; Edit button on every line, `_consult.tsx:446`). The spec says annotate only. | For `flag:` lines, append `" — clinician note: …"` and keep the original text. |
| SF-4 | `reviewConsultSuggestion` returns **doctor-mode** state, with considerations, to any caller acting on a `consider` id (`consult.ts:191`). Probe confirmed. | Take the caller's `mode` in the request body and return that. |
| SF-5 | The patient device polls `GET /api/sessions/:id` (`app/api/sessions/[id]/route.ts:8-13`). The response carries the full session and audit: orders, override reasons, vitals, triage, clinician consult speech, and `fromSuggestionId` ids such as `consider:CR-CHEST-01:…`. A red flag raised by in-room consult speech flips the patient's phone to the "/redflag go to the desk" screen while they are with staff (probe 4; `apps/mobile/src/app/done.tsx` tick). | Add a patient-scoped projection that returns status, code, patient turns and next question only. Decide and document the consult-origin escalation; the suggestion is to keep the phone on "done" when escalation came from a consult turn. |
| SF-6 | NEWS2 is applied with no age or pregnancy guard (`triage.ts`). CONSULT-SPEC §9 limits it to adults 16+ and excludes pregnancy. | Add the reason "NEWS2 is not validated under 16 or in pregnancy — use clinical judgement" when age < 16 or pregnancy is possible or pregnant. |
| SF-7 | `onOxygen` is always sent as an explicit `false` from an unchecked box (`_vitals.tsx:87,134`), so the "assumed room air" reason never shows. | Use a tri-state (Room air / On O2 / Not recorded), or require a choice before Save. |
| SF-8 | The level scale says 1–5 (`(orders)/_lib.ts:37`), but the engine never outputs 5 and `confirmTriage` accepts 5 (`vitals.ts:30`). | Align the scale to 1–4, or document level 5 as a nurse-only choice. |
| SF-9 | Wording: (a) "Consider for clinician review: Consider sepsis" doubles the prefix (`consult.ts:73`); (b) "probability rises with…" (`consultrules.json:140`), which CONSULT-SPEC §1 bans; (c) "…needs a blood count" (`:1781`) reads as an instruction; (d) the "Rule out" badge (`_c18n.ts:32`) reads as a diagnostic act; (e) the "considered, not ordered" chip (`(orders)/_lib.ts:67`) suggests the doctor considered it. | (a) `For clinician review — ${c.text.en}`; (b) "more concerning with exertional pain, sweating, radiation or risk factors"; (c) "a blood count is worth considering"; (d) "Don't miss" / "อย่าพลาด" / "Da non perdere"; (e) "suggested, not ordered" / "ข้อเสนอแนะ ยังไม่ได้สั่ง" / "suggerito, non ordinato". |
| SF-10 | Methotrexate daily vs weekly is the classic fatal error, and no rule exists. | Add a high alert when methotrexate `timesPerDay >= 1`: "Methotrexate is usually once weekly — confirm frequency". |
| SF-11 | Pregnancy status unknown at prescribing gives no alert. `pregnancy_caution` fires only on pregnant or possible (`medrules.ts:59`). | Add a moderate "Pregnancy status not recorded" alert for drugs with a `pregnancy` flag when the field is missing. |
| SF-12 | Audit gaps: cancel is logged as `order_drafted` (`orders.ts:102`); a speech-matched "asked" has no actor (`consult.ts:174`); kept considerations are not recorded at signing. | Add an `order_cancelled` type; pass the clinician id from the consult turn; see MF-2. |
| SF-13 | Spec drift: CONSULT-SPEC §11 names MR-DOSE-01/02, but the code emits a single `MR-DOSE-RANGE` (`orders.ts:37`). | Sync the spec, and add MR-DOSE-UNCHECKED (MF-6). |
| SF-14 | Mascot: on `done.tsx:67` the happy Fin shows when the status is `escalated` until the next poll redirects. Deck slides 1 and 10 say "MedX/Fin hears what others miss", an unmeasured detection claim (rules catch 7/10). | Use `!human && session.status !== 'escalated'`. Change the deck line to "Fin listens closely. The people decide." |
| SF-15 | SUBMISSION says "1,119 automated tests"; the deck says 1,382. | Use one dated figure with its command. |

## Checks that passed (evidence)
- **Considerations stay out of nurse mode and the patient app.**
  - Server mode filter: `consult.ts:73,135-139`.
  - UI guard: `_guard.ts:4-12`.
  - The orders page loads considerations from `?mode=doctor` only (`_orders.tsx:30`).
  - The consult record is not in the session payload. The `fromSuggestionId` leak is SF-5.
- **Model suggestions are suppressed after escalation or abstain** (`consult.ts:106,125`).
- **Red flags stay first:** they rank at 0 (`:131`) and signing is blocked until flags are reviewed (`:252`).
- **Clinician speech is never used as evidence** (`consult.ts:35-44`; prompt `prompts.ts:36,40`).
- **A provider failure in consult abstains** (`consult.ts:118-121`).
- **Triage:**
  - Incomplete vitals never yield level 4 (`triage.ts:30`).
  - The most-urgent rule is applied (`:27`).
  - A less-urgent confirmation needs a note on both server and UI (`vitals.ts:34`, `_vitals.tsx:103`).
  - Every confirmation is audited with the suggested level (`vitals.ts:36`).
- **Orders:**
  - Unknown drug → `unknown_medication` (probe `xyzzumab`).
  - Allergy conflict fires when an allergy is recorded (probe).
  - Submit without overrides → 409.
  - A returned order clears the old overrides on edit (`orders.ts:78`).
  - Pharmacist "return" needs a note (`orders.ts:88`).
- **Audit coverage:** every write path appends an event: `vitals_recorded`, `triage_confirmed`, `order_drafted`, `order_submitted`, `order_pharmacy_action`, `consult_turn`, `consult_suggestion`, `consult_note_signed`.

## Limitations & safety (replacement paragraph, 119 words; assumes MF-1 to MF-10 are applied)

> Research prototype that supports clinicians; the AI never diagnoses, orders, prescribes or confirms triage. Synthetic data only; not clinically validated, not a medical device. Red-flag rules run before any model and cannot be cleared by it, but miss paraphrases (7/10 emergencies on an 18-case synthetic holdout). The consult assistant's doctor-only "consider" items come from a fixed 12-presentation list, not a complete differential. The NEWS2 triage level is a suggestion for adults (not pregnancy); the nurse confirms. Prescribing checks use a small rule set (59 drugs, 18 interactions, adult dose ceilings for 31) and miss what it lacks. Speech goes to the browser's or phone's cloud speech service. Redaction is imperfect; reviewer identity is self-declared; Gemma-on-AMD is unmeasured (mock model).

## Process note (reviewer's own error)
To probe `modelSuggestions` I briefly copied a throwaway test to `apps/web/lib/pipeline/__tests__/zzprobe/gate.test.ts`. A concurrent agent's commit `710b9b9`, made in the same second, swept that file into the repo. I deleted it from the working tree right away, so `git status` shows ` D apps/web/lib/pipeline/__tests__/zzprobe/gate.test.ts`.
- **Action for the orchestrator:** commit that deletion. The file is a probe with absolute paths and is not a product test.
- I made no other change outside this report.
