# AMD Hackathon ACT III — Track 2 — fresh build: "MedX"

## Context
- **Deadline: Sun 18 Oct 2026, 17:00 ICT.** Now Sat ~12:30 ICT → ~28 h. Internal submit target: **Sun 15:00 ICT**.
- User decision: **do not reuse the old MedX code**; build a new, clean product from scratch, multi-agent (Opus orchestrates, Sonnet agents build, ChatGPT Pro/Codex as independent reviewer). Model: **Gemma on AMD** (AMD requirement + Google prize). Full TH/IT/EN, "100% done".
- The Senior Project repo is **not deleted or touched** (team's graded work). New repo in a sibling folder: `/Users/king_phuripol/AI-Engineer/Workstreams/medx-bridge` → public GitHub (approved), MIT.
- Judges: Application of Technology (AMD/model use), Business Value, Originality, Presentation. Track 2 wants one journey step, first input → final result, visible uncertainty, human takeover, a measurable gain, safety story.

## What we build (one sharp slice, not a whole hospital)
**MedX — multilingual pre-visit intake that a clinician can trust in 30 seconds.**
A patient (any language: Thai, Italian, English…) describes their problem in a short guided chat. The clinician gets a one-screen structured summary in *their* language where **every field links to the exact patient sentence it came from**, uncertain fields are flagged, missing info triggers one follow-up question, and red flags interrupt everything.

Why this wins:
- Clear user + need: triage nurse / GP facing a patient they can't fully understand, with 2–3 minutes per intake.
- Originality: evidence-linked summary + self-verification ("no source sentence → field marked unsupported, never shown as fact"); language barrier solved both ways (summary for clinician, follow-up question back to patient in their language).
- Italian judges: demo with an Italian-speaking tourist + a Thai patient.
- Safety is the product, not a disclaimer.

### Pipeline (per intake) — all model calls = Gemma on AMD
1. **PII redaction** (regex + Gemma pass) before anything is stored or sent; names/phone/ID → tokens.
2. **Red-flag rules** (deterministic TS, ~15 rules: chest pain + sweating, stroke signs, suicidal intent, anaphylaxis, severe bleeding, pregnancy + pain…) run **first and independently**; the model cannot clear them. Hit → red banner "Escalate to clinician now", flow stops.
3. **Extraction** (Gemma, JSON schema): chief complaint, onset, severity, symptoms, meds, allergies, history, pregnancy status — each with `evidence_quote`, `confidence`.
4. **Verifier** (code + Gemma): quote must exist in transcript (fuzzy match across translation); else `status=unsupported`. Missing required field → `status=missing` → **next-question generator** asks the patient in their language.
5. **Clinician review**: approve / edit / take over per field; nothing is "final" until approved. Append-only audit log (model, version, latency, AMD endpoint, reviewer).
6. Provider failure / schema failure / low confidence → abstain + "needs human review", never a guess.

### Measurable improvement (honest, synthetic)
Synthetic benchmark of ~40 multilingual intake transcripts (TH/IT/EN) with gold labels, generated + cross-checked:
- Field extraction accuracy; red-flag recall & false-alarm rate; **unsupported-claim rate with vs without verifier**; % cases correctly abstained.
- Reading load: words clinician reads (raw transcript vs summary) + small timed test by team members (time to correct intake note, with vs without).
- Gemma-on-AMD latency p50/p95 per intake.
All reported as "synthetic evaluation, research prototype".

## Three surfaces, one codebase
| Surface | User | What it shows |
|---|---|---|
| **Patient mobile app** (native, Expo) | Patient / caregiver | Guided chat in their language (TH/IT/EN), voice-to-text optional, follow-up questions, "a nurse will review this" status, red-flag "go to the desk now" screen |
| **Clinician web** (review workspace) | Triage nurse / GP | Structured summary in clinician's language, click field → source sentence highlights, confidence + unsupported + missing states, edit/approve/take over, audit trail |
| **Ops dashboard** | Head nurse / clinic manager | Live queue by urgency, escalations, % auto-captured fields, review time, abstain rate, Gemma-on-AMD latency, eval results |

## Design direction — not "AI-looking"
Banned: purple/blue gradients, glassmorphism, generic card grids, sparkle ✨ icons, emoji UI, "AI assistant" chat bubbles, centered hero + 3 feature cards.
Direction (design lead finalises in `docs/design/DIRECTION.md` before any screen is built):
- **"Clinical paper"**: warm off-white paper, ink-black type, one signal colour for urgency; editorial typography (serif display + sharp grotesk for data), tabular numerals, dense-but-calm layouts like a good chart/form.
- **Signature interactions:** highlighter-pen sweep from a summary field to the patient's original sentence; unsupported fields rendered as faded pencil, not ink; red flag = full-bleed interrupt that physically pushes the summary away; confidence shown as ink density, not a % badge; language switch morphs text in place.
- Motion with purpose only (Framer Motion / CSS), `prefers-reduced-motion` respected, WCAG AA.
- Skills: `design-taste-frontend`, `impeccable` (direction + finish review), `frontend-design`, `fixing-accessibility`; `impeccable-finish-reviewer` before submit.

## Stack (fewest moving parts)
User decision: patient app is **native (Expo / React Native)**.
- npm-workspaces monorepo:
  - `apps/web` — Next.js 15 + TS: clinician web `(clinician)`, ops dashboard `(ops)`, and **all API routes** (the only backend; the mobile app calls it). Tailwind, Framer Motion. SQLite/JSON-file audit. Dockerfile + Vercel deploy.
  - `apps/mobile` — Expo (SDK current stable) + Expo Router + Reanimated; patient app. Judges get it three ways: Expo Go QR, `expo export --platform web` hosted URL, and the iOS Simulator recording in the video.
  - `packages/shared` — `types.ts` (contracts), `i18n` strings (TH/IT/EN), design tokens (colors, type scale, motion durations) consumed by both web (CSS vars) and mobile (StyleSheet).
- Model client: OpenAI-compatible fetch to AMD tokenfactory (`AMD_BASE_URL`, `AMD_API_KEY`, `AMD_MODEL`) — single file, mock fallback only for tests.
- Eval: `npm run eval` Node script → `eval/results.json` + `eval/REPORT.md`.

## Team — role-based (each role = one agent with its own brief, owned folder and deliverable)
| Role | Model | Owns (folder) | Deliverables |
|---|---|---|---|
| **Project lead / orchestrator** | Opus (this session) | repo root, `lib/types.ts` | Scaffold, shared contracts, assigns work, merges, resolves conflicts between roles, final integration |
| **Doctor (clinical lead)** | Opus agent | `docs/clinical/` | Clinical spec: required intake fields, ~15 red-flag rules with guideline sources (PubMed MCP), escalation thresholds, what a nurse/GP needs on one screen; reviews gold labels; clinical sign-off on demo + claims |
| **Medical researcher** | Sonnet agent | `docs/research/`, `data/cases/` | Problem evidence (language barrier, intake time, misread intakes — cited); 40 synthetic TH/IT/EN intake transcripts with gold labels (incl. hidden red flags, code-switching, missing info); doctor reviews |
| **AI researcher** | Opus agent | `docs/ai/`, `eval/` | Pipeline design (prompts, JSON schema, verifier method, abstain thresholds), Gemma variant choice on AMD, **pre-declared** metrics + eval harness, runs eval on AMD, writes `eval/REPORT.md` (incl. failures) |
| **AI engineer** | **Codex (ChatGPT Pro)** via `codex` skill | `lib/pipeline/`, `app/api/`, `Dockerfile` | AMD/Gemma client, redaction, red-flag engine, extraction, verifier, next-question, audit log, API routes, unit tests, Docker, Vercel deploy |
| **Design lead (UI/UX)** | Opus agent + design skills | `docs/design/`, `components/ui/`, `app/globals.css`, `lib/i18n.ts` | Direction doc + tokens + motion language + core components (highlighter, ink-confidence, red-flag interrupt, language morph) — built first so all surfaces share them; finish review at the end |
| **Patient mobile builder** | Sonnet agent + `vercel-react-native-skills`, `mobile-app-ui-design`, `apple-design` | `apps/mobile/` | Expo patient app on shared tokens: chat, follow-ups, red-flag screen, status; verified in iOS Simulator |
| **Clinician web builder** | Sonnet agent | `apps/web/app/(clinician)/` | Review workspace on the design system |
| **Ops dashboard builder** | **Codex (ChatGPT Pro)** | `apps/web/app/(ops)/` | Queue, escalations, live metrics, eval charts (`dataviz` rules) |
| **Pitch lead** | Sonnet agent | `pitch/` | Deck (6–8 slides, English), cover image, short/long description, 3-min video script, safety section answering Track 2's 5 bullets |
| **Cross-vendor review / red team** | Codex reviews Claude's code; Claude (Opus) reviews Codex's code | read-only | Code review; adversarial cases (prompt injection in patient text, buried red flags, code-switching, PII leakage) |
| **Clinical safety reviewer** | `clinical-safety-reviewer` agent, read-only | — | Final claims/flow check before submit |
| **You (human)** | — | — | lablab + AMD ADP signup, tokenfactory key, create GitHub repo, record video, submit form |

Models: **Opus = Claude Opus 5.5 (`claude-opus-5-5`)**, **Sonnet = Claude Sonnet 5.5 (`claude-sonnet-5-5`)** — every Agent call passes `model` explicitly. Codex = ChatGPT Pro via `codex` skill.

## Reporting (every role, every wave)
- **Each agent ends every task with a report** in `docs/reports/<wave>-<role>.md`: STATUS (done / partial / blocked), what was built (files), tests run + results, evidence (screenshots, numbers), assumptions, risks, open questions, next action. No report = not done.
- **Orchestrator verifies, not trusts**: re-runs tests / opens the screen before accepting a report; rejects with reason if evidence is missing.
- **`docs/PROGRESS.md`** — one live board: role × status × last update time × blocker; updated at every wave boundary.
- **Report to you in Thai at each checkpoint** (end of spec wave ~14:30, ~16:00, ~20:00, ~23:00, ~01:00, Sun ~10:00, ~13:00): what's done, demo screenshot, numbers, risks, decisions needed — sent as a short message + file (so you can read on phone), plus a push notification for blockers.
- Final **submission report**: what was submitted, links, metrics, known limitations.

Rules: each role edits only its own folder (worktree isolation) → no merge conflicts. Contracts in `lib/types.ts` change only via orchestrator. Reviewers never fix what they review.

## Timeline (ICT)
- **Sat 12:30–13:30** Orchestrator: scaffold repo + `lib/types.ts`. You: register, get AMD key.
- **13:00–14:30 Spec wave (parallel):** Doctor → clinical spec; Medical researcher → problem evidence + case outline; AI researcher → pipeline design + metrics; Design lead → direction doc + tokens. Orchestrator reconciles into `SPEC.md`.
- **14:30–16:00:** Design lead builds core components; Codex starts pipeline against `lib/types.ts` + mock.
- **16:00–20:00 Build wave (parallel):** Codex → pipeline/API + ops dashboard; Sonnet → patient mobile + clinician web; Medical researcher → 40 cases, doctor reviews labels; AI researcher → eval harness. Orchestrator smoke-tests Gemma on AMD when key arrives.
- Scope guard: if behind at 20:00, cut in this order — voice input → ops eval charts → Italian (keep TH/EN); if Expo build is broken at 22:00, demo the Expo web export instead. Never cut: red-flag interrupt, evidence highlight, approve/edit, AMD call.
- **19:00–21:00** Integrate on main; Codex review + red-team; fix.
- **21:00–23:00** Run eval on Gemma-on-AMD; write REPORT.md numbers.
- **23:00–01:00** Dockerfile, Vercel deploy (key server-side), push public repo.
- **Sun 08:00–13:00** Pitch lead: deck, cover, descriptions, video script (starts drafting Sat evening); you record.
- **13:00–15:00** Doctor sign-off + clinical-safety-reviewer, final polish, submit. Buffer to 17:00.

## Demo script (3 min)
1. Problem (20s): nurse, Italian tourist, 2 minutes.
2. Patient types in Italian → follow-up question appears in Italian for missing onset → answered.
3. Clinician view in English: summary, click a field → highlights patient's sentence; one field "unsupported" in grey; confidence chips; latency badge "Gemma · AMD Instinct".
4. Thai patient mentions chest pain + sweating mid-sentence → red banner, flow stops, escalate.
5. Clinician edits a field, approves → audit log.
6. Numbers slide from eval; safety slide (5 Track 2 bullets).

## Verification
- `npm test` (pipeline unit tests: red-flag rules, verifier, redaction) green.
- `npm run eval` against AMD endpoint produces REPORT.md.
- Browser preview: both demo cases end to end; kill API key → UI shows "needs human review", not a fabricated answer.
- Deployed URL works in incognito; README `docker build && docker run` works from a fresh clone.
