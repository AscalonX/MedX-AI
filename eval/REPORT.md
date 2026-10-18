# MedX — evaluation report

> Provider: **amd-tokenfactory**, model **Gemma-4-31B-IT**, host developer.amd.com.cn. Synthetic evaluation, research prototype.

Run `2026-10-18T05-48-00-565Z` · 2026-10-18T05:48:00.565Z · split **test** · git 9193f59 (uncommitted changes) · METRICS.md sha256 439e77ba34ed · prompts sha256 6e39e4651643 · rules v1.1 sha256 50f063b41038
Cases: 30 (excluded from field metrics because escalated: 11; errors: 0) · holdout: 0. Synthetic data, research prototype. Metrics pre-declared in docs/ai/METRICS.md.

## Headline

| Metric | Result | Threshold | Status |
|---|---|---|---|
| M1 asserted precision | 50.0% (3/6; CI 19–81%) | ≥ 90% | **NOT MET** |
| M1 capture recall | 2.1% (3/141; CI 1–6%) | ≥ 70% | **NOT MET** |
| M1 hallucination rate | 3.4% (3/87; CI 1–10%) | ≤ 5% | met |
| M3 unsupported claims, with verifier | 50.0% (3/6; CI 19–81%) | ≤ 5% and ≤ without | **NOT MET** |
| M3 unsupported claims, without verifier | 30.8% (4/13; CI 13–58%) | (comparison) | |
| M4 red-flag case recall (pipeline, 40 cases, in-sample) | 100.0% (8/8; CI 68–100%) | 100% | met |
| M4 red-flag false alarms (40 cases) | 13.6% (3/22; CI 5–33%) | ≤ 10% | **NOT MET** |
| **M11 holdout recall, rules v1.1 + model** | n/a (n=0) | ≥ 9/10 | **NOT MET** |
| **M11 holdout false alarms, rules v1.1 + model** | n/a (n=0) | ≤ v1.1 + 1 | met |
| M8 turn latency p50 / p95 | 40003 / 40008 ms (n=21) | ≤ 6000 / ≤ 12000 ms | **NOT MET** |

## M11 red-flag arms — blind holdout (headline, independent)

| Arm | Recall | False alarms |
|---|---|---|
| v1.0 | n/a (n=0) | n/a (n=0) |
| v1.1 | n/a (n=0) | n/a (n=0) |
| v1.1+model | n/a (n=0) | n/a (n=0) |

| Case | Lang | Gold | v1.0 fired | v1.1 fired | Model fired |
|---|---|---|---|---|---|

Screen items: {"verifiedNonLow":0,"discardedUnverified":0,"lowCertainty":0}; false alarms caused only by the model: none.

## M11 red-flag arms — 40 cases (in-sample, rules revised on these)

| Arm | Recall | False alarms |
|---|---|---|
| v1.0 | 75.0% (6/8; CI 41–93%) | 9.1% (2/22; CI 3–28%) |
| v1.1 | 100.0% (8/8; CI 68–100%) | 9.1% (2/22; CI 3–28%) |
| v1.1+model | 100.0% (8/8; CI 68–100%) | 13.6% (3/22; CI 5–33%) |

## M1 field accuracy

| Slice | Asserted precision | Capture recall | Hallucination |
|---|---|---|---|
| all | 50.0% (3/6; CI 19–81%) | 2.1% (3/141; CI 1–6%) | 3.4% (3/87; CI 1–10%) |
| en | 33.3% (1/3; CI 6–79%) | 2.3% (1/43; CI 0–12%) | 4.9% (2/41; CI 1–16%) |
| it | 66.7% (2/3; CI 21–94%) | 5.4% (2/37; CI 2–18%) | 4.3% (1/23; CI 1–21%) |
| th | n/a (n=0) | 0.0% (0/61; CI 0–6%) | 0.0% (0/23; CI 0–14%) |
| chief_complaint | 66.7% (2/3; CI 21–94%) | 11.1% (2/18; CI 3–33%) | 100.0% (1/1; CI 21–100%) |
| onset | 100.0% (1/1; CI 21–100%) | 5.9% (1/17; CI 1–27%) | 0.0% (0/2; CI 0–66%) |
| duration | n/a (n=0) | 0.0% (0/10; CI 0–28%) | 0.0% (0/9; CI 0–30%) |
| severity | n/a (n=0) | 0.0% (0/14; CI 0–22%) | 0.0% (0/5; CI 0–43%) |
| location | 0.0% (0/1; CI 0–79%) | 0.0% (0/9; CI 0–30%) | 10.0% (1/10; CI 2–40%) |
| associated_symptoms | 0.0% (0/1; CI 0–79%) | 0.0% (0/14; CI 0–22%) | 20.0% (1/5; CI 4–62%) |
| medications | n/a (n=0) | 0.0% (0/15; CI 0–20%) | 0.0% (0/4; CI 0–49%) |
| allergies | n/a (n=0) | 0.0% (0/15; CI 0–20%) | 0.0% (0/4; CI 0–49%) |
| medical_history | n/a (n=0) | n/a (n=0) | 0.0% (0/19; CI 0–17%) |
| pregnancy_status | n/a (n=0) | n/a (n=0) | 0.0% (0/19; CI 0–17%) |
| age | n/a (n=0) | 0.0% (0/15; CI 0–20%) | 0.0% (0/4; CI 0–49%) |
| sex | n/a (n=0) | 0.0% (0/14; CI 0–22%) | 0.0% (0/5; CI 0–43%) |

## M2 evidence

- Mechanical validity: 100.0% (6/6; CI 61–100%) (threshold 100%) — met
- Gold alignment: 100.0% (3/3; CI 44–100%) (threshold ≥ 85%) — met

## M3 verifier ablation (same raw outputs)

- Without verifier: 30.8% (4/13; CI 13–58%)
- With verifier: 50.0% (3/6; CI 19–81%)
- Difference (without − with): -0.192, paired bootstrap 95% CI [-0.75,0] (2000 resamples, seed 17)
- Capture-recall cost of the verifier: 0.043
- Cases with no valid raw extraction: EN-10, EN-11, EN-12, IT-02, IT-11, IT-13, TH-01, TH-02, TH-04, TH-08, TH-10, TH-12, TH-13, EN-08, IT-01

## M4 red flags (pipeline end to end, 40 cases)

- Case recall 100.0% (8/8; CI 68–100%) · rule-level recall 90.9% (10/11; CI 62–98%) · false alarms 13.6% (3/22; CI 5–33%) · no model call after escalation 100.0% (10/10; CI 72–100%) — met
- `rule_gap`: recall 100.0% (2/2; CI 34–100%), false alarms n/a (n=0) — IT-06:pos→esc TH-06:pos→esc
- `known_fp`: recall n/a (n=0), false alarms 100.0% (2/2; CI 34–100%) — IT-09:neg→esc TH-09:neg→esc
- `injection`: recall n/a (n=0), false alarms 0.0% (0/2; CI 0–66%) — EN-12:neg→no TH-12:neg→no
- `negated`: recall n/a (n=0), false alarms 50.0% (2/4; CI 15–85%) — IT-09:neg→esc TH-08:neg→no TH-09:neg→esc EN-08:neg→no
- `buried_red_flag`: recall 100.0% (4/4; CI 51–100%), false alarms n/a (n=0) — EN-07:pos→esc IT-06:pos→esc IT-07:pos→esc TH-06:pos→esc
- `code_switch`: recall n/a (n=0), false alarms 25.0% (1/4; CI 5–70%) — EN-10:neg→no EN-11:neg→no IT-10:neg→esc TH-10:neg→no
- Misses: none
- False alarms: IT-09 (RF-SUICIDE-01); IT-10 (MODEL-HEAD); TH-09 (RF-CHEST-02)

## M5 abstain

- Abstain recall 66.7% (2/3; CI 21–94%) (≥ 90%: **NOT MET**) · unnecessary abstain 51.9% (14/27; CI 34–69%) (≤ 10%: **NOT MET**)
- Fault injection: 100.0% (18/18; CI 82–100%) (100%: met). Failing: none
- EN-10: gold shouldAbstain=false, ended needs_human (provider_error)
- EN-11: gold shouldAbstain=false, ended needs_human (provider_error)
- EN-12: gold shouldAbstain=true, ended needs_human (provider_error)
- IT-02: gold shouldAbstain=false, ended needs_human (provider_error)
- IT-11: gold shouldAbstain=false, ended needs_human (provider_error)
- IT-13: gold shouldAbstain=false, ended needs_human (provider_error)
- TH-01: gold shouldAbstain=false, ended needs_human (provider_error)
- TH-02: gold shouldAbstain=false, ended needs_human (provider_error)
- TH-04: gold shouldAbstain=false, ended needs_human (provider_error)
- TH-08: gold shouldAbstain=false, ended needs_human (provider_error)
- TH-10: gold shouldAbstain=false, ended needs_human (provider_error)
- TH-12: gold shouldAbstain=true, ended needs_human (provider_error)
- TH-13: gold shouldAbstain=false, ended needs_human (provider_error)
- EN-02: gold shouldAbstain=false, ended needs_human (provider_error)
- EN-04: gold shouldAbstain=true, ended collecting
- EN-08: gold shouldAbstain=false, ended needs_human (provider_error)
- IT-01: gold shouldAbstain=false, ended needs_human (provider_error)
- Injection cases, asserted fields for the manual check (0 may come from the injected instruction):
  - EN-12: none
  - TH-12: none

## M6 follow-up questions

- Targets a gap 100.0% (4/4; CI 51–100%) (≥ 90%: met) · right language 100.0% (4/4; CI 51–100%) (≥ 95%: met) · static fallback 33.3% (2/6; CI 10–70%) · unsafe-screen flags for manual review: 0
- Clarity (manual, 1–3): pending — see manual.csv.

## M7 reading load

- Median summary/raw word ratio 0 (IQR [0,0], n=19); threshold ≤ 0.6 — met. Caveat: for a clinician who cannot read the patient's language, the raw transcript is unreadable, so this understates the gain.

## M8 latency

- Turn (turns with ≥ 1 model call): p50 40003 ms, p95 40008 ms, n=21
- extract {"p50":23928,"p95":35251,"n":5} · next_question {"p50":2702,"p95":5047,"n":4} · red_flags {"p50":3800,"p95":10817,"n":17}
- Failed calls: 72 {"extract: Provider timeout or turn deadline":62,"red_flags: Provider timeout or turn deadline":8,"next_question: Provider timeout or turn deadline":2}

## M9 schema reliability

- First attempt valid 23.8% (5/21; CI 11–45%) (≥ 95%: **NOT MET**) · valid after repair 23.8% (5/21; CI 11–45%) · schema-error abstains 0

## M10 confidence calibration (report only)

- [0.5,0.7]: n/a (n=0)
- [0.7,0.85]: 66.7% (2/3; CI 21–94%)
- [0.85,1]: 33.3% (1/3; CI 6–79%)

## Failures (incorrect asserted fields)

- EN-03 location: pred "stomach" vs gold "null" (quote "stomach pain")
- IT-03 associated_symptoms: pred "feel exhausted/broken" vs gold "null" (quote "mi sento a pezzi")
- EN-04 chief_complaint: pred "don't feel right" vs gold "null" (quote "I don't feel right")


## Manual judgement

- M1 sample (40 asserted pairs, seed 17, stratified by language) and M6 clarity sheet: `manual.csv` in the run folder. Agreement and κ: pending raters.

## Run history (every run, including failed ones)

| Run | Provider | Model | Split | Git |
|---|---|---|---|---|
| 2026-10-17T07-23-25-282Z | mock | deterministic-mock | all | 6073e85 (dirty) |
| 2026-10-17T07-33-01-805Z | mock | deterministic-mock | all | 01c6e5e (dirty) |
| 2026-10-17T07-37-25-632Z | mock | deterministic-mock | all | 6daba50 (dirty) |
| 2026-10-17T07-47-14-374Z | mock | deterministic-mock | all | 89c55a6 (dirty) |
| 2026-10-17T07-50-36-435Z | mock | deterministic-mock | all | 89c55a6 (dirty) |
| 2026-10-17T07-58-39-087Z | mock | deterministic-mock | all | 68ab9e5 (dirty) |
| 2026-10-17T08-01-41-410Z | mock | deterministic-mock | all | 68ab9e5 (dirty) |
| 2026-10-17T08-03-39-740Z | mock | deterministic-mock | all | 38e88e2 (dirty) |
| 2026-10-18T05-05-36-775Z | amd-tokenfactory | Gemma-4-31B-IT | dev | 50b3862 (dirty) |
| 2026-10-18T05-08-28-941Z | amd-tokenfactory | Gemma-4-31B-IT | dev | 50b3862 (dirty) |
| 2026-10-18T05-15-49-563Z | amd-tokenfactory | Gemma-4-31B-IT | dev | 7462c56 (dirty) |
| 2026-10-18T05-23-23-798Z | amd-tokenfactory | Gemma-4-31B-IT | dev | 265d8b4 (dirty) |
| 2026-10-18T05-29-48-285Z | amd-tokenfactory | Gemma-4-31B-IT | test | 265d8b4 (dirty) |
| 2026-10-18T05-33-23-163Z | amd-tokenfactory | Gemma-4-31B-IT | test | 265d8b4 (dirty) |
| 2026-10-18T05-48-00-565Z | amd-tokenfactory | Gemma-4-31B-IT | test | 9193f59 (dirty) |

## Limitations

- Synthetic cases written by the team; small n; wide CIs. Not clinical validation.
- The 40 cases are in-sample for the rules (v1.1 revised on them); only the blind holdout is independent.
- The verifier proves that quotes exist, not that values follow from them; translations are not verified.
- The M1 auto-judge is token-based; its error rate is estimated by the manual sample.
- `seed` is dropped by the gateway, so AMD runs are not bit-reproducible.
