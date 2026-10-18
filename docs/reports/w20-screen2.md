# w20 — second add-only red-flag screen (DeepSeek-V4.1-Flash)

STATUS: done (code + tests). Live AMD measurement: **not valid, left to the eval lane** (key rate-limited, see EVIDENCE).

## SUMMARY
Env `AMD_MODEL_SCREEN2` (e.g. `DeepSeek-V4.1-Flash`) turns on a second red-flag screen that runs in parallel with the existing Gemma screen, after the deterministic rules (rules still run first and escalate with zero model calls). It reuses `redFlagScreen` (same prompt, schema validation, certainty filter, turn-alias and evidence-quote verification, category to rule copy of wording and severity), via an optional third argument `{model, timeoutMs}`. Differences for screen 2: `model` passed to `chatJSON`, 6 s timeout, no repair retry. Union is add-only: new `MODEL-<cat>` hits are appended; if Gemma already raised the same rule id, the existing hit is kept and `models` gains the second model. Timeout / provider error / schema error / unverifiable quote: that screen contributes nothing, the failed `ModelCall` stays in `summary.modelCalls` (so the audit and trace show it), the turn is never blocked, nothing marks the case safe. Env unset: the code path is unchanged (no extra call, no extra field).

## FILES CHANGED
- `apps/web/lib/pipeline/redFlagScreen.ts` — optional `second` arg, `redFlagScreen2` wrapper (try/catch, returns [] on any throw), `ScreenedHit` type (RedFlagHit + `models?`), `SCREEN2_TIMEOUT_MS = 6000`. Log events from screen 2 carry `screen: 'second', model`.
- `apps/web/lib/pipeline/pipeline.ts` — read env, `Promise.all` with a third screen, add-only merge after `addFlags(modelFlags)`.
- `apps/web/lib/pipeline/mock.ts` — deterministic second-screen mock (only when `req.model` is set on `red_flags`): flags CHEST on the phrase "elephant sitting on my chest" (a paraphrase the keyword rules and the first mock miss), with a verbatim quote.
- `apps/web/lib/pipeline/trace.ts` — model_screen node detail appends `; second screen: <model>` when more than one model made `red_flags` calls. Also fixed a latent issue: `summaryEv` picked the first `summary_generated` event, which is usually a log event without `modelCalls`, so the node always read "Rules only"; it now prefers the event that has `modelCalls`. No new `PipelineStep` value was needed (step stays `red_flags`; the model id distinguishes the call).
- `apps/web/lib/pipeline/__tests__/screen2.test.ts` — 9 new tests.
- `packages/shared/src/types.ts` — NOT changed (see CONTRACT CHANGE REQUESTS).

## TESTS RUN + RESULTS
- `npx vitest run` in `apps/web`: 2460 passed (2451 baseline + 9 new), 0 failed. All existing tests unchanged.
- `node docs/clinical/check-redflags.mjs`: 175 passed, 0 failed, 18 rules (100%).
- `tsc --noEmit` (apps/web, excluding the pre-existing apps/mobile resolution errors): clean.
- New tests cover: env unset = old steps and no second call; union adds a verified hit with `models` attribution and both screens called; rules-first (rule hit → zero model calls); cannot remove (screen 2 empty keeps Gemma hit); same category merges attribution into one hit; unverifiable quote dropped; error skip; timeout skip (failed `red_flags` call recorded, extract ok, not abstained, not escalated); trace tolerates the second call and names it.

## EVIDENCE
Live holdout run (18 blind cases, `data/holdout`, own harness in scratchpad using `runTurn`, sequential, real Gemma-4-31B-IT; screen 2 = DeepSeek-V4.1-Flash). **Not a valid comparison:** the shared AMD key returned HTTP 429 for many calls (also on a standalone probe), and DeepSeek calls timed out at 6 s or were 429.
- Arm A (rules + Gemma): recall 9/10, false alarms 3/8. (HO-04 and HO-08 caught by Gemma model hits; HO-09 missed; several Gemma calls failed on 429 in the false-alarm cases.) The 3 false alarms are all deterministic rule hits (HO-11 RF-CHEST-02, HO-12 RF-MENING-01, HO-17 RF-SEIZ-01), identical in both arms.
- Arm B (rules + Gemma + DeepSeek): recall 8/10, false alarms 3/8. The 1-case drop (HO-04) is Gemma itself failing with 429 in that run, not caused by screen 2 (union can only add). Every DeepSeek call in this run failed (429 or 6 s timeout), so screen 2's recall contribution is unmeasured. All failures were skipped cleanly: no turn blocked, status `needs_human` (abstain) where extraction also failed, never "safe".
- Observation: under load DeepSeek hit the 6 s ceiling; the earlier probe doc says ~0.5 s for a tiny prompt. If it is slow in practice, raise `SCREEN2_TIMEOUT_MS` (a deadline, not a correctness matter).
- Holdout caveat per `docs/ai/METRICS.md`: this run touched the blind holdout once for a config that was not tuned on it; the eval lane should decide whether it counts as the frozen holdout run.

## ASSUMPTIONS
- Same `red_flags` step name for both screens; attribution via `ModelCall.model` and `hit.models`.
- Sharing the Gemma system prompt/schema with DeepSeek is acceptable ("independent" = different model, same contract).
- `.env.example` is not editable in this lane, so the code reads `process.env['AMD_MODEL_SCREEN2']` (bracket access) to keep the `w20-platform` env-documentation test green.

## RISKS
- Extra latency/quota: one more AMD call per non-escalated turn when enabled; mitigated by parallelism and 6 s cap (turn latency bounded by the slower of extraction and screens, unchanged since extraction is longer).
- Same-rule duplicates are merged by `ruleId`, so the clinician UI shows one `MODEL-CHEST` hit; the second-model attribution is in the data and trace but not yet rendered in the review UI badge (clinician lane).
- 429s on the shared key can make both screens fail together; behaviour is fail-safe (abstain), as before.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
1. Orchestrator: add `models?: string[]` to `RedFlagHit` in `packages/shared/src/types.ts` (additive; doc: "model screens that raised a model hit, set only when AMD_MODEL_SCREEN2 is on"). I did not touch shared because it changes the `/patient` export stamp (`app/patient-stamp.test.ts` requires `scripts/build-patient-web.sh` and apps/mobile), which is out of lane. Until then the field is carried via the local `ScreenedHit` type.
2. Add `# AMD_MODEL_SCREEN2=` (with a comment) to `.env.example`, then change `process.env['AMD_MODEL_SCREEN2']` in `pipeline.ts` to dot access.
3. Clinician lane: show "also flagged by second screen (<model>)" next to the `modelSuggested` badge using `hit.models`.

## NEXT ACTION
Eval lane: re-run the 18-case holdout and the 40-case set with and without `AMD_MODEL_SCREEN2=DeepSeek-V4.1-Flash` when the key is not rate-limited, sequentially, and compare arm (c) recall / false alarms. Then set the env on the deployment only if recall improves with no new false alarms.
