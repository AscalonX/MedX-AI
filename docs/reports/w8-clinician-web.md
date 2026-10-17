# W8 clinician web UX fixes (from w7-ux-audit)

Not committed. `tsc` clean for (clinician) and `app/page.tsx` (only `app/(pharmacy)` errors, not mine); eslint clean. Dependency added with approval: `qrcode`, `@types/qrcode` (apps/web).
Screens: `docs/reports/screens/v4-review-{landing,index,escalated-th,awaiting,approved}.png`.

## Fixed (audit number)
- 4 Approval moment: hint next to the approve button ("N required fields left: ..., ask the patient or take over"), each name jumps to and focuses its row (hidden on red-flag cases, which show one banner instead). When the status is approved the header becomes a teal receipt (who, time, fields approved) with a primary "Next case" pill.
- 5 One Acknowledge per case: the red card's button acknowledges all rules; per-rule rows keep only "Mark false alarm" with `aria-label` naming the rule.
- 9 Focus and announcement: after acknowledge, false alarm, approve-all and take over, focus moves to the case header and a `role=status` region announces it (verified: activeElement is the header, message "Red flag acknowledged by Nurse A. Rossi").
- 6 Gloss: under Thai/Italian patient lines, "quote -> field: value" from verified fields and flags in the clinician language; where none exists, only an "Original language" tag. No client translation.
- 8 Audit trail: duplicate events merged (x2), actors localized, model and total latency chip on model events, no raw codes.
- 10 Stop reason shown once as a banner, not under 7 rows. 11 Red flag label stays as subject and a "Red flag, acknowledged" chip shows after take over. 12 Queue: abstain reason in words, sentence-case complaints, one 24h time format.
- Wording: Italian "Visto, confermo segnalazione" / "Visto" vs "Gestisco io" / "In gestione"; Thai button "รับทราบ", done "รับทราบแล้วโดย ...". 24h times via Intl in the UI locale, model footer and step names localized, `document.documentElement.lang` follows the UI language, skip link added.
- 7 Landing: real QR (SVG, client-generated) to `${origin}/patient/`, caption "Scan to try the patient app (web)", Open patient app button, developer copy removed.
- 3 Queue hides sessions with no patient turns behind "Show N empty".
- Wow: new escalated cases slide in with a 420 ms red ring (reduced-motion flattened by the global rule) and the tab title becomes "(1) New emergency · MedX Bridge" until opened (verified by creating a Thai chest-pain session).
- Abstain codes: localized map in `_i18n.ts` (messages.ts did not exist).

## Not fixable in my folder (design lead)
- AppShell role switch labels and sidebar disclaimer are hard-coded English; the card-level Acknowledge copy in RedFlagInterrupt (th "รับทราบแล้ว", it "Preso in carico") is in `components/ui`. Role switch also now wraps to two rows.
- `SegmentedControl` roving tabindex and the white focus ring on the selected filter pill (audit 25, 26).

## Risks
- "New emergency" counts only cases that appear after the page loads; cases already open at load do not badge the title.
- Server holds ~150 QA sessions; th/it strings still need native review.
