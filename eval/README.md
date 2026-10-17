# Eval harness (design; implemented in wave 2)

Measures the metrics pre-declared in `docs/ai/METRICS.md` by running the real pipeline (`apps/web/lib/pipeline`) on the synthetic case set. It imports the pipeline directly; nothing goes over HTTP.

## Inputs
`data/cases/*.json`. The final format is set in `docs/research/CASE-PLAN.md`; until then we assume:
```jsonc
{
  "id": "it-007",
  "lang": "it",                       // Lang
  "tags": ["missing_onset", "injection"],
  "split": "dev" | "test",            // optional; else METRICS.md rule (index % 4 == 0 → dev)
  "turns": [ { "role": "patient" | "assistant", "text": "..." } ],
  "gold": {
    "fields": { "<FieldKey>": { "value_en": "...", "evidence": ["exact patient quote", "..."] } | null },
    "redFlags": ["RF-CHEST-01"],
    "shouldAbstain": false
  }
}
```
A loader validates every case. A malformed case is reported and skipped, never silently fixed.

## How a case runs
1. `createSession(lang)` in memory, with no audit file writes, or audit to a temp dir.
2. Feed **patient turns only**, in order, through the pipeline's per-turn entry point. Scripted assistant turns are ignored because the pipeline asks its own questions; they are kept only for the M6 "stated by turn t" computation.
3. After each turn, record status, `nextQuestion`, `modelCalls`, wall time, and the **raw model JSON before verification** (needed for the M3 ablation).
4. Stop early when the status is `escalated` or `needs_human`.
5. Score the final summary against gold (M1–M10).

Pipeline interface we need (contract request to the AI engineer; see the w1 report):
```ts
runTurn(session: IntakeSession, text: string, opts?: {
  client?: ModelClient;            // inject AMD client or mock client (fault injection)
  trace?: (e: { step: PipelineStep; raw: unknown }) => void;   // raw model output before verification
  now?: () => string;
}): Promise<IntakeSession>
```

## Modes
```
npm run eval -- --provider amd|mock --split dev|test|all --cases data/cases --concurrency 4 [--limit N]
npm run eval:faults          # M5 fault injection with the mock client: 6 scenarios × 3 languages
npm run eval:report -- eval/runs/<ts>   # rescore a stored run, then regenerate REPORT.md (no model calls)
```
- AMD mode reads `AMD_BASE_URL`, `AMD_API_KEY`, `AMD_MODEL` from env and refuses to start if they are missing. It prints model id and host, never the key.
- Concurrency ≤ 4, honours `Retry-After` on 429, and checks `X-RateLimit-Remaining-*`.
- Scoring is a pure function of `results.json`, so the M3 ablation, the manual-judgement merge and threshold tables can be recomputed without calling the model again.

## Outputs
```
eval/runs/<ISO-timestamp>/
  config.json      # git sha, METRICS.md sha, model id, base host, split, thresholds, prompt version hash
  raw.jsonl        # one line per model call: case, turn, step, request hash, raw response, latency, ok/error
  results.json     # per case: status, abstain, redFlags, per-field {gold, pred, status, confidence, evidence, autoMatch, f1}, nextQuestions, per-turn latency
  metrics.json     # M1–M10 with k/n and 95% CI, each threshold marked met / not met
  manual.csv       # M1 and M6 manual-judgement sheet (blank columns for 2 raters + doctor)
eval/REPORT.md     # generated from the latest test run, plus links to every earlier run
```
`eval/runs/` holds synthetic data only and is committed for reproducibility. No real patient data, ever.

## REPORT.md layout
1. Header: date, run id, commit hashes, model, provider, "synthetic evaluation, research prototype".
2. Headline table: M1 asserted precision, M3 with/without verifier, M4 recall and false alarms, M8 p50/p95, each with threshold and met / not met.
3. Full metric tables M1–M10 with CI and n, by language.
4. Failures: every incorrect asserted field, red-flag miss, abstain error and unsafe question, by case id.
5. Manual judgement: agreement and κ.
6. Run history: every run, including failed ones.
7. Limitations.
