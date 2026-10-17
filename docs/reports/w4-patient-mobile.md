# W4 Patient mobile fix pass

STATUS: done (two Codex P1 issues fixed and re-verified in the iOS Simulator). Not committed.

## Changes
1. Red flag cannot be dismissed by the patient (`src/app/redflag.tsx`): message and code always visible. "I'm at the desk" only swaps the sub-line to "A nurse is coming to you. Please keep this screen open." (th/it/en in `src/i18n.ts`). The new-intake button is gone. Staff-only exit: long-press the code 2 s, then confirm "Staff: end this intake?" (Alert; `window.confirm` on web). Staff text is English only, by design.
2. Ledger shows redacted text (`src/app/intake.tsx`, `src/i18n.ts`, `src/store.tsx`): built from `session.turns` where role is patient (API-returned redacted text) after each response. The local `answers` store was removed. While a request is pending the ledger shows a neutral "Sending…" line, not what was typed. Tokens `[PHONE_n]`, `[NAME_n]`, `[EMAIL_n]`, `[ID_n]`, `[DOB_n]` render as "(numero di telefono nascosto)" etc. in th/it/en; unknown tokens render "(hidden)".
3. Question counter now derives from patient turns.

## Tests
- `npx tsc --noEmit`: pass. `npx expo lint`: clean.
- Simulator (iPhone 17): Italian "Sono Marco Rossi, ho mal di testa, tel 333 123 4567" -> ledger shows "...tel (numero di telefono nascosto)" (`docs/reports/screens/mobile-7-redacted.png`). Thai session red flag -> tapped "I'm at the desk" -> sub-line changed, no other controls (`mobile-5-redflag-th.png`, overwritten). Long-press code 2.6 s -> staff confirm dialog (`mobile-8-staff-confirm.png`); cancelled.

## Risks / for others
- BACKEND GAP (not mine): "Sono Marco Rossi" was NOT redacted. `apps/web/lib/pipeline/redact.ts` matches lower-case `sono` only (`\bsono\s+[\p{Lu}]...` without the `i` flag), so a sentence-initial "Sono" leaks the name into stored turns and, now, the patient's own ledger. Owner: AI engineer.
- "Sending…" line was not screenshotted (request returns in well under a second).
- "End intake" tap not exercised (only cancel); same reset path as before.
- Earlier-report risks (Thai keyboard input, VoiceOver, device) unchanged.
