# W9 clinical safety review: pre-submission (AMD Developer Hackathon ACT III, Track 2)

Reviewer: clinical-safety reviewer (independent, read-only). Repo HEAD `dfea837`, plus a working tree that other agents were editing during this review (mobile and clinician i18n, store, workspace). Line numbers are for the working tree at review time; the HEAD line is given where it differs. No product file was edited. The throwaway probes are in the session scratchpad (`p.ts`, `p2.ts`; mock provider, `persist: false`, nothing written to the repo store).

STATUS: done

## Verdict: **CONDITIONAL_PASS**

The safety architecture holds up and is mostly described honestly:
- Red flags are deterministic and checked on raw text before redaction or any model call (`apps/web/lib/pipeline/pipeline.ts:76-97`).
- The model screen is add-only.
- Missing or unverified fields show as `missing`/`unsupported`.
- Abstain paths exist.
- Clinician approval and an append-only audit log are in place.
- The mock eval is marked "NOT EVIDENCE" (`eval/REPORT.md:3`), and the public docs do not quote mock numbers.
- The holdout figure 7/10 · 3/8 can be traced to `eval/results/holdout-rules-only.md:25`.
- The pitch statistics can be traced to `docs/research/PROBLEM.md`.

Submission is blocked until the must-fix items below are done:
- One false-reassurance string on the emergency screen.
- One medication-alert regression that suppresses high interaction alerts and contradicts the written spec.
- Unmeasured AMD, "trust" and "30 seconds" claims written as present fact.
- Three limits that are not disclosed: voice data path, no clinician authentication, and redaction limits.

## MUST-FIX before submission

### MF-1 Emergency screen gives false reassurance (patient-facing, P0)
`apps/mobile/src/app/redflag.tsx:67,70`: tapping "I'm at the desk" only calls `setAtDesk(true)` locally. Nothing is sent to the server or the clinician. The screen then replaces "Show this screen to the staff" with a promise that someone is coming:
- `apps/mobile/src/i18n.ts:50` (HEAD :49) en `atDeskDone: "A nurse is coming to you. Please keep this screen open."`
- `:82` it `"Un infermiere sta venendo da lei. Tenga aperta questa schermata."`
- `:114` th `"พยาบาลกำลังมาหาคุณ กรุณาเปิดหน้าจอนี้ไว้"`

The replacement must not claim anyone was notified:
- en: `"Show this screen to the staff now. If no one is helping you, tell any member of staff straight away."`
- it: `"Mostri subito questa schermata al personale. Se nessuno la sta aiutando, lo dica subito a qualsiasi membro del personale."`
- th: `"แสดงหน้าจอนี้ให้เจ้าหน้าที่ดูตอนนี้ หากยังไม่มีใครมาช่วย กรุณาแจ้งเจ้าหน้าที่คนใดก็ได้ทันที"`

Alternative: make the button POST an event that appears on the clinician red-flag card. Keep the current string only if that is built.

### MF-2 Patient-stated "stop" silently removes high interaction alerts (pharmacy, P0, contradicts spec)
- The spec says `docs/clinical/PHARMACY-SPEC.md:71`: *"Patient-stated 'stopped' (`timing`) is shown but still checked (fail-safe)."*
- The code does the opposite:
  - `apps/web/lib/pipeline/medrules.ts:31` filters out `stoppedTiming(m.timing)`.
  - `apps/web/lib/pipeline/pharmacyExtraction.ts:100` auto-sets `status: 'discontinued'`, which the spec reserves for a pharmacist action (§5.11).
  - The detector `pharmacyContext.ts:19` matches a bare `stop`.
  - There is no entry in `docs/DECISIONS.md`.
- The real-provider path is affected too, because `pharmacyEntries` applies the same context at `pharmacyExtraction.ts:92`.
- Probe results (mock, end to end through `runTurn`):

| Patient text | Result |
|---|---|
| "I can't stop taking ibuprofen for my back, and I take warfarin every day." | ibuprofen `discontinued`, **no MR-INT-01 (high bleeding)** |
| "The doctor told me to stop aspirin but I still take aspirin and warfarin." | aspirin `discontinued`, **no alert** |
| "I stopped taking warfarin yesterday. I take ibuprofen…" | no alert, although warfarin's effect lasts for days |

- **Fix:** restore the spec.
  - Remove `&& !stoppedTiming(m.timing)` at `medrules.ts:31`.
  - Do not auto-assign `'discontinued'` at `pharmacyExtraction.ts:100`; keep `supported` and show `timing` as "patient says stopped, verify".
  - Only a pharmacist `discontinue` action removes a drug from alerting.
  - Change the w9 regression tests that pin the current behaviour.
- If the team prefers the current behaviour, it needs the Doctor's sign-off, a PHARMACY-SPEC update and a DECISIONS entry, and the stop detector must at least reject `can't/cannot stop`, `told me to stop … but`, and `still take`. I do not recommend this for the submission.

### MF-3 Unmeasured AMD / Instinct / ROCm claims written as present fact
All runs so far are mock runs (`eval/REPORT.md:3,161-170`). `docs/ai/DESIGN.md:35` records that Token Factory hardware and model ids are not public. `config.ts:26` already defaults to the honest label `'AMD (via Token Factory)'`; the UI and docs should match it.

| Location | Current | Replace with |
|---|---|---|
| `README.md:3` | "Gemma runs on AMD Instinct GPUs through AMD Token Factory." | "Model calls are built for Gemma on AMD Token Factory (integration pending a key; current runs use a labelled mock)." |
| `README.md:28` (mermaid) | `subgraph G["Gemma on AMD Instinct (Token Factory)"]` | `subgraph G["Gemma via AMD Token Factory (pending; mock today)"]` |
| `README.md:54` | "All model calls … go to **Gemma served on AMD Instinct GPUs through AMD Token Factory**" | "All model calls … are designed to go to **Gemma on AMD Token Factory** … (not yet run against the live endpoint)" |
| `pitch/SUBMISSION.md:17` | "…Red flags escalate to a human. Gemma on AMD. Research prototype, synthetic data." | "…Red flags escalate to a human. Built for Gemma on AMD. Research prototype, synthetic data." (stays ≤255 chars) |
| `pitch/SUBMISSION.md:29` | "Gemma, served on AMD Instinct GPUs (ROCm) through the hackathon Token Factory, does three jobs" | "Gemma, served through the hackathon AMD Token Factory, is designed to do three jobs". Keep the existing "pending our key" sentence. |
| `pitch/SUBMISSION.md:49` (tags) | "AMD Instinct, ROCm, … vLLM" | "AMD Token Factory". Drop Instinct/ROCm/vLLM unless the console confirms them; vLLM appears nowhere in this repo. |
| `pitch/deck/deck.html:176` | "Gemma on AMD Instinct, behind one gateway" | "Gemma on AMD Token Factory, behind one gateway" |
| `pitch/deck/deck.html:180` | "Gemma on AMD Instinct (ROCm)." | "Gemma on AMD (hardware per Token Factory; key pending)." |
| `pitch/VIDEO-SCRIPT.md:9` VO | "The footer shows the model: Gemma, served on AMD Instinct GPUs." | "The footer shows which model produced it, and says so honestly when it is a mock." |
| `apps/web/app/(clinician)/review/_workspace.tsx:597` (HEAD :581) | `"Gemma · AMD Instinct"` hard-coded for any `amd-tokenfactory` call, whatever `ex.model` is | `` `${ex.model} · AMD Token Factory` ``, or use the `hardware` value from `/api/health` as `SystemLedger.tsx` does. Never write "Instinct" unless `AMD_HARDWARE_LABEL` says so. |

If the live AMD run happens before submission, fill the `[TBD-METRIC]` slots only from `eval/REPORT.md`. Keep "Instinct/ROCm" out unless the hardware is confirmed.

### MF-4 "Trust" and "30 seconds" are unmeasured claims
"30 s" is a design target (`docs/clinical/SPEC.md:11`). No timed study has run (METRICS M7 is a word ratio, and its timed test is optional and anecdotal). "Trust" implies validated reliability, but even the mock capture recall is 37.8%, below its threshold.

| Location | Replace with |
|---|---|
| `README.md:3` "that a clinician can check in 30 seconds" | "designed so a clinician can check it in about 30 seconds (design target, not yet measured)" |
| `pitch/deck/deck.html:71` "Multilingual intake that a nurse and a pharmacist can trust in 30 seconds." | "Multilingual intake designed to be checked in 30 seconds, with every field pointing back to the patient's own words." |
| `pitch/VIDEO-SCRIPT.md:15` "MedX Bridge: the intake a nurse can trust in thirty seconds." | "MedX Bridge: every field points back to the patient's own words." |
| `pitch/SUBMISSION.md:9` title option 2 | Drop it, or use "MedX Bridge: intake that shows its evidence". |
| `apps/web/app/(clinician)/review/_i18n.ts:25` `landTitle` | en "MedX Bridge: multilingual intake, checked against the patient's words" · th "MedX Bridge: รับข้อมูลหลายภาษา ตรวจกับคำพูดของผู้ป่วยได้ทุกช่อง" · it "MedX Bridge: accettazione multilingue, verificabile sulle parole del paziente" |

### MF-5 Three limits are not disclosed in the public safety story
The Track 2 brief asks how sensitive information and human review are handled. These limits are true today and appear nowhere in `README.md`, `pitch/SAFETY.md` or `pitch/SUBMISSION.md`:

1. **Voice data path.** `apps/mobile/src/voice.ts:57` starts OS speech recognition without on-device mode. Raw, unredacted audio therefore goes to Apple (iOS) or Google (Android or Chrome Web Speech) before any redaction. This was disclosed only in an internal report (`docs/reports/w7-patient-mobile-voice.md:30`). The permission string at `apps/mobile/app.json:34` does not name the third party.
2. **No clinician authentication.** `reviewerId` is self-asserted. Any client that can reach the API can approve, take over, mark false alarms and read every transcript (`GET /api/sessions`). CORS (`apps/web/app/api/_http.ts:4-10`) restricts browsers only. The gap is acknowledged in w6 #9 and w7 but missing from the public docs. `pitch/SAFETY.md:11` "Nothing is final until a clinician approves" is enforced by workflow, not by identity.
3. **Redaction is pattern-based** (`apps/web/lib/pipeline/redact.ts`). It misses identifiers that are not introduced by a trigger phrase. It also over-redacts clinical text: the probe turned "3 days ago I saw the dr" into `[ADDRESS_1]`, and "I take 20 mg every day since my dr changed it" into "I take [ADDRESS_2] changed it". Onset and dose are lost before storage and model use. The cause is the `dr|st|rd` suffixes in the ADDRESS regex at `redact.ts:29`. Red flags are not affected, because they run on raw text first.

Fix: add the following three bullets to `pitch/SAFETY.md` "What we do not claim" (after line 17) and to `pitch/SUBMISSION.md:43` Limitations. Also add the voice sentence to the mobile `privacy` string (`apps/mobile/src/i18n.ts:34/66/98`).
- "Voice input uses the phone's speech service (Apple or Google), which may process audio on their servers before our redaction runs. Typing avoids this."
- "The demo has no clinician login; reviewer identity is self-declared. Approval is enforced by workflow, not by authentication."
- "Redaction is pattern-based: it can miss identifiers and occasionally hides clinical words."

Patient `privacy` string additions:
- en: "Voice uses your phone's speech service (Apple or Google)."
- it: "La voce usa il servizio vocale del telefono (Apple o Google)."
- th: "การพูดใช้บริการแปลงเสียงของโทรศัพท์ (Apple หรือ Google)"

Optional code fix for item 1: pass `requiresOnDeviceRecognition: true` where the OS supports the language. For item 3: require a capitalised street word, or drop `dr|st|rd`.

### MF-6 Absolute guarantee about prompt injection
`pitch/SAFETY.md:7` says "prompt-injection text in patient messages is treated as data and **cannot create a supported fact**". The evidence does not support this:
- `eval/REPORT.md:110-119` shows abstain recall 0/6, including injection cases EN-12 and TH-12, which "ended collecting" even though `docs/clinical/SPEC.md:84` says to abstain.
- The manual injection check is still pending.
- Any patient sentence, injected or not, can verify as a quote.

Replace with: "prompt-injection text in patient messages is wrapped and treated as data, and any shown fact still needs a verbatim patient quote; injection cases are listed for manual check in eval/REPORT.md."

### MF-7 Stale numbers and docs in public files
- `README.md:105`: "722 tests in 10 files" → "1,041 tests in 13 files (17 Oct 2026)". The deck already says 1,041 (`deck.html` slide 6).
- `docs/ARCHITECTURE.md:48`: "`GET /api/demo/reset` (gated by `DEMO_SEED=1`)" → "`POST /api/demo/reset` (requires `DEMO_SEED=1`, `DEMO_TOKEN` and the `x-demo-token` header)".
- `pitch/VIDEO-SCRIPT.md:11`: "Keyword rules alone caught 7 of 10 emergencies on a blind test set…" → "…on a small synthetic blind test set…" so the spoken metric carries its caveat.

## SHOULD-FIX

1. **Urgent messages promise priority** (`packages/shared/src/redflags.json:166,464,1086,1130,1202` en; same in it/th).
   - "You will be seen as a priority" is a queue promise that only staff can make. The Thai `คุณจะได้รับการตรวจก่อน` is stronger still ("you will be examined first").
   - The urgent messages also give no instruction for getting worse or for being away from the clinic.
   - Suggest: en "Please tell the nurse at the desk now. If you feel worse, tell staff straight away. If you are not at the clinic, call 1669 in Thailand or 112 in Europe." with matching it/th.
   - Owner: Doctor. This matches the SPEC §3 wording, so update the spec too.
2. **Thai, Italian and English discrepancies** in patient messages (Thai needs native review):
   - Emergency messages in TH omit "or 112 in Europe" (`redflags.json` th lines), but the mobile help screen in TH includes it (`i18n.ts` th `helpEmergency`).
   - RF-SUICIDE-01 TH adds the mental-health hotline 1323 (`redflags.json:639`); EN and IT have no crisis line.
   - IT is gendered or informal in places: `Sarà visitato`, `è venuto`, `Benvenuto`, `Ciao` (formal elsewhere). Use `Sarà visitato/a` or rephrase, and `Buongiorno`.
   - TH `chipNo: "ไม่ใช่"` reads as "that's not right" for allergy or medication questions; `ไม่` or `ไม่มี` would be clearer.
3. **Waiting-status copy** (`apps/mobile/src/app/done.tsx:59`). The status said "A nurse is reading your answers now" as soon as the answers were sent. The working tree already changes it to "Your answers are waiting for a nurse"; make sure that edit is committed.
4. **Voice provenance is not shown to the clinician.** `inputMode: "voice"` is stored (turns route) but no clinician component renders it, although `w7-patient-mobile-voice.md:31` says the clinician sees it. Add a "voice (speech-to-text, confirmed by patient)" tag on transcript turns.
5. **Over-escalation, safe direction.** Bare Thai `ไม่เจ็บหน้าอก` still escalates (w9 residual R4). List it as a known false-alarm source in `docs/clinical/SPEC.md` §7.
6. **Case counts.** `pitch/SUBMISSION.md:38` says "n = 40 cases" and deck slide 6 says 52. State "40 evaluated; 12 medication cases added later, not yet in eval/REPORT.md".
7. **Overstated fix claim.** `pitch/deck/deck.html:142` says "the findings were fixed with regression tests". Several were not: no clinician authentication (w6 #9), lay paraphrases, bare Thai negation. Say "most findings were fixed…; the remaining ones are listed as limits".
8. **Pharmacy fixture note** (`apps/web/app/(pharmacy)/_lib.ts`, `fixtureNote`): "the engine does not return medicines yet" is stale now that the engine returns medications. Check that it only appears in `?fixtures=1` mode.
9. **Number written as approximate.** `pitch/SUBMISSION.md:35` and `pitch/SAFETY.md:10` say "About 18 … rules", but there are exactly 18 (`redflags.json`, v1.1). Write "18".
10. **Suicide-risk paraphrases.** The probe confirmed that "I keep thinking about ending my life", "I don't want to live anymore" and "I want to kill myself" all fire RF-SUICIDE-01. The holdout miss HO-04 (a passive death wish plus stockpiled pills) shows that indirect wording still slips through. Ask the Doctor to extend the terms using a new blind set, never the holdout.

## Track 2 bullets: is each one backed by a mechanism in code?

| Brief bullet | Mechanism (code) | Honestly limited in public docs? |
|---|---|---|
| Incorrect or unsupported responses | `verify.ts` (quote must exist; negation-aware since w7), `schema.ts`, `approve` refuses unsupported or missing fields | Mostly. "Verifier proves a quote exists, not its meaning" is stated. The injection guarantee is overstated (MF-6). |
| Sensitive information | `redact.ts` before storage and model calls; keys only from env (`config.ts`, `llm.ts`); `.env` not committed (only `.env.example`); all data files `synthetic: true` | **No.** The voice path and redaction limits are undisclosed (MF-5). |
| Uncertain results | `pipeline.ts` abstain block (provider or schema error, low confidence, 40 s deadline); per-field confidence | Yes, though abstain recall on the case set is 0/6 (mock). Report it next to the fault-injection 18/18. |
| High-risk decisions | `redflags.ts` on raw text first (`pipeline.ts:76`), zero model calls after a hit, add-only `redFlagScreen.ts`; med alerts in code (`medrules.ts`) | Red flags: yes (7/10 holdout disclosed). **Med alerts: regression (MF-2).** The model screen is unmeasured; it must not be implied to close the recall gap until the AMD run. |
| Human review | review, takeover and pharmacy-review routes; append-only audit (`store.ts`); false alarm requires a note; 409 takeover on approved | **No clinician authentication disclosed (MF-5).** |

## Data and privacy

- Public repo: only `.env.example` is committed. No store or `.data` files are tracked. Every case in `data/cases` and `data/holdout` carries `synthetic: true`.
- The demo reset and seed routes are POST-only and need `DEMO_SEED=1`, `DEMO_TOKEN` and the `x-demo-token` header (`_http.ts:46-49`). `docker-compose.yml:10` defaults `DEMO_SEED` to 0.
- The patient privacy note asks users not to enter real identifiers (`i18n.ts:34`).
- Residual risks:
  - Voice audio goes to the OS vendor.
  - With no authentication, any public deployment exposes every transcript. Vercel is not yet approved (`docs/DECISIONS.md:10`); keep it that way, or put the clinician routes behind a token first.

## Font and branding (residual risk only)

`SCBXBeta2-{Light,Regular,Bold}.otf` are committed in `apps/web/app/fonts/` and `apps/mobile/assets/fonts/`. Their metadata reads "Copyright (c) 2022 by __Designer__. All rights reserved." and they carry no license text. The repo `LICENSE` is MIT, which a reader may take to cover the fonts. The owner accepted this risk (`docs/DECISIONS.md:9`). It is not a blocker. A one-line `NOTICE` saying the fonts are excluded from the MIT grant would reduce confusion.

## Ready-to-paste "Limitations & safety" (118 words)

> Research prototype that supports clinicians; it does not diagnose, triage, treat or prescribe, and nothing is final until a clinician approves. Synthetic data only; not clinically validated, not a medical device. Deterministic red-flag rules run before any model and no model output can clear them, but keyword rules miss paraphrases (7/10 emergencies caught on an 18-case synthetic blind holdout). The add-only Gemma screen is not yet measured on AMD; current results use a mock model. Fields without a verified patient quote show as unsupported; errors or low confidence give "needs human review". Limits: redaction is pattern-based and imperfect, voice input uses Apple or Google speech services, the demo has no clinician login, and Thai/Italian text awaits native-speaker review.

## FILES READ
`CLAUDE.md`, `docs/clinical/SPEC.md`, `docs/clinical/PHARMACY-SPEC.md`, `docs/ai/DESIGN.md` (grep), `docs/ai/METRICS.md`, `eval/results/holdout-rules-only.md`, `eval/REPORT.md`, `README.md`, `docs/ARCHITECTURE.md`, `pitch/{SUBMISSION,VIDEO-SCRIPT,DECK-OUTLINE,SAFETY}.md`, `pitch/deck/deck.html`, `docs/DECISIONS.md`, `docs/reports/{w6-engine-review,w9-ai-engineer,w7-qa-bugs,w7-patient-mobile-voice}.md`, `docs/research/PROBLEM.md` (grep), `packages/shared/src/{redflags,medrules}.json`, `apps/mobile/src/{i18n.ts,voice.ts,app/redflag.tsx,app/done.tsx}`, `apps/mobile/app.json`, `apps/web/app/api/{_http.ts,demo/reset,dev/seed}`, `apps/web/lib/pipeline/{pipeline,medrules,pharmacyContext,pharmacyExtraction,redact,config}.ts`, `apps/web/app/(clinician)/review/{_i18n.ts,_workspace.tsx}`, `apps/web/app/(pharmacy)/_lib.ts`, `apps/web/app/(ops)/{ops-data.ts,components/SystemLedger.tsx}`.

## FILES MODIFIED
This report only.

## TESTS RUN
Read-only probes through `npx vite-node` (mock provider, non-persisted sessions): the redaction probe and the end-to-end stopped-medication probe whose results are quoted in MF-2 and MF-5. I did not rerun the vitest suite. Test counts are quoted from `docs/reports/w9-ai-engineer.md`.

## DECISIONS REQUIRED
- MF-2: restore the fail-safe for stopped medicines as PHARMACY-SPEC says (recommended), or have the Doctor sign off on the change with a DECISIONS entry.
- MF-1: change the copy (recommended), or build an "at desk" signal to the clinician.

## RECOMMENDED NEXT ACTION
Apply MF-1 to MF-7 (copy and doc edits plus a two-line engine revert for MF-2 with its tests), rerun `npm --prefix apps/web test`, then do a last grep for `Instinct|ROCm|trust|30 seconds` across `README.md`, `pitch/` and `apps/`.
