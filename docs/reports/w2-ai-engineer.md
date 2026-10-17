# Wave 2 — AI engineer

## STATUS

done

## SUMMARY

Fixed the safety blocker first. The engine now uses the Doctor's reference normalization, substring matching, exact untrimmed negation cues, 14-character rule-file window, and clause-boundary handling. All 175 clinical table rows agree with their expected results across all 18 v1.1 rules. Patient-only, cross-turn matching and original-turn evidence offsets remain supported; deterministic flags still stop the pipeline before any model call.

Required fields now follow the clinical spec: chief_complaint, onset, severity, age, allergies, medications; pregnancy_status is conditional on verified/clinician-entered demographics. Unknown or unsupported demographics keep the conservative requirement. Follow-up priority follows the clinical spec, with at most three assistant questions per session, then awaiting_review with missing values preserved. Flags suppress all follow-ups.

Implemented optional redFlagActions in review() and the review route. Both acknowledge and false_alarm preserve the flag, evidence, escalation and audit history. False alarms require a reason per the clinical spec. Reviews record reviewer, timestamp, redacted note and a red_flag_review audit event; invalid actions fail without persisting partial changes. Existing field reviews remain compatible. Shared out_of_scope and conflicting_information reasons survive partial review.

Added an environment-gated, repeat-safe eight-session synthetic replay endpoint. It uses the configured provider through addTurn(), never gold fields or a forced mock. A demo-clinician approval uses the normal review() path and only verified required fields. The response contains created/reused counts, sessions, actual byStatus counts and expected/actual mismatches. Concurrent calls reuse the same sessions within the existing single-process store.

## FILES

- apps/web/lib/pipeline/redflags.ts
- apps/web/lib/pipeline/config.ts
- apps/web/lib/pipeline/nextQuestion.ts
- apps/web/lib/pipeline/pipeline.ts
- apps/web/lib/pipeline/mock.ts — narrow input-derived extraction patterns for the selected synthetic narratives; no gold-answer lookup.
- apps/web/lib/pipeline/seed.ts
- apps/web/lib/pipeline/__tests__/clinical-redflags.test.ts
- apps/web/lib/pipeline/__tests__/wave2.test.ts
- apps/web/lib/pipeline/__tests__/pipeline.test.ts
- apps/web/app/api/sessions/[id]/review/route.ts
- apps/web/app/api/dev/seed/route.ts
- docs/reports/w2-ai-engineer.md

Only owned pipeline/API paths and this report were edited. Concurrent docs/ai/DESIGN.md, docs/ai/METRICS.md and docs/reports/w1-design-lead.md work was left untouched. No commit or npm install was run.

## TESTS RUN + RESULTS

Final validation on 17 Oct 2026 from apps/web:

| Command | Result |
|---|---|
| npx vitest run | 5 files passed; 322 tests passed, 0 failed; 12.44 seconds |
| npx tsc --noEmit | Passed, exit 0, no diagnostics |
| npx eslint lib/pipeline app/api --max-warnings=0 | Passed, exit 0, no diagnostics |
| node docs/clinical/check-redflags.mjs (repo root) | 175 passed, 0 failed, 18 rules |
| git diff --check (repo root) | Passed, no whitespace errors |

Test totals: clinical-redflags 180 (175 parsed table rows plus row/rule completeness and four normalization/offset checks); safety 45; pipeline 21; llm-api 39; wave2 37. Together: 322.

The table test uses the reference runner's exact markdown-row selector, verifies every RF table row is loaded, and verifies coverage of all 18 rule IDs. Extra checks cover decomposed Unicode, curly apostrophes, contextual lowercase, collapsed whitespace and exact original evidence spans.

Intermediate checks caught a table-fixture relative-path mistake and a missing schemaName in the AMD transport test request; both were corrected before final validation.

## EVIDENCE

Replay cases: EN-05 and TH-05 escalated; EN-01 and IT-01 awaiting_review; EN-04 needs_human; EN-03 and IT-03 collecting; EN-02 approved by demo-clinician.

| Status | Verified count |
|---|---:|
| escalated | 2 |
| awaiting_review | 2 |
| needs_human | 1 |
| collecting | 2 |
| approved | 1 |
| taken_over | 0 |

Exact distribution verified both with configured mock mode and through stubbed AMD HTTP transport. Concurrent seed requests produced created=8, then created=0/reused=8. Escalated replays made zero model calls. AMD transport metadata remained amd-tokenfactory with the configured test model.

Provider-failure injection produced 2 escalated and 6 needs_human, zero approvals and 5 reported status mismatches. No supported assertions survived failure. Real provider availability was not claimed or tested.

Clinician review tests verify persistent red flags, original evidence, redacted notes, reviewer/timestamp, separate append-only events, rejection of unknown/delete/malformed actions, and preservation after subsequent patient turns. Follow-up tests verify exactly three assistant questions after five incomplete patient turns and no next_question call after the cap.

## ASSUMPTIONS

- Reaching the follow-up cap routes incomplete but otherwise verified intake to awaiting_review; extraction failures/low confidence still route to needs_human.
- EN-04 reuses its final existing patient answer once for a third clarification attempt. No patient wording is invented; fixture assistant turns are excluded so questions come from the real pipeline.
- Shared abstainReason additions extend the contract; this wave preserves them through review without inventing new automatic clinical conflict/scope detectors.
- Synthetic demo approval is explicitly attributed to demo-clinician and audited. It is not an automatic approval for ordinary sessions.

## RISKS

- A live AMD provider may extract differently or be unavailable. Seed responses report actual outcomes and mismatches; they never manufacture the requested statuses or switch providers. Live credentials/endpoints were not exercised.
- The existing file store and seed lock are single-process. Multiple server processes sharing one store are not supported. Repeated seed requests reuse existing sessions, including any partial replay left by a process interruption.
- Mock remains a narrow demo extractor, not an evaluation oracle.
- No persistent demo sessions were added to the working application store during verification; tests used temporary stores only.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS

None for the requested wave. Shared contracts and clinical fixtures were read only.

## NEXT

Start the web app with DEMO_SEED=1 and the intended MODEL_PROVIDER configuration, then POST /api/dev/seed. Inspect byStatus and mismatches before the demo; review the resulting clinician and ops screens. Disable DEMO_SEED after preparing the demo environment.
