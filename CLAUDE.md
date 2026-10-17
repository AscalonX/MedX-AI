# MedX Bridge — team rules (read before any work)

Product: multilingual pre-visit intake for AMD Developer Hackathon ACT III, Track 2 (Health & Wellbeing).
Plan of record: `docs/PLAN.md`. Spec of record (after spec wave): `docs/SPEC.md`.
Deadline: Sun 18 Oct 2026 17:00 ICT (internal: 15:00).

## Claim boundary
Research prototype that **supports** clinicians. Never diagnoses, treats, prescribes, or decides urgency on its own.
Use "suggests for review", "flags for clinician", "decision support". Synthetic data only.

## Safety invariants (never break)
1. Red-flag rules are deterministic code, run before any model call, and no model output can clear them.
2. A field with no verified evidence quote is `unsupported` and is never displayed as fact.
3. Provider error / schema error / low confidence → abstain → "needs human review". Never a guess.
4. Nothing is final until a clinician approves it. Every action is in the append-only audit log.
5. Raw patient text is redacted before storage or any model call. No real patient data, ever.
6. API keys only from env vars. Never commit `.env`.

## Layout and ownership (edit only your own folder)
| Path | Owner |
|---|---|
| `packages/shared/` (contracts, i18n, tokens) | orchestrator only — request changes in your report |
| `docs/clinical/`, `packages/shared/src/redflags.json`, `packages/shared/src/medrules.json` | Doctor |
| `docs/research/`, `data/cases/` | Medical researcher |
| `docs/ai/`, `eval/` | AI researcher |
| `docs/design/`, `apps/web/components/ui/`, `apps/web/app/globals.css` | Design lead |
| `apps/web/lib/pipeline/`, `apps/web/app/api/`, `Dockerfile` | AI engineer (Codex) |
| `apps/web/app/(clinician)/` | Clinician web builder |
| `apps/web/app/(ops)/` | Ops dashboard builder (Codex) |
| `apps/web/app/(pharmacy)/` | Pharmacist web builder |
| `apps/mobile/` | Patient mobile builder |
| `pitch/` | Pitch lead |

## Design rules
No purple/blue gradients, glassmorphism, generic card grids, sparkle icons, emoji UI, "AI assistant" bubbles, centered hero + 3 cards.
Follow `docs/design/DIRECTION.md` and tokens in `packages/shared/src/tokens.ts`.

## Report (required at the end of every task)
Write `docs/reports/<wave>-<role>.md`:
STATUS (done | partial | blocked) · SUMMARY · FILES CHANGED · TESTS RUN + RESULTS · EVIDENCE (numbers, screenshots paths) · ASSUMPTIONS · RISKS · OPEN QUESTIONS / CONTRACT CHANGE REQUESTS · NEXT ACTION.
No report = not done. Never invent results.
