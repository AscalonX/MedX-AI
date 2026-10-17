# W1 report: AI researcher

## STATUS
**partial.** The design, the metrics and the harness design are done. The Token Factory base URL and Gemma model ids are **not found publicly**: they sit behind the AMD Developer Program SAML login. A human must read them from the console.

## SUMMARY
- Pipeline design with exact prompts. Extraction and translation happen in **one** Gemma call; the next question is a second small call with a static-template fallback. Field selection, verification, confidence and abstain are all done in code.
- Verifier: exact match, then normalised match (NFKC, lowercase, Latin-only accent strip, punctuation to space, Thai inter-character spaces dropped, offset map back to the original), then tolerant match (token overlap ≥ 0.8 in a window, `Intl.Segmenter`, works for Thai), then a retry on other patient turns. Never assistant turns, never the model.
- Confidence = categorical self-rating × verifier match factor × short-quote penalty. A field is `unsupported` below 0.50. Summary-level abstain rules cover provider, schema, low-confidence and language failures. One retry per call (a repair prompt for schema errors), and a 25 s / 8 s / 40 s timeout budget.
- Ten pre-declared metrics with thresholds, a dev/test split rule, Wilson CIs, a paired-bootstrap verifier ablation over the same raw outputs, a manual-judgement protocol with κ, and honest-reporting rules.
- Harness design: direct import of the pipeline, `eval/runs/<ts>/{config,raw.jsonl,results,metrics,manual.csv}`, and a generated `eval/REPORT.md`.

## FILES CHANGED
- `docs/ai/DESIGN.md` (new)
- `docs/ai/METRICS.md` (new)
- `eval/README.md` (new)
- `docs/reports/w1-ai-researcher.md` (new)

## TESTS RUN + RESULTS
- No pipeline exists yet. This was a Node sanity check of the verifier approach only (scratch script, not committed):
  - `"mal di pancia da ieri sera"` matched `"mal di pancia, da ieri sera"` (normalised, offsets 12–39).
  - `"l'addome mi fa male"` matched `"l’addome mi fa male"` (curly apostrophe).
  - `"เจ็บหน้าอกมาก"` matched `"เจ็บหน้าอก มาก"` (Thai space dropped, offsets 0–14).
  - Thai vowel marks are `\p{Mn}`, which confirms accent stripping must be Latin-only.
  - `Intl.Segmenter('th')` splits `เจ็บหน้าอกมากตั้งแต่เมื่อวาน` into sensible words.
- Unauthenticated probes: `https://notebooks.amd.com/tokenfactory/v1/models`, `/tokenfactory/api/v1/models` and `/v1/models` return `404 {"detail":"Not Found"}`; `/tokenfactory` is a SAML login page.

## EVIDENCE (sources)
- Hackathon page: hosted on `notebooks.amd.com/tokenfactory`, "Just the api from the tokenfactory", no billing; Gemma use is eligible for the Google prize. Track 2 rule: no autonomous diagnosis or treatment. https://lablab.ai/event/amd-developer-hackathon-act-iii
- Token Factory landing page (login only, no API docs): https://notebooks.amd.com/tokenfactory
- AMD public model API docs (Radeon cloud; probably the same gateway family, **not confirmed** for Token Factory):
  - Base `https://developer.amd.com.cn/radeon/api/v1`, `POST /v1/chat/completions`, `GET /v1/models`, Bearer auth; unknown fields are dropped silently. Catalog: DeepSeek, Qwen, GLM, MiniCPM and others, **no Gemma**. https://amd-aim.github.io/radeon-cloud-docs/api/overview/
  - `response_format` accepts `json_object` or `json_schema` "on models where `json_output` is true"; `seed`, `stop` and `top_k` are dropped; 10-minute timeout. https://amd-aim.github.io/radeon-cloud-docs/api/chat-completions/
  - 30 req/min and 8 concurrent per key, 429 with `Retry-After`, `X-RateLimit-*` headers. https://amd-aim.github.io/radeon-cloud-docs/api/rate-limits/
  - Third-party provider page listing the same AMD base URL and `AMD_API_KEY`: https://mastra.ai/models/providers/amd.md
- Gemma 4: sizes E2B / E4B / 26B A4B / 31B, up to 256K context, over 140 languages, Apache-2.0. https://huggingface.co/google/gemma-4-31B, https://huggingface.co/google/gemma-4-E2B
- AMD day-0 Gemma 4 support (vLLM and SGLang on Instinct): https://www.amd.com/en/developer/resources/technical-articles/2026/day-0-support-for-gemma-4-on-amd-processors-and-gpus.html (the page timed out on fetch; confirmed from the search summary only)

## ASSUMPTIONS
- Token Factory is OpenAI-compatible (`/v1/chat/completions`, `/v1/models`, Bearer) like AMD's public gateway, and serves at least one Gemma instruct model. Preference order: Gemma 4 31B, then 26B A4B, then Gemma 3 27B.
- Rate limits are similar to the public gateway (about 30 RPM, 8 concurrent). The eval is sized for this (concurrency ≤ 4).
- Required fields and the next-question priority are my defaults until `docs/clinical/` defines them.
- The case format is the one in the brief until `docs/research/CASE-PLAN.md` exists.
- `Turn.text` is stored NFC-normalised after redaction, so offsets are stable.

## RISKS
1. **No Gemma on Token Factory, or no key in time.** That blocks the AMD requirement and the Google prize. Mitigation: everything is driven by env; the eval labels any non-AMD provider explicitly and never presents it as Gemma-on-AMD.
2. **`json_schema` silently dropped by the gateway.** We fall back to prompt-only JSON, validation and one repair retry. M9 measures schema reliability.
3. **Non-determinism**, because `seed` is dropped. Report the run-to-run spread if time allows; never rerun until the numbers look good.
4. **Latency.** 31B with roughly 12 fields × 3 languages of output may exceed 4 s. The fallback ladder is in DESIGN §7.
5. **Verifier blind spot.** It checks that the quote exists, not that the value follows from it (negation, family history), and it does not check translations. This is stated as a limit, and M1 measures it.
6. **Rate limit during eval.** About 40 cases × 3 turns × 2 calls is roughly 240 calls, about 8–10 minutes at 30 RPM. Plan the eval window for that.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
1. **Human:** from the Token Factory console, provide the exact `AMD_BASE_URL`, the output of `GET {AMD_BASE_URL}/models` (Gemma ids, and `json_output` if shown) and the rate-limit headers. Then run a 1-call smoke test.
2. **AI engineer:** the pipeline should expose `runTurn(session, text, { client, trace, now })`. `trace` gets the raw model JSON before verification, which the M3 ablation needs. It should also keep `edited`/`approved` fields untouched on re-extraction.
3. **Orchestrator (shared i18n):** add static next-question templates per `FieldKey` in th/it/en (English drafts in DESIGN §2.5), for use when call #2 fails.
4. **Orchestrator (types.ts), optional:** add `"needs_check"`? Not needed. The current `FieldStatus` covers it (low confidence → `unsupported`). **No contract change required.**
5. **Doctor:** confirm the required-field list, the next-question priority, and when `pregnancy_status` applies. Confirm that `RedFlagRule.requires` runs as a second pass **after** extraction and can only add flags.
6. **Medical researcher:** put a `split` field in each case, or accept the `index % 4` rule. Gold `evidence` quotes must be exact substrings of patient turns.

## NEXT ACTION
Wave 2:
1. Implement the `eval/` harness (loader, runner, scorer, fault injection, REPORT generator) against the mock client.
2. Once the base URL and model ids arrive, run the model-selection protocol on dev.
3. Freeze the configuration, run the test split on Gemma-on-AMD, and write `eval/REPORT.md`.
