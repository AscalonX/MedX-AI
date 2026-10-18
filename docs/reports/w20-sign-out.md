# w20 · Sign-out report: account menu, sign out / switch role, "Who's signing in?" sheet

## STATUS
partial. Everything in my scope is built and tested. Two things are missing:
- The "Signed out" notice is built (`app/_shared/SignedOutNotice.tsx`), but it has to be mounted on `/demo`. That page (`app/demo/DemoHub.tsx`) is outside my scope, so this is a one-line request below.
- Nothing has been clicked through in a live browser. This task does not allow `next dev`/`next start`.

Nothing is committed.

## SUMMARY
There is no real authentication, by design. The "accounts" are the synthetic demo staff in `packages/shared/src/staff.ts`, kept in localStorage.

- **Account menu on every staff surface.**
  - The surfaces: clinician `/review/*`, orders and vitals, trace, pharmacy, ops. Orders and trace render inside `ClinicianFrame`, so they get it too.
  - The avatar is now a menu button: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` while open.
  - The popover shows "Signed in as", the name, the role and a "Demo identity · synthetic staff" chip. Below that is a `role="menu"` with:
    - "Switch role": a link to `/demo`;
    - "Sign out";
    - "Choose who is signing in", only while not signed in.
  - Keyboard: ArrowDown/ArrowUp on the button opens the menu at the first or last item. Arrows, Home and End move through the items. Escape closes the menu, returns focus to the button and stops page-level Escape handlers. Tab or a click outside closes it.
- **Sign out.** `signOut()` in `app/_shared/identity.ts` removes these localStorage keys:
  - `medx.role` (ROLE_STORAGE_KEY);
  - `medx.clinicianRole`;
  - `medx.reviewer.<role>` for all four roles;
  - `medx.demo.persona` and `medx.demo.case`;
  - any other `medx.reviewer.*` or `medx.demo.*` key.

  It also clears the tab's consult-consent flags (sessionStorage `medx.consult.consent.*`), so the next person has to confirm recording consent again. It keeps the `medx.lang` language and the `medx.pharmacy.tab` convenience. Then it navigates to `/demo?signedOut=1`. It reuses `DEMO_PERSONA_KEY`/`DEMO_CASE_KEY` (demoPersona.ts), `CLINICIAN_ROLE_KEY` (useStaffRole.ts) and `ROLE_STORAGE_KEY`/`reviewerStorageKey` from shared. Blocked storage never throws.
- **"Who's signing in?" sheet.** It shows when a staff page opens with no valid stored identity for its role (`medx.reviewer.<role>` must be a STAFF name of that role).
  - It lists `staffFor(role)`. Pharmacists get a second line: "Pharmacist 1 · verify or return" / "Pharmacist 2 · final check and dispense".
  - The clinician sheet also has a Nurse/Doctor switch.
  - Choosing a name calls the same `setReviewer` as the "Signed in as" select. The select still works and shows a disabled "Choose…" placeholder while nobody has signed in.
  - **It is a bottom sheet, not a modal.** There is no backdrop and no dimming. While the sheet shows, red-flag interrupts (`.mx-interrupt`) are lifted above it (z 41 over z 40). There is room at the end of the page to scroll clear of it, and a "Hide for now" button collapses it to a pill.
  - **Writes are gated, reading is not.** `IdentityGate` is a `display: contents` wrapper, so layout is unchanged.
    - It blocks clicks on action controls, Enter in text fields and form submits, before any page handler runs. Action controls are buttons, role=button/menuitem/checkbox/switch, and submit inputs.
    - It lets through links, tabs and segments (role=tab/radio/option), disclosure and drawer toggles (`aria-expanded`/`aria-controls`/`aria-haspopup`), text fields, selects, summaries and scrolling.
    - A blocked action brings the sheet back and gives it a short lift. Focus moves to the first name, and an `ocean` status line (not red) asks the person to choose first. After they choose, focus returns to the control that was blocked.
  - The pharmacy shell has a second check: `submit`, `submitOrder`, `dispense` and `pickup` throw "Choose who is signing in before making changes." when nobody has signed in.
  - **Direct navigation is unchanged.** When localStorage is set first, as `scripts/record-demo.mjs` `asRole()` does, the sheet never appears: the check runs only after storage is read, so it does not flash. I checked that the script's staff names equal STAFF.
  - A sign-out in another tab also signs this tab out (`storage` event). A sign-in elsewhere does not sign this tab in, because the name shown here would be stale.
- **Ops.** It has the same account menu and sheet. Ops has no write actions, so its board is not gated: Refresh, Retry and the links keep working while the sheet shows.
- **Motion.** All motion uses transform and opacity, lasts 180–360 ms, and sits inside `@media (prefers-reduced-motion: no-preference)`:
  - the popover rises in;
  - the sheet rises in, and lifts after a blocked action;
  - the notice slides in;
  - the avatar has a hover scale and a chevron rotation.

  Nothing touches urgent content. No new dependencies; the sign-out glyph is an inline SVG in the Icon set's stroke style.

## FILES CHANGED
- `apps/web/app/_shared/identity.ts` (new). Pure helpers:
  - `IDENTITY_KEYS`, `IDENTITY_PREFIXES`;
  - `clearIdentity`, `clearSessionContext`, `signOut`;
  - `storedIdentity`, `rememberIdentity`, `isIdentityKey`;
  - `signedOutRequested`, `stripSignedOut`;
  - `guardedControl`, `guardedKey`;
  - `staffChoices`, `ACCOUNT_COPY` (en/th/it), `at`.
- `apps/web/app/_shared/AccountMenu.tsx` (new).
- `apps/web/app/_shared/SignIn.tsx` (new): `useIdentityGate`, `IdentityGate`, `SignInSheet`.
- `apps/web/app/_shared/SignedOutNotice.tsx` (new). A fixed toast with a `role="status"` live region. It reads `?signedOut=1` after mount (no `useSearchParams`, so it needs no Suspense on the static `/demo`), then removes the flag with `history.replaceState`.
- `apps/web/app/_shared/signout.test.ts` (new, 15 tests).
- `apps/web/components/ui/AppShell.tsx`: new optional `account?: ReactNode` prop that replaces the plain avatar. Fully backward compatible.
- `apps/web/app/(clinician)/_frame.tsx`:
  - the gate, sheet (with the Nurse/Doctor switch) and account menu;
  - the select placeholder;
  - the header shows "Not signed in" while needed;
  - `signedIn: boolean` added to the `useFrame()` context (additive).
- `apps/web/app/(pharmacy)/_shell.tsx`: the gate, sheet, account menu and select placeholder, plus `requireIdentity()` on every write path.
- `apps/web/app/(ops)/components/OpsShell.tsx`: the account menu (replaces the Avatar) and the sheet. No gate.
- `docs/reports/w20-sign-out.md` (this report).

## TESTS RUN + RESULTS
All commands were run from `apps/web`.
- `./node_modules/.bin/vitest run app/_shared/signout.test.ts`: **15/15 passed**.
- `./node_modules/.bin/tsc --noEmit -p .`: **exit 0**, run after the last edit.
- `./node_modules/.bin/eslint components/ui/AppShell.tsx app/_shared "app/(clinician)/_frame.tsx" "app/(pharmacy)/_shell.tsx" "app/(ops)/components/OpsShell.tsx"`: **exit 0, no warnings**. One unused-import warning in my test was fixed, then the command was re-run.
- Full `./node_modules/.bin/vitest run`, before a one-line AccountMenu keyboard tweak: **2385 passed, 2 failed, 49 files**. Neither failure is in my scope; both are in files other agents are editing right now:
  - `app/patient-stamp.test.ts`: the `/patient` export is stale against `apps/mobile/src` (the mobile builder's files).
  - `components/ui/marketing.test.ts › the reveal honours reduced motion`: it looks for `.mx-reveal {` in `app/globals.css`, which another agent rewrote at 04:21 into a `[data-motion]` runtime.
- Targeted re-run after the tweak (`app/_shared`, `app/_landing`, `(pharmacy)`, `(ops)`, `(clinician)`, `components/ui`): **214 passed, 1 failed**, the same `marketing.test.ts` globals.css failure.

What `signout.test.ts` covers:
- IDENTITY_KEYS covers every key that `personaStorage`, `applyDemoPersona` and the selects write, and no preference keys.
- `signOut` clears all identity keys and consult consent. It keeps `medx.lang`, `medx.pharmacy.tab` and unrelated keys, returns `/demo?signedOut=1`, and afterwards `readDemoPersona`, `readDemoCase` and `storedIdentity(role)` are all null.
- Blocked, null and minimal storage never throw.
- `storedIdentity` rejects another role's name and case variants. `rememberIdentity` refuses non-staff names.
- `isIdentityKey`, plus parsing and stripping the signed-out flag.
- The gate classifier: action controls are blocked (including clicks on their icons); links, tabs, toggles, fields and alert text are not. The Enter-key guard.
- The copy is complete in all three languages and has no emoji.
- The closed menu-button markup and its labels.
- The sheet lists exactly `staffFor(role)` for all four roles. It is a non-modal dialog with a `/demo` link and no `signal` (red) classes.
- The CSS lift keeps red-flag interrupts above the sheet. All keyframes are inside the reduced-motion media query, with durations between 150 and 450 ms and no layout properties.
- The notice renders an empty live region on the server.
- Source wiring: every shell uses AccountMenu, `signOut().href`, SignInSheet and useIdentityGate. The clinician and pharmacy shells gate their content and keep the select. The orders and trace layouts use ClinicianFrame. AppShell falls back to the Avatar.

## EVIDENCE
- 15/15 new tests. `tsc` exit 0. `eslint` exit 0 on all changed files.
- No screenshots: I was not allowed to run `next dev`/`next start` in this task, so the menu, sheet, focus moves and Escape handling have not been clicked through in a browser.

## ASSUMPTIONS
- "Sign out" sends nothing to the server and writes no audit event. Demo identities have no server session, and every clinical write already reaches the append-only audit log with its actor. Say if a `signed_out` audit type is wanted.
- Clearing the consult-consent flags (sessionStorage) on sign-out is deliberate. The next person has to confirm recording consent themselves.
- "Switch role" keeps the identity and only opens `/demo`, where choosing a persona overwrites it.
- The gate is conservative: any plain button inside the page counts as a write until someone signs in.
  - Page builders can mark a button that only reads with `data-gate-allow`, or give it `aria-expanded`/`aria-controls`.
  - The red-flag Acknowledge button is blocked (acknowledging is a write). The alert itself stays readable and unobscured.
- Ops is not gated, because it has no writes.

## RISKS
- **Not tried in a live browser.** Focus order, Escape and click-outside handling, and the sheet over the review workspace's fixed-height panes and the pharmacy drawer have not been seen at 390 px or 1440 px yet.
- **Red-flag lift.** The lift (`.mx-gate[data-blocked] .mx-interrupt {position:relative; z-index:41}`) only works when no ancestor of the interrupt creates its own stacking context. If one does, the interrupt can still sit under the sheet when scrolled behind it. The sheet never dims or covers the top of the page, and "Hide for now" moves it out of the way.
- **Ops identity on mount.** `OpsDashboard` (not mine) writes `medx.reviewer.ops` on mount. As a result, after a sign-out the ops sheet appears on the first `/ops` visit but not after a reload.
- **Translations.** The Thai and Italian strings need native-speaker review, like the rest of the staff chrome.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
1. **Landing / `/demo` owner (`app/demo/DemoHub.tsx`).** Please mount the notice. This is one import and one line, anywhere inside the page; it is position-fixed under the nav:
   ```tsx
   import { SignedOutNotice } from "../_shared/SignedOutNotice";
   // inside the returned tree:
   <SignedOutNotice lang={lang} />
   ```
   Until then, sign-out still lands on `/demo?signedOut=1` and clears everything, but no notice shows.
2. **Ops builder (`(ops)/components/OpsDashboard.tsx`).** Optional: stop writing `reviewerStorageKey("ops")` on mount, because OpsShell now handles sign-in. Writing `ROLE_STORAGE_KEY` can stay.
3. **Page builders (clinician, orders, pharmacy).** Optional: `useFrame().signedIn` is now available if you want to disable write buttons yourselves. For pharmacy, the shell already refuses writes.
4. **Design lead.** Optional: add a `log-out` glyph to `components/ui/Icon.tsx`. AccountMenu uses an inline SVG in the same stroke style until then.

## NEXT ACTION
- QA: run a browser pass.
  1. Sign in through a persona and sign out from the account menu on `/review`, `/review/<id>/vitals`, `/review/<id>/trace`, `/pharmacy/<id>` and `/ops`.
  2. Check localStorage afterwards: only `medx.lang` and `medx.pharmacy.tab` should remain.
  3. Open a staff page directly with no identity. Confirm the sheet shows, buttons are blocked and the red flag is readable. Choose a name and confirm the action then works.
  4. With `asRole()` set first, confirm the sheet never shows.
- Landing owner: mount `SignedOutNotice` (request 1).
