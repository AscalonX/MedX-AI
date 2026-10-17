# Codex verification pass — 2026-10-17 ~17:30 ICT

Verified through `a1589c8`. No files modified.

| Finding | Status | Current evidence |
|---|---|---|
| 1. Pharmacy sign-off bypass | **FIXED** | Server blocks red flags, abstention and unsupported allergies: [pharmacyReview.ts:75](apps/web/lib/pipeline/pharmacyReview.ts#L75). |
| 2. Approval before flag review | **FIXED** | Approve/edit requires flag review: [pipeline.ts:160](apps/web/lib/pipeline/pipeline.ts#L160). |
| 3. Alerts hidden during abstention | **FIXED** | Alerts and queue counts remain: [workspace:109](apps/web/app/(pharmacy)/_workspace.tsx#L109), [queue:35](apps/web/app/(pharmacy)/_queue.tsx#L35). |
| 4. Restore overwrites new intake | **FIXED** | Hydration gate and invalidation: [index.tsx:52](apps/mobile/src/app/index.tsx#L52), [store.tsx:57](apps/mobile/src/store.tsx#L57). |
| 5. Late response restores old session | **FIXED** | Unmount/generation checks plus session-ID update guard: [intake.tsx:65](apps/mobile/src/app/intake.tsx#L65), [store.tsx:78](apps/mobile/src/store.tsx#L78). |
| 6. Timeout/retry duplication | **FIXED** | 45-second client timeout, reusable retry ID and locked server deduplication: [api.ts:8](apps/mobile/src/api.ts#L8), [pipeline.ts:143](apps/web/lib/pipeline/pipeline.ts#L143). |
| 7. Voice survives navigation | **FIXED** | Permission-generation check and recognition/timer cleanup: [voice.ts:57](apps/mobile/src/voice.ts#L57), [voice.ts:80](apps/mobile/src/voice.ts#L80). |
| 8. Active-session language mismatch | **FIXED** | Language control locked: [index.tsx:44](apps/mobile/src/app/index.tsx#L44). |
| 9. Unsupported nurse-coming promise | **FIXED** | Honest staff instructions in EN/IT/TH: [i18n.ts:51](apps/mobile/src/i18n.ts#L51). |
| 10. Poll overwrites successful sign-off | **FIXED** | Poll suspension and generation invalidation around POST: [pharmacy shell:99](apps/web/app/(pharmacy)/_shell.tsx#L99). |
| 11. Clinician edits presented as translations | **FIXED** | Edit history marks corrections; separate correction rendering: [workspace:172](apps/web/app/(clinician)/review/_workspace.tsx#L172), [workspace:445](apps/web/app/(clinician)/review/_workspace.tsx#L445). |
| 12. Unsupported complaint lacks accessible qualification | **FIXED** | Visible and screen-reader “unverified” wording: [queue:59](apps/web/app/(pharmacy)/_queue.tsx#L59). |
| 13. Overlapping evidence over-highlighted | **FIXED** | Interval splitting; probe highlights only “since yesterday”: [segments.ts:17](apps/web/components/ui/segments.ts#L17). |
| 14. Overlapping completion/workspace polls | **FIXED** | Single-flight/request ordering: [clinician workspace:60](apps/web/app/(clinician)/review/_workspace.tsx#L60), [done.tsx:32](apps/mobile/src/app/done.tsx#L32). |
| 15. Existing session escalation unannounced | **FIXED** | Detects transitions into escalation: [clinician shell:40](apps/web/app/(clinician)/review/_shell.tsx#L40). |
| 16. Drawer focus handling | **PARTIAL** | Explicit-button opening improved. Row opening records no return target; closing can leave focus hidden. No modal focus containment: [pharmacy workspace:65](apps/web/app/(pharmacy)/_workspace.tsx#L65), [workspace:137](apps/web/app/(pharmacy)/_workspace.tsx#L137). |
| 17. Mutable signing timestamp | **FIXED** | Receipt uses completed audit event: [workspace:662](apps/web/app/(pharmacy)/_workspace.tsx#L662). |
| 18. Pharmacy audit localization | **PARTIAL** | Pharmacy actions localized; `abstained`, `red_flag_review`, `takeover` still render raw event names. Reproduced in TH/IT: [lib:244](apps/web/app/(pharmacy)/_lib.ts#L244). |

| Clinical item | Status | Current evidence |
|---|---|---|
| MF-1 False reassurance | **FIXED** | Staff instruction replaces attendance promise: [i18n.ts:51](apps/mobile/src/i18n.ts#L51). |
| MF-2 Stopped medicines suppress alerts | **FIXED** | Only pharmacist-discontinued entries excluded; extraction retains supported status: [medrules.ts:31](apps/web/lib/pipeline/medrules.ts#L31), [pharmacyExtraction.ts:101](apps/web/lib/pipeline/pharmacyExtraction.ts#L101). |
| MF-3 Unverified hardware claims | **FIXED** | Target/mock qualification and reported model/hardware: [README:54](README.md#L54), [workspace:628](apps/web/app/(clinician)/review/_workspace.tsx#L628). |
| MF-4 Unmeasured trust/30-second claims | **FIXED** | Revised public introduction and landing title: [README:3](README.md#L3), [i18n:25](apps/web/app/(clinician)/review/_i18n.ts#L25). |
| MF-5 Undisclosed limitations | **FIXED** | Voice vendors, self-declared identity and imperfect redaction disclosed: [SAFETY:17](pitch/SAFETY.md#L17), [mobile i18n:35](apps/mobile/src/i18n.ts#L35). |
| MF-6 Absolute injection guarantee | **FIXED** | Explicitly states end-to-end injection handling remains unevaluated: [SAFETY:7](pitch/SAFETY.md#L7). |
| MF-7 Stale documentation | **PARTIAL** | README/reset documentation corrected, but video narration still says **1,041**, alongside visual **1,093**: [VIDEO-SCRIPT:14](pitch/VIDEO-SCRIPT.md#L14). |

**New P0/P1: one P1.** The address fix now leaks lowercase abbreviated addresses. Probe: “I live at **12 main st**…” was redacted at the reviewed commit; current code preserves it and includes it in **three stubbed model-client requests**. The same occurs for “25 elm rd.” Cause: capitalized street-name requirement at [redact.ts:32](apps/web/lib/pipeline/redact.ts#L32).

Tests: **1,093 passed across 14 files**, including all 50 wave-10 tests. The full runner nevertheless exited **1** with an unhandled Vitest worker `onTaskUpdate` timeout.

**ready for demo: no**

Minimal remaining: fix the address regression; complete #16/#18 and MF-7; obtain a clean test-run exit.