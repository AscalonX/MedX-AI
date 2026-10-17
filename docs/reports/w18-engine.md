# W18 engine report (Sonnet)

STATUS: done, not committed. vitest 1,872/1,872, tsc and eslint clean.

1. Kept considerations: "Keep in note" sets the suggestion to `asked`. My W17 "shown only" filter excluded `asked` items, so they vanished from the draft and the signed note. The draft now includes shown plus kept considerations. Sign keeps lines that were edited or are kept (status `asked`) and drops the rest. Keeping or dismissing a consideration invalidates stale unsigned drafts. Files: consult.ts. Test in wave17.test.ts.
2. Case trace: `lib/pipeline/trace.ts` (pure `deriveTrace(session, audit, consult?)`), route `app/api/sessions/[id]/trace/route.ts`, tests in `__tests__/trace.test.ts` (7). Nodes use audit ids/types, rule ids, counts and field names only (no turn text). `auditDigest` = sha256 of ordered event id:type; `generatedAt` = last audit event time, so re-deriving gives identical JSON. A red-flag case ends at an escalated output with model nodes `skipped`; a medication case adds `med_rules` and `order_check`.
3. Consult `inputMode` (text/voice) honoured for both speakers; default voice; invalid value 400; route accepts the key. Test in wave17.test.ts.

Live: kept FEVER-04 consideration appears in draft and in signed note; trace for routine vs chest-pain cases differs as expected; unknown id 404; consult clinician turn stored as `text`.
