# W6 engine review: independent read-only review of the Codex backend

Reviewer: Claude (independent, read-only). Scope: `apps/web/lib/pipeline/**`, `apps/web/app/api/**`. Repo HEAD `a114a97`.
STATUS: done · No product file was modified. Throwaway probes live only in `/tmp/medx-probe/p1–p6.ts` (run with `npx vite-node` from `apps/web`).

TESTS RUN: `cd apps/web && npx vitest run` gave **10 files, 722 tests, all passed** (18.2 s). Every finding below is a gap that the suite does not cover.

## Findings (most severe first)

Format: `file:line`, then severity, problem, concrete fix, and how it was confirmed.

1. **`lib/pipeline/redact.ts:30` (with `pipeline.ts:55,65`), P0. Thai name redaction deletes red-flag text before the deterministic check.** `(?:ดิฉันชื่อ|ฉันชื่อ|ผมชื่อ|ชื่อ)\s*[\p{Script=Thai}]+(?:\s+[\p{Script=Thai}]+)?` greedily eats the unspaced Thai run, plus one more spaced run. Red flags then run on the redacted text, and the raw text is discarded, so the model never sees it either. Results:
   - `ผมชื่อสมชาย เจ็บหน้าอกมาก เหงื่อออก` becomes `[NAME_1] เหงื่อออก`. CHEST-01/02 are lost.
   - `ดิฉันชื่อมาลี หายใจไม่ออก` becomes `[NAME_1]`. BREATH-01 is lost.
   - Bare `ชื่อ` also eats clinical text: `จำชื่อยาไม่ได้ ยาละลายลิ่มเลือด` becomes `จำ[NAME_1]`, and the anticoagulant mention is gone.
   - The Latin trigger has the same failure: `Sono Svenuto stamattina` becomes `[NAME_1] stamattina`, and SYNC-01 is lost.

   **Fix:** run `checkRedFlags` on the NFC raw text in memory before redaction (never persist it) and union the hits with the redacted-text pass. Re-anchor the evidence of any hit found only in the raw text to the redacted turn. Also drop the bare `ชื่อ` trigger and cap the Thai name to one run of ≤ 15 chars that stops at whitespace. Add these four strings as regression tests.
   *Confirmed:* probe p1.

2. **`lib/pipeline/verify.ts:61-76` (also `pharmacyExtraction.ts:91`), P0. The tolerant matcher verifies quotes whose negation was added or dropped.** The bag-of-words overlap is ≥ 0.8 and the window is allowed to grow by up to 2 words. As a result:
   - `"I am not allergic to penicillin"` verifies against `I am allergic to penicillin` (matchFactor 0.8).
   - `"I take warfarin every day"` verifies against `I do not take warfarin every day`.
   - `"Non ho dolore al petto"` verifies against `Ho dolore al petto`.

   End to end with a fake client (patient: "I am allergic to penicillin"), the model returns allergies = "no known allergies" with that fabricated quote. The result is `allergies: supported, 0.72, "no known allergies"`, and `noKnownAllergiesEvidence` is set. A denied drug allergy is shown as a verified fact and can be approved in one click. This breaks invariant 2.
   **Fix:** in the tolerant branch, reject the match when the symmetric difference between quote tokens and window tokens contains a negation token (`no not n't never without non nessun niente senza ไม่ ไม่มี ไม่ได้ ไม่เคย`). Apply the same check to the exact and normalised branches when the 3 tokens before the match contain a cue the quote lacks. Do not allow the tolerant tier for `allergies`, `medications`, `pregnancy_status` or `noKnownAllergies` at all.
   *Confirmed:* probes p2 (B) and p3 (G).

3. **`lib/pipeline/redflags.ts:39`, P1. Cross-turn negation leak downgrades an emergency to urgent.** Turns are joined with `\n`, but `normalise()` turns `\n` into a space, so `clause()` never sees the turn boundary. For turns `["I am sweating a lot", "no", "chest pain"]` (a bare "no" answer, then a symptom), the joined domain reads `…no chest pain`, which is negated. Only RF-CHEST-02 (urgent) fires; the same text in one turn fires RF-CHEST-01 (emergency). This is a rule-severity downgrade.
   **Fix:** join with `'.\n'` (any character `clause()` cuts on that survives normalisation), or make `normalise` keep `\n` as a boundary. Add the 3-turn case as a test.
   *Confirmed:* probe p3 (H).

4. **`lib/pipeline/pipeline.ts:61,66-71`, P1. Escalation wipes previously verified fields.** The escalation path keeps `summary.fields = preserveReviewed(prev, emptyFields())`, so every earlier `supported` field is reset to `missing` on the turn that fires a flag, and again on every later turn. Turn 1 had chief_complaint, onset, severity, allergies and age supported; after turn 2 ("crushing chest pain and sweating") the supported list is `[]`. The nurse gets the red-flag interrupt with an empty allergy and medication block.
   **Fix:** on the escalation path, carry `previous.fields` forward unchanged (they were verified on earlier turns; no new model call is needed).
   *Confirmed:* probe p2 (A).

5. **`lib/pipeline/schema.ts:10`, used at `extract.ts:74`, P1 demo-breaker with real Gemma. `languageOK` requires Thai script in `value.th`.** Gemma will naturally emit `"th": "7/10"` or `"th": "45"` for severity and age. An English intake ("Headache since yesterday, 7/10. I am 45") with those values ends with every field `unsupported` and the session abstains with `low_confidence`. The mock hides this because it always writes `ระดับ 7/10` and `45 ปี`.
   **Fix:** when a value is purely numeric, units or a drug name (`/^[\p{N}\s.,/%+-]+$/u`, or identical across all three languages), skip the Thai-script requirement. Alternatively, add an explicit prompt instruction plus a test with numeric `th` values.
   *Confirmed:* probe p3 (F).

6. **`lib/pipeline/pharmacyExtraction.ts:84,95-98`, P1. Medication IDs come from the model's `nameOriginal`, and `merge` never drops stale unreviewed entries.** One mention, "prendo Tachipirina 1000 la sera", was extracted as `Tachipirina` on turn 1 and as `Tachipirina 1000` on turn 2 (normal model variation). That produced two paracetamol rows plus a **high MR-MAXDOSE-01** alert, which blocks pharmacist sign-off. Hallucinated `unsupported` meds from earlier turns also persist forever.
   **Fix:** on every turn, rebuild the non-reviewed entries from the fresh extraction and keep only entries with `review`. Dedupe fresh entries whose verified evidence spans overlap on the same turn, and key IDs on `(turnId, evidence.start)` or on the generic plus the evidence span.
   *Confirmed:* probe p4.

7. **`lib/pipeline/pharmacyReview.ts:32`, P1 demo-breaker. The PII rejection walks every string, including hex IDs.** The phone and ID regexes match digit runs inside about 1.4% of `stableId`s (279 of 20,000) and inside 105 of 20,000 UUIDs. Three dictionary products always produce such IDs: `keflex`, `klaricid` and `claritin`. Any pharmacist action on them returns 400 "Remove personal data from pharmacy review", so the row can never be verified, edited or discontinued. Klaricid + simvastatin is a listed high interaction.
   **Fix:** apply `check()` only to the free-text keys (`reviewerId`, `note`, `generic`, `dose`, `frequency`, `allergenClass`, `reaction`), never to `medId`, `alertId`, `allergyId` or action enums.
   *Confirmed:* probes p5 and p5b (validator rejects).

8. **`app/api/demo/reset/route.ts:6`, P1. A state-destroying `GET` wipes all sessions and the audit log, and `docker-compose.yml:10` defaults `DEMO_SEED` to `1`.** A link preview, crawler, `<img src>` or browser prefetch on a deployed demo erases the "append-only" audit (invariant 4).
   **Fix:** make it `POST`, require a header such as `x-demo-token` that equals an env secret, and default `DEMO_SEED` to `0` in compose.
   *Confirmed:* read (route plus compose).

9. **`app/api/_http.ts:4` and all clinician routes, P1 (acceptable only as a declared demo limit).** CORS is `*` on POST, and there is no authentication. Any origin or client can approve fields, mark red flags `false_alarm`, take over sessions, reconcile pharmacy, and read every transcript via `GET /api/sessions`. `reviewerId` is self-asserted, so "approval requires a clinician" is not enforced.
   **Fix:** restrict `Access-Control-Allow-Origin` to the mobile and web origins from env. Put review, takeover, pharmacy-review and the session list behind a shared clinician bearer token from env, and say so in the pitch limits.
   *Confirmed:* read.

10. **`lib/pipeline/llm.ts:51,66-78`, P2 (rate-limit demo-breaker). The `response_format` and system-role fallbacks are per call and never cached, and the format fallback skips `json_object`.** Against a fake gateway that lists `json_output:true` but rejects the strict schema, 3 logical calls made 6 chat requests (each `json_schema` gets a 400, then a retry with no format). That is 6 HTTP requests per turn, so the 30 rpm limit is reached at about 5 turns/min (seed and eval both run back to back).
    **Fix:** cache `noFormat` and `noSystem` per model in `schemaCapabilities`, and on rejection step `json_schema` → `json_object` → none, as DESIGN §1 specifies.
    *Confirmed:* probe p6 (fence stripping itself works).

11. **`lib/pipeline/redflags.ts:40-45` plus `pipeline.ts:50-51`, P2 (DoS).**
    - `normalise(domain.text)` runs inside the rules loop, so it is recomputed 18× per domain.
    - Turns per session are unbounded, and turns are accepted on `approved` and `needs_human` sessions. That reopens approved sessions and spends model calls after hand-over.

    Six turns of 12k chars cost 757 ms of synchronous CPU per POST, and the cost grows with each turn.
    **Fix:** hoist `normalise` out of the rules loop, cap patient turns (for example 8 per session), and return 409 on turns unless the status is `collecting` or `escalated`.
    *Confirmed:* probe p3 (I).

12. **`lib/pipeline/pipeline.ts:161,164`, P2. Metrics math.**
    - `calls` takes `modelCalls` from every `summary_generated` event, including the `screen_completed` and `screen_unavailable` log events (`ctx.log` reuses that type). Red-flag screen calls are therefore counted twice in p50/p95: actual `extract,red_flags,next_question`, counted `red_flags,extract,red_flags,next_question`.
    - `medianReviewSeconds` starts at the first summary (turn 1), not at `awaiting_review`, and ignores `red_flag_review` and `pharmacy_review`.

    **Fix:** read `modelCalls` only from events without `payload.event`. Start the review clock at the summary_generated whose status is `awaiting_review` or `needs_human`.
    *Confirmed:* probe p2 (E), plus a read for the review clock.

13. **`lib/pipeline/extract.ts:59` (`schema.ts:21`), P2. Model-controlled strings are written to audit unredacted.** `unknown_field_keys` logs the raw keys the model invented, with no length bound. AuditEvent promises no raw patient text.
    **Fix:** log only `{ count }`, or `redact(k).text.slice(0, 40)`.
    *Confirmed:* read.

14. **`lib/pipeline/pipeline.ts:38-40`, P2. Review preservation semantics.** A clinician `reject` sets the field to `missing`, so the next turn re-extracts the same value as `supported`. Conversely, an `approved` value silently shadows contradicting new patient text, for example "no allergies" approved and then "actually allergic to penicillin", with no conflict marker.
    **Fix:** keep `rejected` as a sticky audit-backed state (or store the rejected value and skip it). When a fresh supported value differs from an approved one, attach it as `pendingChange` or log it, and set the status to `awaiting_review`.
    *Confirmed:* read.

15. **`lib/pipeline/pharmacyReview.ts:23`, P2. A med-alert `false_alarm` is accepted without a note.** PHARMACY-SPEC §2 says "false alarm (+ note)", and red flags already enforce this.
    **Fix:** `if (a.action === 'false_alarm' && !a.note?.trim()) invalid(...)`.
    *Confirmed:* read.

16. **`lib/pipeline/verify.ts:10`, P2. NFD quotes fail.** A decomposed combining accent is `Script=Inherited`, not Latin, so it is never stripped: `perché` does not match `perché`. Exact and normalised matching both fail, and the field becomes `unsupported`.
    **Fix:** `quote.normalize('NFC')` before `norm`, or strip `\p{M}` when the previous kept char is Latin.
    *Confirmed:* probe p2 (C).

17. **`lib/pipeline/redact.ts:19-23`, P2 (PII leak).** After `my name is`, `mi chiamo` or `i am called`, only capitalised words after the first are captured, so a lower-case surname leaks: `mi chiamo mario rossi` becomes `[NAME_1] rossi`.
    **Fix:** for the explicit triggers, take up to 2 following Latin words regardless of case, stopping at a punctuation mark or a clinical stopword.
    *Confirmed:* probe p1.

18. **`lib/pipeline/seed.ts:33-61` and `app/api/demo/reset/route.ts`, P2 demo-breaker.** The whole seed (about 11 non-escalated turns, roughly 33 model calls, sequential, with no throttle) runs inside one HTTP request. On real Gemma that takes 1–7 minutes, so proxy or platform timeouts are likely. It also sits right at the 30 rpm limit (and above it if finding 10 doubles the requests). Any 429 with a `Retry-After` over 2 s turns into `needs_human` mismatches.
    **Fix:** run the seed as a background job with progress polling, add a minimum spacing of about 2.1 s between model calls, and pre-seed on mock or record a snapshot for the demo.
    *Confirmed:* read plus fixture turn counts.

19. **`app/api/_http.ts:16-19`, P2.** The body cap trusts `Content-Length`. A chunked body without that header is fully buffered by `request.text()` before the 64k check.
    **Fix:** stream-read with a byte counter and abort past 64 KB.
    *Confirmed:* read.

20. **`lib/pipeline/config.ts:26`, P2 (claim boundary).** `/api/metrics` reports `hardware: 'AMD Instinct (ROCm) via AMD Developer Cloud'` whenever the provider is not mock. The code never verifies this.
    **Fix:** read it from an env var set by whoever confirmed the hardware, defaulting to `unverified`.
    *Confirmed:* read.

**Checked and found sound:**
- Rule red flags run before any model call. The early return makes zero model calls.
- Model screen hits are add-only, with severity, label and action copied from the rules.
- Red flags are never removed, and an escalated status is sticky.
- Abstain is triggered on extraction provider or schema failure, after one repair or one fallback retry, and on the 40 s deadline.
- `approve` refuses `unsupported` and `missing` fields.
- The pharmacy 409 gate is atomic: mutations apply to a clone and nothing is saved on throw.
- Med alerts are recomputed in code only, and their reviews are preserved by stable ID.
- The per-session lock serialises turns, reviews and pharmacy writes within one process. A multi-instance deployment would diverge, so run a single replica.
- The store path comes only from env; no path traversal is possible.
- Patient text is escaped inside `<patient_turn>`.
- Error bodies are generic, and no raw text is found in logs or audit.
- Single-text negation parity with `check-redflags.mjs` holds.

## Verdict

The engine is carefully built: the safety ordering, add-only screen, abstain paths, stable alert IDs and audit discipline are mostly right, and the 722 tests pass. Still, two P0 defects defeat the core invariants on inputs that are plausible for this product, and the test suite does not cover either:
- Thai self-introductions (`ผมชื่อ… / ดิฉันชื่อ…`) are redacted in a way that erases the red-flag text before the deterministic matcher runs.
- The tolerant verifier accepts quotes with an added or dropped negation, so a fabricated "not allergic" quote yields a `supported` "no known allergies".

Before the demo, fix findings 1–7 at minimum. All are small local changes. Finding 5 is the one most likely to fail live on real Gemma, because the mock masks it. Lock down finding 8 (and ideally 9) before any public URL is shared. Treat the remaining items as known limits for the report. I would not describe red flags as "cannot be missed by the AI path" until finding 1 is fixed and pinned by tests.

## Risks / open questions
- Findings 5, 10 and 18 depend on how Token Factory actually behaves (numeric Thai values, strict-schema support, rate limits). They were confirmed against a fake gateway and client, not against the live endpoint.
- Fixing finding 2 by banning the tolerant tier for safety fields will lower measured verified-evidence rates. Re-run the dev split, not the test split.
