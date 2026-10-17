# W7 QA bug hunt (MedX Bridge)

Date: 17 Oct 2026, run after `docs/reports/w7-ai-engineer.md` appeared. Tester: QA agent. No product file was edited.
All repro scripts are in `qa/` (node `.mjs`, `fetch`, no dependencies). Run one with `BASE=http://localhost:3000 node qa/<script>.mjs` (BASE defaults to :3000). Each prints PASS/FAIL per check and a `SUMMARY` line.

Targets: the dev server on :3000 (mock model, hot-reloading Codex wave-8 edits) and, for the build checks, a production build of a temp copy (`/tmp/mb-qa`, since deleted) started on :3200 with its own store. Every API script was run against both and gave the same failures, except for store contents. I did not call the demo reset on :3000.

## Summary table

| Area | Script | Checks | Pass | Fail | Result |
|---|---|---|---|---|---|
| 1 API contract (all routes, shapes, ApiError, CORS, 404/405, bad JSON, wrong types, 413) | `01-contract.mjs` | 87 | 87 | 0 | clean |
| 1b HTTP edge (chunked 100KB body, bad UTF-8, BOM, `__proto__`, deep JSON, HEAD, trailing slash) | `09-http.mjs` | 11 (+1 with `CAPACITY=1`) | 11 | 0 (+1 fail, see P2-3) | clean |
| 2 Patient edge inputs (blank, 4000/4001 chars, emoji, RTL, NFC/NFD, injection, races, inputMode, turn gates) | `02-edge.mjs` | 77 | 75 | 2 | P2-2 (+1 non-bug, see note) |
| 3 Safety invariants end to end (red flags, negation, PII, review rules, pharmacy gate) | `03-safety.mjs`, `07-repros.mjs` | 72 + 26 | 64 + 9 | 8 + 17 | P0-2, P1-5, P1-6, P1-3, P2-1 |
| 3b Negation of allergies/meds | `12-allergy-negation.mjs`, `13-med-negation.mjs` | 8 + 5 | 4 + 0 | 4 + 5 | P1-1, P1-2 |
| 3c Review memory (edit/approve/reject survive turns, conflict) | `11-review-memory.mjs` | 8 | 8 | 0 | clean |
| 3d Patient-facing language | `10-lang.mjs` | 8 | 8 | 0 | clean |
| 4 State machine, audit append-only | `04-state.mjs` | 46 | 42 | 4 | P1-3, P1-4 |
| 4b Metrics recount and store coherence | `05-metrics.mjs`, `06-store-coherence.mjs` | 1 + 5 | 0 + 3 | 1 + 2 | P1-4 |
| 4c Data invariants over every stored session (evidence offsets, localized strings, status vs summary) | `08-invariants.mjs` | 9 | 8 | 1 | not a bug (B-011 is an intentional abstain demo) |
| Clinician summary vs pharmacist list | `14-meds-field.mjs` | 3 | 0 | 3 | P1-7 |
| 5 Build and run | see below | | | | P2-4, P2-5, P2-6; P0-1 is docs |
| 6 Mock eval | `eval/run.ts` | n/a | exit 0 | | fine |

About 363 scripted checks, 319 pass. The 44 failures are repeats of 15 distinct findings. Several checks overlap between scripts on purpose.

Build and run results:
- `cd apps/web && npx vitest run`: 12 files, **951 tests passed**. An earlier run during Codex's wave-8 edits showed 5 failures, 4 in the then half-written `wave8.test.ts` and one `wave5` reset test timing out at 5 s under load (P2-6). A later run was green.
- `npx tsc --noEmit`: clean at the end. It briefly showed 3 errors in the unfinished `wave8.test.ts`.
- `npx eslint .`: 13 errors, 4646 warnings, all in the gitignored generated `public/patient/_expo/**` bundle (P2-5). `npx eslint lib app` is clean.
- Production build in the temp copy: `npm run build` (`next build --turbopack`, same as the Dockerfile) **succeeds**. Plain `npx next build` fails (P2-4).
- Standalone server on :3200 (`MODEL_PROVIDER=mock`, `DEMO_SEED=1`): `/`, `/review`, `/review/<id>`, `/pharmacy`, `/pharmacy/<id>`, `/ops`, `/patient` all return 200 with no "Application error" in the HTML. `/nonexistent` returns 404. The seed (POST reset with token) created 11 sessions with `mismatches: []`: B-001/002 escalated, B-003/004 awaiting review, B-005/011 needs human, B-006/007/009/010 collecting, B-008 approved. The server is stopped.
- Mobile: `npx tsc --noEmit` and `npx expo lint` both exit 0.
- Mock eval (`--split dev`): exit 0. Holdout red-flag recall was 7/10, the same as the W7 engineer's report. `eval/REPORT.md` was restored from backup and the new `eval/runs/<ts>` folder I created was deleted.

Not re-reported: known demo limit of no clinician auth (w6 #9, declared in w7), and every w6 finding that the new tests and my scripts show as fixed. Fixed and re-verified: Thai self-introduction plus red flag (all 10 variants escalate), cross-turn negation leak, escalation keeping earlier fields, 409 on approved/taken_over, the 20-turn cap, `inputMode` stored on turn and audit, `""` clear on pharmacy dose/frequency/reaction, false_alarm needing a note (red flag and alert), the reset endpoint being POST plus token, CORS allow-list, and the streamed 413.

---

## P0 (breaks the demo script or a safety invariant)

### P0-1 The documented demo reset command no longer works
- Repro: `curl -i localhost:3000/api/demo/reset`, or `node qa/07-repros.mjs` (check R8). `docs/DEMO.md:11`, `:59`, `docs/DEMO.md:27`, `README.md:63` and `README.md:95` ("`DEMO_SEED=1` enables `GET /api/demo/reset`") all still say GET without a token.
- Expected: the runbook's step 0 works as written.
- Actual: `HTTP 405`. The route is now `POST` and needs `DEMO_SEED=1`, `DEMO_TOKEN` and header `x-demo-token`. The server currently on :3000 has neither env var set: `curl -X POST localhost:3000/api/demo/reset -H "x-demo-token: x"` returns `404 {"error":"Not found","code":"not_found"}`. So seeding the 11 demo cases needs a server restart with `DEMO_SEED=1 DEMO_TOKEN=...`. The README docker one-liner has the same gap (no `DEMO_TOKEN`).
- Suspected files: `docs/DEMO.md`, `README.md`, `docs/ARCHITECTURE.md:63`. The correct command is already in `docs/reports/w7-ai-engineer.md` "NEXT ACTION".

### P0-2 Thai full names leak the surname into stored text, responses and audit (invariant 5)
- Repro: `node qa/07-repros.mjs` (R1, R1b) and `node qa/03-safety.mjs` (S11).
- Input: `ผมชื่อสมชาย ใจดี ปวดหัวตั้งแต่เมื่อวาน`
- Expected: both name tokens redacted.
- Actual: stored turn text is `[NAME_1] ใจดี ปวดหัวตั้งแต่เมื่อวาน`. The surname is returned by the turn response, `GET /api/sessions`, `GET /api/sessions/:id` and the audit payload. `ดิฉันชื่อ มาลี รักสุข อายุ 30 ปี ปวดท้อง` becomes `[NAME_1] รักสุข อายุ 30 ปี ปวดท้อง`.
- Cause: the W7 fix deliberately limits a Thai name to one token of at most 20 characters (needed so `ผมชื่อสมชาย เจ็บหน้าอก` keeps the red-flag text). Every Thai person has a surname, so a full name is the normal input. The red-flag fix is fine; only the surname is missed.
- Suspected file: `apps/web/lib/pipeline/redact.ts`, the last `replace('NAME', …)` (Thai). Allow a second Thai token only when it is not a symptom stem, using the same stop-list already in the regex.

---

## P1 (wrong behaviour a judge could see)

### P1-1 A denied allergy is stored as a verified patient allergy and raises a high allergy-conflict alert
- Repro: `node qa/12-allergy-negation.mjs` (4 of 8 fail) (first case: new session, turn `I am not allergic to penicillin. I take Augmentin 625 mg twice a day. Sore throat since yesterday.`)
- Expected: no allergy entry and no `allergy_conflict` alert.
- Actual, from the response:
  `allergies: [{"allergenOriginal":"penicillin","allergenClass":"penicillin","evidence":[{"quote":"penicillin","start":21,"end":31}],"status":"supported"}]`, `medAlerts: [MR-ALLERGY-PEN, high, "…conflict with an allergy the patient reported."]`. The same happens for `I have never been allergic to penicillin`, Italian `Non sono allergico alla penicillina` and Thai `ไม่แพ้เพนิซิลลิน`. The clinician summary field `allergies` stays `missing`, so the clinician and pharmacist views disagree. `No allergy to penicillin` is handled correctly.
- Why it is not only the mock: the evidence quote is just `penicillin`; the denial sits outside the quote and `verify.ts` does not look at the words before it, so a live model that returns the same entry would verify too.
- Suspected files: `apps/web/lib/pipeline/mock.ts` (`mockPharmacy`, denial handling at line 15 to 40 only covers `no allergies`-style phrases), `pharmacyExtraction.ts` and `verify.ts` (no preceding-denial check on allergy and medication spans).

### P1-2 Denied or past medications are listed as current, trigger high interaction alerts, and timing is attributed to the wrong drug
- Repro: `node qa/13-med-negation.mjs` (0 of 5 pass).
- Inputs and actual results:
  - `I do not take warfarin. I take ibuprofen 400 mg.` gives meds `warfarin, ibuprofen` and `MR-INT-01` high.
  - `I never take ibuprofen, only paracetamol.` lists ibuprofen.
  - `I stopped taking warfarin last year. I take ibuprofen.` lists both with timing `"stopped taking"`, so currently taken ibuprofen is shown as stopped.
  - Italian `Non prendo warfarin` and Thai `ไม่ได้กินวาร์ฟาริน` list warfarin and raise `MR-INT-01`.
- Expected: denied drugs are not listed (or are marked discontinued), no alert from them, and timing is per drug.
- Impact: the alert is on the conservative side, but the pharmacist sees "supported" medications the patient said they do not take. This is the demo case B-011 theme.
- Suspected file: `apps/web/lib/pipeline/mock.ts` `mockPharmacy` (timing assigned across the sentence) and `pharmacyExtraction.ts`.

### P1-3 A clinician takeover is accepted on an already approved session
- Repro: `node qa/07-repros.mjs` (R5) or `node qa/04-state.mjs` (T07).
- Flow: create session, send `Headache since yesterday 7/10. I am 45 years old. I am not pregnant. I have no allergies. I take no medications.`, approve every field (status `approved`), then `POST /api/sessions/:id/takeover {"reviewerId":"dr2"}`.
- Expected: 409, or at least the approval stays recorded in the status.
- Actual: `200`, `status: "taken_over"`. The session leaves the `approved` state and the metrics `approved` count drops. Turns after approval are correctly 409, so this is inconsistent with that gate.
- Suspected file: `apps/web/lib/pipeline/pipeline.ts` `takeover()` (no status check).

### P1-4 Ops metrics disagree with the clinician queue (abandoned starts)
- Repro: `node qa/05-metrics.mjs`, `node qa/06-store-coherence.mjs` (K01, K04), `node qa/07-repros.mjs` (R7).
- Actual on :3000: `GET /api/sessions` returns 181 sessions, `GET /api/metrics` sums to 250 (`collecting` 156 in metrics vs 89 in the list). Cause: `listSessions()` now hides sessions with no patient turn (wave 8), but `metrics()` still counts them. `sessionsToday` and `byStatus.collecting` are therefore inflated by every "Start intake" tap that was never answered. A judge sees the ops "collecting" number not match the queue.
- Expected: the same filter in both places, or a deliberate separate "not started" bucket.
- Suspected file: `apps/web/lib/pipeline/pipeline.ts` `metrics()` (uses `getSessions()` unfiltered). Note this was observed while Codex was editing the file; re-run `node qa/05-metrics.mjs` after wave 8 lands. It may be filtered already.

### P1-5 Deterministic red-flag matcher misses simple spelling and spacing variants
- Repro: `node qa/07-repros.mjs` (R3) or `node qa/03-safety.mjs` (S08). Sent as turn 1 in a fresh session. Expected `escalated`, actual `collecting`, `redFlags: []`:
  - `chest-pain and sweating` (hyphen)
  - `chest​ pain and sweating` (zero-width space)
  - `ｃｈｅｓｔ ｐａｉｎ and sweating` (full-width Latin)
  - `เจ็บ หน้า อก มาก เหงื่อ ออก` and `ฉัน หายใจ ไม่ ออก` (Thai written with spaces between words)
  Passing for reference: UPPERCASE, double space, newline, tab, NBSP, emoji, `chest pains`, `can't` and `can’t breathe`, NFD Italian.
- Why it matters: invariant 1 says deterministic rules catch these; speech-to-text (new voice mode) can insert spaces into Thai.
- Suspected file: `apps/web/lib/pipeline/redflags.ts` `normalise()`: apply NFKC, strip `\p{Cf}` zero-width characters, map `-` to space, and for Thai compare after removing all spaces.
- Not reported as bugs (lay phrasing, covered by the model screen on a live provider): `my chest is killing me, cold sweat`, `ho un dolore all'altezza del petto e sudo freddo`.

### P1-6 Birth date and street address are not redacted
- Repro: `node qa/07-repros.mjs` (R2, R2b, R2c, R2d) and `node qa/03-safety.mjs` (S10).
- Input: `I was born 15/03/1985 and I live at 12 Sukhumvit Road Bangkok.` Stored turn text is unchanged, so `15/03/1985` and `12 Sukhumvit Road` appear in every response and audit. Also unredacted: `My date of birth is 15 March 1985` and Italian `nata il 15 marzo 1985` (the DOB regex only fires on `born on` / `date of birth` followed directly by a number, so these forms slip through). Phones, emails, 13-digit IDs, passports and codice fiscale are redacted correctly.
- Expected: at least DOB forms redacted. Addresses are hard for regex; document as a known limit if not fixed.
- Suspected file: `apps/web/lib/pipeline/redact.ts` DOB regex (add `born`, `date of birth is`, `nata il` with month names).

### P1-7 Clinician summary shows `medications` as missing when the patient stated one
- Repro: `node qa/14-meds-field.mjs` (0 of 3 pass; en, it, th).
- Turn: `Headache since yesterday 7/10. I am 45 years old. I take ibuprofen 400 mg twice a day.` The pharmacist list has ibuprofen (`supported`), but the clinician field `medications` is `missing` and `required: true`. A required field cannot be approved while missing, so the clinician must edit it by hand before the session can reach `approved`. This is the mock extractor only recognising "no medications" style answers; the live model likely fills it, but the mock is what runs without an AMD key.
- Suspected file: `apps/web/lib/pipeline/mock.ts` field patterns (around line 40), or derive the field from `summary.medications` in the pipeline.

---

## P2

- **P2-1 Thai negation false positive (over-escalation, safe direction).** `node qa/07-repros.mjs` (R4). `ไม่เจ็บหน้าอก แต่ปวดหัวตั้งแต่เมื่อวาน` ("no chest pain, but headache") escalates with `RF-CHEST-02`. `ไม่` is not in `negationCues` (only `ไม่มีอาการ`, `ไม่เคยมีอาการ`, `ไม่ได้มีอาการ`). English and Italian negation (`no`, `senza`, `nessun`, `non ho`) work. File: `packages/shared/src/redflags.json` (Doctor-owned).
- **P2-2 Invisible-only text becomes a patient turn.** `node qa/02-edge.mjs` (E01) or `node qa/07-repros.mjs` (R6). Text `​​` returns 200 and the assistant asks the first question; plain whitespace and NBSP are rejected with 400. File: `pipeline.ts:66` (`rawText.trim()`), strip `\p{Cf}` before the empty check.
- **P2-3 Session-code space is 1000 and exhaustion returns a client error.** `CAPACITY=1 BASE=http://localhost:3200 node qa/09-http.mjs` (H12; run only against an isolated instance). The 1000th session gets code `B-000`; after 1000 stored sessions `POST /api/sessions` returns `400 {"error":"Session code capacity reached","code":"bad_request"}`. The failure is not a client error, and the list is never pruned. A busy rehearsal plus a seed reset is enough on a long-lived store. File: `pipeline.ts:25`.
- **P2-4 Plain `next build` (webpack) fails type validation; the turbopack build passes.** In a copy of the repo: `cd apps/web && npx next build` gives `app/api/demo/reset/route.ts: Route has an invalid "OPTIONS" export: Type "Request | undefined" is not a valid type for the function's first argument.` The same failure happens on a clean `git archive HEAD`, so it is older than W7. `npm run build` and the Docker build (`next build --turbopack`) pass, so the demo path is unaffected; a Vercel build that overrides the build command would fail. File: `apps/web/app/api/_http.ts:12` (`OPTIONS(request?: Request)`) and the optional-`request` `GET` exports in `health/route.ts`, `metrics/route.ts`, `sessions/route.ts`. Make the parameter required.
- **P2-5 `npx eslint .` reports 13 errors from the generated patient web export.** All in `apps/web/public/patient/_expo/static/js/web/*.js` (gitignored, created by `scripts/build-patient-web.sh`). `npm run lint` therefore fails on any machine that has built the patient app. File: `apps/web/eslint.config.mjs`, add `public/patient/**` to ignores.
- **P2-6 Test-suite timeout flake.** `lib/pipeline/__tests__/wave5.test.ts` "demo reset endpoint … reseeds, and resets again" took 5.28 s against the 5 s default and failed once while other jobs were running (passed on rerun, 951/951). Raise the per-test timeout.
- **P2-7 Unknown ids on UI routes return HTTP 200.** `curl -o /dev/null -w "%{http_code}" localhost:3200/review/nope` is 200 (the client page renders its own not-found state; no "Application error"). Cosmetic.

Observations, not bugs: the mock extractor does not capture `I am 45` (needs `I am 45 years old`), and `I don't feel right` stays `collecting` on turn 1 (the seeded B-005 reaches `needs_human` after the third vague answer, as the seed intends). B-011 shows `allergies` as `unsupported` yet with evidence because the whole summary is abstained (`low_confidence`), which is by design.

## Script index

| Script | Purpose |
|---|---|
| `qa/lib.mjs` | helpers, shape checkers |
| `qa/01-contract.mjs` | routes, shapes, ApiError, CORS, 404/405, bad bodies |
| `qa/02-edge.mjs` | patient input edge cases, races, inputMode, gates |
| `qa/03-safety.mjs` | red flags, negation, PII, review rules, pharmacy gate |
| `qa/04-state.mjs` | state transitions, audit append-only, metrics |
| `qa/05-metrics.mjs`, `qa/06-store-coherence.mjs` | metrics vs queue |
| `qa/07-repros.mjs` | one-shot repros for P0-1, P0-2, P1-3 to P1-6, P2-1, P2-2 |
| `qa/08-invariants.mjs` | invariants over every stored session |
| `qa/09-http.mjs` | HTTP-level edges (`CAPACITY=1` only on an isolated instance) |
| `qa/10-lang.mjs`, `qa/11-review-memory.mjs` | language consistency, review memory |
| `qa/12-allergy-negation.mjs`, `qa/13-med-negation.mjs`, `qa/14-meds-field.mjs` | P1-1, P1-2, P1-7 |

Every script creates its own sessions. The dev store on :3000 now holds roughly 270 QA sessions (all synthetic, many with no turns); they inflate the queue and ops numbers and the owner may want a restart or reset (with the demo token) before recording.
