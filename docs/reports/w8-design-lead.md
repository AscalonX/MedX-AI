# W8 report: Design lead, design-system fixes from the UX audit (w7)

## STATUS
done for every `components/ui` item in `docs/reports/w7-ux-audit.md`. Nothing is committed.

## SUMMARY
- **Item 22, UI language reaches `lang`.** `AppShell` now sets `document.documentElement.lang` in an effect and puts `lang` on the shell root. The `:lang(th)` rules and screen-reader voices now follow the toggle.
- **Item 23, Thai and Italian leftovers.**
  - `AppShell` takes a `labels` prop: role names, role-group, language and nav labels, skip link, disclaimer. Built-in `shellLabels` cover th, it and en; strings passed in override them.
  - `RedFlagInterrupt` button text: Italian "Visto, confermo" (the done state is "Visto e confermato"). Thai button "รับทราบ", done state "รับทราบแล้ว".
- **Items 25 and 26, keyboard.**
  - `SegmentedControl` is a real radiogroup with one tab stop; arrow keys, Home and End move the selection.
  - `SegmentedControl`, `Pill` and the nav links have an explicit 2px ocean focus ring with a 2px offset in every state, which fixes the white-on-white ring.
  - `AppShell` adds a "Skip to content" link to `#main-content`. That makes 1 tab stop before the content, down from 15.
- **Item 9, focus after Acknowledge.** In `RedFlagInterrupt`, focus moves to the collapsed strip (`tabIndex=-1`). The region changes from `role=alert` (assertive) to `role=status` (polite) once acknowledged.
- **Item 14, labels screen readers ignore.** `StatTile`'s null state is now a visible "No data yet" pill (localizable via `emptyLabel`) instead of an `aria-label` on a plain span. `FieldValue` already uses visible text for every state; no other gaps were flagged.
- **Dashes.** No em or en dashes in component copy. A new test enforces this, and the DIRECTION.md copy rules now spell it out (plus the 24-hour `Intl` time format).
- **New components.**
  - `Receipt`: teal check, title, label/value rows, footer. It is a polite status region and takes focus when it appears (`focusOnMount`, default true). Use it for clinician approval and pharmacy sign-off.
  - `CountUp`: counts from 0 on first load and from the previous value on change, with `pen` easing. It is instant under reduced motion, screen readers get only the final value, and the number sits in a minimum-width box because the digits are proportional. `StatTile.value` now accepts a ReactNode, so `value={<CountUp value={n} />}` works.

## FILES CHANGED
- `apps/web/components/ui/AppShell.tsx`: lang effect and attribute, `labels` prop, exported `shellLabels` and `ShellLabels`, skip link, focus ring on nav.
- `apps/web/components/ui/SegmentedControl.tsx`: roving tabIndex, arrow, Home and End keys, focus ring on segments and `Pill`.
- `apps/web/components/ui/RedFlagInterrupt.tsx`: copy fixes, alert-to-status switch, focus to the strip after Acknowledge.
- `apps/web/components/ui/StatTile.tsx`: visible empty pill, `emptyLabel` prop, ReactNode value.
- `apps/web/components/ui/Receipt.tsx` (new), `apps/web/components/ui/CountUp.tsx` (new), `apps/web/components/ui/index.ts` (exports).
- `apps/web/components/ui/ui.test.ts`: new test that no `.tsx` here contains U+2013 or U+2014.
- `docs/design/DIRECTION.md`: new 6f Receipts, 6g CountUp, 6h shell accessibility; section 9 copy rules for dashes and time format; primitives list updated.

All prop changes are additive. The props of existing components are otherwise unchanged.

## TESTS RUN + RESULTS
- `cd apps/web && npx vitest run components/ui`: 5/5 pass, including the new dash rule.
- `cd apps/mobile && npx tsc --noEmit`: exit 0.
- `cd apps/web && npx tsc --noEmit`: exit 2. **All 4 errors are in builder files with uncommitted, in-progress edits, none in `components/ui`:**
  - `app/(clinician)/review/_workspace.tsx:547`: `auditLine(e)` expects 2 arguments.
  - `app/(pharmacy)/_workspace.tsx:156, 263, 592`: a `Localized` object is passed where a ReactNode is expected (e.g. `PHARM_STATUS_LABEL[st]`, `qn.why`).

  These come from their concurrent i18n change (`_lib.ts` and `_i18n.ts` are modified in the working tree). Builders: index the label with `[lang]`.

## ASSUMPTIONS
- The th and it strings in `shellLabels` (e.g. "Gestione" for Ops, "ปฏิบัติการ") are my drafts and need native review. Builders can override any of them via `labels`.
- `Receipt` focuses itself on mount by default. Pages that render it on load (not after an action) should pass `focusOnMount={false}`.

## RISKS
- The ops builder created their own `app/(ops)/components/CountUp.tsx` in parallel. Prefer the shared `CountUp` from `@/components/ui` (reduced-motion aware, screen-reader safe) so there is one implementation.
- Audit item 5 (three "Acknowledge" buttons) is in the review workspace, not the component. Builders should keep only the card's Acknowledge and label per-rule actions "Mark RF-xxx as false alarm".

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
None.

## NEXT ACTION
- Clinician: render `Receipt` on `approved` with "Next case" as the primary action.
- Pharmacy: render `Receipt` after sign-off.
- Ops: use `StatTile value={<CountUp value={n} />}`.
- All shells: pass `labels` only if they need different wording.
- Fix the 4 type errors in the pharmacy and review workspaces.
