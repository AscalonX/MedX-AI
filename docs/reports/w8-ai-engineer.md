# W8 AI engineer: W7 UX audit follow-up

STATUS: done

## SUMMARY

- Added shared, deterministic handling for patient quick answers on both mock and AMD extraction paths. Bare denials and severity answers use the asked field; time chips support onset and duration. All supported values retain verified, exact patient quotes.
- Allergy denials populate `noKnownAllergiesEvidence`. Earlier chips survive later extraction when omitted, while later explicit corrections take precedence. Short answers cannot supply unrelated fields or named pharmacy entries.
- Italian follow-ups use formal Lei; Thai templates use the requested neutral question forms. The generation prompt carries the same language guidance.
- Mock hardware uses the explicitly requested U+2014 sentinel, even when `AMD_HARDWARE_LABEL` is set. AMD uses its configured label with the existing neutral provider fallback. Health now returns hardware alongside provider and model; metrics uses the same configuration.
- Exported browser-safe `abstainMessage(reason): Localized` with copy for every existing reason code and an unknown-code fallback. No shared summary contract change.
- Session queues exclude abandoned starts with zero patient turns. Those sessions remain addressable by ID.

## FILES CHANGED

- `apps/web/lib/pipeline/quickAnswers.ts` (new)
- `apps/web/lib/pipeline/messages.ts` (new)
- `apps/web/lib/pipeline/{config,extract,mock,pipeline,prompts,templates}.ts`
- `apps/web/app/api/health/route.ts`
- `apps/web/lib/pipeline/__tests__/wave8.test.ts` (new)
- `apps/web/lib/pipeline/__tests__/{llm-api,pipeline,wave7}.test.ts` (updated expectations)
- `docs/reports/w8-ai-engineer.md`

## TESTS RUN + RESULTS

- Vitest: `./node_modules/.bin/vitest run`, exit 0, **951 tests passed across 12 files**, 81.31 seconds. Includes 181 new tests in `wave8.test.ts` and concurrent ops tests present in the shared workspace.
- Mock eval: `MODEL_PROVIDER=mock ./node_modules/.bin/vite-node ../../eval/run.ts -- --split all`, exit 0, 40 cases plus 18 holdouts; all 18/18 fault scenarios passed. A temporary Node preload redirected generated artifacts into `/private/tmp/medx-w8-eval/`; `eval/REPORT.md` and `eval/runs/` were not modified.
- TypeScript: `./node_modules/.bin/tsc --noEmit --incremental false`, exit 0.
- ESLint: `./node_modules/.bin/eslint . --ignore-pattern 'public/patient/**' --max-warnings 0`, exit 0, zero errors and warnings in app source. The initial broad run scanned generated Expo bundles and reported 13 errors and 4,646 warnings there; generated output was excluded without changing another owner's config.
- Initial failures from old health/queue expectations, importing Expo's unavailable base tsconfig, and missing awaits in route tests were corrected.

## EVIDENCE

- New chip tests read the exact current literals in `apps/mobile/src/i18n.ts` without importing the Expo runtime.
- Every denial variant, all nine translated time chips, and severity digits 0 through 10 in all three languages are driven through both mock and AMD transport paths.
- AMD transport tests stub HTTP responses that deliberately omit chip fields. They exercise the actual provider transport, schema validation, field attribution, quote verification and pharmacy evidence without network calls.
- Regression coverage includes wrong-field attribution, unsolicited answers, later corrections, retained allergy evidence, provider/schema abstention, hardware endpoints, queues and localized fallback messages.
- `git diff --check -- apps/web/lib/pipeline apps/web/app/api docs/reports/w8-ai-engineer.md`: exit 0.
- Mock run artifacts: `/private/tmp/medx-w8-eval/runs/2026-10-17T08-50-21-569Z/{config.json,raw.jsonl,results.json,metrics.json,manual.csv}` and `/private/tmp/medx-w8-eval/REPORT.md`. All 78 asserted evidence spans were mechanically valid. Deterministic holdout recall was 7/10 (70%); the mock model adds no flags, so the combined arm was also 7/10.
- No browser screenshots required for these pipeline/API changes.

## ASSUMPTIONS

- The explicitly requested mock hardware U+2014 value is an exception to the general no-em-dash instruction. New authored questions and messages contain no em dashes.
- The mobile app currently offers time chips for duration as well as onset, and none chips for medical history as well as allergies/medications; these fields are covered too. A week is never converted into an invented day count.
- Existing AMD hardware fallback remains `AMD (via Token Factory)` when no label is configured.

## RISKS

- Offline AMD transport tests establish behavior of the real code path, not live model quality. Mock eval is smoke evidence only.
- The mock run still misses three of ten positive holdout cases. This existing deterministic-rule limitation requires the clinical/AI research owners' review; no clinical rule files were changed in this task.
- The repository is shared with active mobile and ops work. Their concurrent changes are outside this task's edit ownership and were preserved.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS

- None. Existing abstain reason codes and shared types remain unchanged.

## NEXT ACTION

- UI owners can import `abstainMessage` from `lib/pipeline/messages.ts` when displaying abstention codes. Clinical/AI research owners should retain the holdout limitation in evaluation materials.
- No commits, installs, or dev-server restarts performed by this task.
