# W4 clinician web fix pass

Files: `apps/web/app/(clinician)/review/{_shell,_workspace,_lib}.tsx/ts`, new `_i18n.ts`. Not committed. `tsc` clean for (clinician) (one unrelated error in `app/(pharmacy)/_workspace.tsx`, not mine); eslint clean.

1. P1 queue complaint (`_shell.tsx`): shows the complaint only when status is supported, edited or approved and the summary is not abstained. Otherwise "Unverified complaint" (graphite) or "Needs human review". Verified by patching B-003's complaint to unsupported in the list response: row read "Unverified complaint".
2. P2 provenance (`_workspace.tsx`): headline now comes from the successful `extract` call's provider ("Gemma · AMD Instinct" or "Mock model, not AMD"); every step is listed with its own provider (AMD/mock), latency and "(failed)". No headline if no extract succeeded.
3. P2 stale poll: generation counter bumped at mutation start, mutation end and id change; a GET that resolves after a bump is dropped (data and error). Reasoned and code-reviewed; race not reproduced in the browser.
4. P2 queue error: first-fetch failure now shows an alert with the message and a Retry button instead of the skeleton. Code path only, not triggered in the browser.
5. P2 language: new string table `_i18n.ts` (th/it/en) covers queue, statuses, banners, abstain reasons, red-flag review, field actions, approve/take over, audit, provenance, sr-only text. Verified in Thai on B-013: only the reviewer names and the Italiano/English labels stay Latin. Th/it strings still need native review.
6. Band copy: when every flag is reviewed and any was a false alarm, a one-line strip replaces RedFlagInterrupt's collapsed strip and says "False alarm noted" (per rule when mixed, e.g. "RF-CHEST-01: Acknowledged; RF-CHEST-02: False alarm noted"). Verified in Thai on B-013. Approval guard while a flag is unreviewed is kept.
