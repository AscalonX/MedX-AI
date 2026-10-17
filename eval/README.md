# Eval harness (implemented in wave 2: `eval/run.ts`)

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

## Running it (no extra install: uses `vite-node`, which ships with vitest in apps/web)
```
cd apps/web
MODEL_PROVIDER=mock npx vite-node ../../eval/run.ts -- --split all            # mock smoke run, labelled "not evidence"
AMD_BASE_URL=… AMD_API_KEY=… AMD_MODEL=… npx vite-node ../../eval/run.ts -- --split dev   # model selection / tuning, dev only
AMD_BASE_URL=… AMD_API_KEY=… AMD_MODEL=… npx vite-node ../../eval/run.ts -- --split test  # frozen config, once
npx vite-node ../../eval/run.ts -- --rescore ../../eval/runs/<ts>             # rescore a stored run, no model calls
```
- `--split dev|test|all` selects from the 40 cases (from `data/cases/index.json`); the 18 holdout cases always run and only feed red-flag metrics (M11). `--limit N` caps the case count.
- AMD mode refuses to start without the three env vars. It prints model id and host, never the key. Runs sequentially (concurrency 1), so the per-key rate limit is never exceeded.
- Every run also does M5 fault injection (6 scenarios × 3 languages) with injected clients. Each patient turn is fed through `runTurn`; after an escalation, the remaining turns are still fed to prove that no model calls follow.
- Arms (a) and (b) of M11 are computed directly with `checkRedFlags(turns, undefined, ruleFile)` on the redacted patient turns. Arm (c) is read from the pipeline's `source: "model"` hits. Until the pipeline makes `red_flags` model calls, it is reported as "not run: screen not implemented".

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
`eval/runs/` is git-ignored (repo `.gitignore`); `eval/REPORT.md` is the committed artifact and names the run id. Synthetic data only.

## REPORT.md layout
1. Header: date, run id, commit hashes, model, provider, "synthetic evaluation, research prototype".
2. Headline table: M1 asserted precision, M3 with/without verifier, M4 recall and false alarms, M8 p50/p95, each with threshold and met / not met.
3. Full metric tables M1–M10 with CI and n, by language.
4. Failures: every incorrect asserted field, red-flag miss, abstain error and unsafe question, by case id.
5. Manual judgement: agreement and κ.
6. Run history: every run, including failed ones.
7. Limitations.
