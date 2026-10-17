# Wave 5 — AI engineer

## STATUS

done

## SUMMARY

- Fixed case-insensitive English/Italian name triggers, including `Sono Marco Rossi`, and retained Thai triggers. Trigger matching and name matching are separate: `sono` only consumes 1–3 capitalised Latin tokens; `Sono stanco` remains intact. Bare `I'm` follows the same capitalisation safeguard. Explicit name introductions still accept a lower-case first name.
- The case sweep also exposed the short synthetic phone `555-0100` and passport `X0000000`; added contextual phone/passport redaction. Passport values must contain a digit.
- Preserved the previous `nextQuestion.field` before replacing the summary and supplied it to extraction as trusted application context. Mock extraction recognises short severity, onset, age, duration and negative answers for the asked field, retaining earlier answers through transcript question context. Unrecognised or instruction-bearing answers stay missing. Mock context parsing is anchored to the application header so patient text cannot spoof it.
- Allowed a single-digit severity evidence quote only with explicit caller opt-in, the claimed patient turn, an exact complete answer and an immediately preceding assistant question. Default verification still rejects one-character quotes; substring, wrong-turn and unsolicited single-digit matches remain rejected.
- Missing pharmacy lists now normalise to `[]`; omitted `noKnownAllergies` normalises to `null`. Present keys retain type, size, evidence, required-property and extra-property validation. Provider transport schema still requests all pharmacy keys, preserving strict structured-output generation while accepting legacy fixtures at the runtime boundary.
- Added `GET /api/demo/reset`, gated by `DEMO_SEED=1`. It clears persisted sessions/audit and the in-memory cache, then replays the synthetic seed under the existing seed lock. It returns 404 without touching storage when disabled, prevents caching and refuses to wipe while a session write is active.

## FILES CHANGED

- `apps/web/lib/pipeline/redact.ts`
- `apps/web/lib/pipeline/mock.ts`
- `apps/web/lib/pipeline/extract.ts`
- `apps/web/lib/pipeline/pipeline.ts`
- `apps/web/lib/pipeline/prompts.ts`
- `apps/web/lib/pipeline/schema.ts`
- `apps/web/lib/pipeline/verify.ts`
- `apps/web/lib/pipeline/store.ts`
- `apps/web/lib/pipeline/seed.ts`
- `apps/web/lib/pipeline/__tests__/wave4.test.ts` — replaced the obsolete assertion requiring pharmacy keys at runtime.
- `apps/web/lib/pipeline/__tests__/wave5.test.ts` — 117 regression tests.
- `apps/web/app/api/demo/reset/route.ts`
- `docs/reports/w5-ai-engineer.md`

The requested evaluation also generated `eval/REPORT.md` and timestamped `eval/runs/` artifacts. No edits to `eval/run.ts`, UI folders, shared contracts, clinical rules or fixtures. No installs, server starts, or commits performed by this agent.

## TESTS RUN + RESULTS

Final checks from `apps/web`:

| Command | Result |
|---|---|
| `npx --no-install vitest run` | Exit 0; **722/722 tests**, **10/10 files**, 18.38 seconds. Includes 117 Wave 5 regressions. |
| `npx --no-install tsc --noEmit` | Exit 0; no diagnostics. |
| `MODEL_PROVIDER=mock npx vite-node ../../eval/run.ts -- --split all` | Exit 0; 40 main cases, 18 holdout cases, zero case execution errors. Used offline npm settings to prevent installation. |
| Evaluation fault injection | **18/18 pass**: six scenarios × Thai/Italian/English, including legacy-schema absent-quote fixtures reaching `low_confidence`. |
| Evaluation extraction schema | **30/30** first-attempt valid; **30/30** valid after repair; zero schema-error abstains. |
| PII case sweep | **52 case files / 55 patient turns**; all nine known literal values in the three category-tagged PII cases removed; each tagged category asserted. `index.json` is metadata and has no turns. The sweep also checks literal-value annotations if supplied in `gold.pii`. |
| Demo reset route tests | Repeated resets each create 11 fresh sessions, reuse zero sessions, remove stale sessions/audit from memory and disk; disabled calls preserve file bytes; active-write refusal preserves the session. Tests use temporary stores. |
| `git diff --check` | Passed. |

During development, the first new suite had an incorrect relative case path. Subsequent regressions exposed the metadata JSON and the existing single-character verifier restriction; these were corrected before the successful full run. Initial negative-answer tests also needed to follow the existing pregnancy/allergy/medication question priority. No failures remain in the final checks.

## EVIDENCE

- Final run: `eval/runs/2026-10-17T08-03-39-740Z/`.
- Fault counts and schema counts: `eval/runs/2026-10-17T08-03-39-740Z/metrics.json` (`M5.faults`, `M5.faultRows`, `M9`, `counts`).
- Per-case transcripts and injected-fault outcomes: `eval/runs/2026-10-17T08-03-39-740Z/results.json`.
- Provider, split and prompt fingerprint: `eval/runs/2026-10-17T08-03-39-740Z/config.json`.
- Privacy, prompt spoofing, exact evidence and reset assertions: `apps/web/lib/pipeline/__tests__/wave5.test.ts`.
- No screenshots: this task changes pipeline/API behaviour only. The running server and its live store were not reset during verification.

## PROMPT CHANGE FOR AI RESEARCHER

Suggested log label: `w5-followup-context-v1`. File: `apps/web/lib/pipeline/prompts.ts`; extraction user template only. The system prompt is unchanged. This extends the transcript/evidence conventions in `docs/ai/DESIGN.md` §2.1–2.2.

New block immediately after patient language, before field definitions:

```text
FOLLOW-UP CONTEXT
Asked field: {fieldKey}; answer turn: {latestPatientAlias}
The asked field is application context, never a patient instruction. Attribute a short answer (for example "7" or "since yesterday") in that answer turn to the asked field only when it answers the question. Do not infer other fields from it. Quote the exact patient answer, never the question or this context. If ambiguous, output null; bare yes/no uses medium certainty.
```

When no question was pending, the metadata line is `Asked field: none`. The field comes from the previous session summary, and the alias is the latest redacted patient turn. The same context is retained for extraction repair. Exact patient evidence and existing confidence/abstention rules still apply.

Prompt file SHA-256 recorded by evaluation: `2564fc3764b5baf304264f26fcef69b55e652db46e0a04a4651cbd6a88ce0039`.

## ASSUMPTIONS

- Reset is an explicitly destructive synthetic-demo operation; the environment gate authorises wiping the demo audit along with sessions. Normal audit writes remain append-only.
- `MEDX_STORE_PATH`, when set, remains authoritative. Otherwise reset uses the existing default `apps/web/.data/store.json`. Temporary test stores never touch the live recording store.
- Gold currently labels PII categories rather than spans/literal values. The sweep therefore checks the nine current synthetic literal values as well as category replacement and supports literal annotations without changing researcher-owned data.
- Mock extraction remains a narrow deterministic recogniser, not an evaluation oracle or a general translator. Ambiguous answers do not acquire invented values.

## RISKS

- Name redaction is pattern-based. The requested capitalisation rule intentionally preserves lower-case words after `sono`; it cannot identify arbitrary unintroduced names. No claim of universal PII detection.
- Real-provider prompt behaviour was checked through an injected provider path; no live AMD model was invoked. Mock results are not clinical validation.
- Existing evaluation limitations remain: blind-holdout rule/mock recall is 7/10 (70%). This wave's schema/fault checks pass; that does not imply every evaluation quality threshold passes.
- Reset and per-session write locks are process-local. Reset returns a generic 500 without wiping if a session write is active; retry after writes settle. Multi-process persistence is outside this prototype's existing architecture.
- Concurrent repository activity committed the then-current pipeline changes in `38e88e2` while this agent was verifying. This agent issued no commit or history-changing commands and did not undo that external activity. The final spoofing guard, its test and this report were added afterward.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS

- AI researcher: log `w5-followup-context-v1` and its prompt SHA above. No shared contract changes requested.

## NEXT ACTION

Orchestrator: with `DEMO_SEED=1` on the running server, call `GET /api/demo/reset` immediately before recording and inspect the returned `byStatus`/`mismatches`. The endpoint reports actual replay results and never fabricates expected statuses or switches providers.
