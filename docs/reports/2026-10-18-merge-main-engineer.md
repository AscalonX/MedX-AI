# Merge origin/main into feat/pharmacy-two-stage (merge engineer)

STATUS: done (merge staged, not committed; the orchestrator commits)

## Summary

Merged origin/main (af48f8a workflow/review fixes, 94d0c4e deck v2, 17b52ab submission title, e049be6 lablab form copy) into our launch wave (38e3382 + be1ce42). Every conflict keeps both intents; no safety check weakened, no test removed. The patient web export was rebuilt from the merged mobile sources.

## Per-file resolution

- `.env.example`: ours. It already holds the union (DEMO_SEED, DEMO_AUTOSEED, DEMO_TOKEN, CRON_SECRET, MEDX_STORE_PATH in the Store section). Secrets stay empty.
- `.gitignore`: ours (`.next-*/`, `.data/`, `*.tsbuildinfo`), which includes their `.data/`.
- `apps/mobile/src/app/index.tsx`: our redesign and "open the stored visit" behaviour, plus their `if (busy || !ready) return` double-tap guard. The button reads their "Resume visit" while a visit is active (locked) and our "Open my visit" after it ends.
- `apps/web/app/(clinician)/review/_shell.tsx`: our visible-polling version, plus their fix. Unmount cleanup now also releases `inflight`. Their guarded `finally` (auto-merged) needs this, or a Strict Mode remount leaves the queue stuck.
- `apps/web/app/(clinician)/review/_workspace.tsx`: our M-06 header (the same actions on every header, approved receipt included, `nextOpen` on the receipt). This already covers their "approved case keeps navigation" and "vitals always visible" fixes. Their phone-width FieldRow wrapping auto-merged. Differences from their side: Orders shows for every role, and the orders page gates writes by role. Consult stays available on approved cases, per our approved-consult engine change.
- `apps/web/app/(pharmacy)/_queue.tsx`: our stage strip, search and ReconList, with their acknowledged-alert follow-up semantics moved into ReconList (`alertsOf(s).filter(alertNeedsFollowUp)`). The urgent badge copy is now "awaiting review", matching their `urgentStat`.
- `apps/web/app/(pharmacy)/_workspace.tsx`: imports are the union (ours plus `alertNeedsFollowUp`). `openHigh` was dropped from the imports because it is no longer used. Their acknowledged-alert controls and sign-off scope copy auto-merged.
- `docs/DECISIONS.md`: every entry from both sides, in date order. Their 2026-10-18 01:20 title decision sits between our late-evening wave-20 entry and our two later 2026-10-18 entries (committed 07:52).
- `pitch/SUBMISSION.md`: kept their title and their lablab form section, with facts updated for our wave: two-pharmacist dispensing, pickup, live demo URL, 2,451 tests, and Neon Postgres and Vercel in place of Docker. Short description: 253 characters. Long: 1,968 (1,981 if line breaks count as two). Lengths were checked with Node. The deck row points to v2 and notes that it needs a refresh. Our Gemma/Safety/Evidence long copy is kept, with the test count updated.
- `apps/web/public/patient/**`: took our side for the conflicted paths and deleted their renamed bundles. Then ran `bash scripts/build-patient-web.sh` on the merged sources and staged the whole tree. New hashes: entry-4604b97b, __common-67a2bf63, index-817b7f08. source.sha is 63a78494...
- Auto-merged, checked: `apps/mobile/src/i18n.ts` (`resume` in all three languages), `(pharmacy)/_lib.ts` (`alertNeedsFollowUp`, review copy), `PencilField.tsx` (Badge accepts className), `mock.ts` (`negatedBefore(before, extraCues)` matches our redflags.ts), `trace.test.ts`, and the new tests `review-status.test.ts` and `browser-regressions.test.ts`.

## Tests run + results

- apps/web `vitest run`: 53 files, 2,451 tests passed (our 2,436 plus their 15). This includes patient-stamp.test.ts on the rebuilt export.
- apps/web `tsc --noEmit -p .`: exit 0.
- apps/web `eslint .`: exit 0, no output.
- apps/mobile `tsc --noEmit -p .`: exit 0.
- apps/mobile `expo lint`: exit 0.
- `scripts/build-patient-web.sh`: exit 0.
- `git diff --cached --check`: clean.

## Assumptions

- Orders is shown to nurses (read-only) and consult is kept on approved cases, because both are deliberate launch-wave decisions. Their report described doctor-only Orders and no consult after approval.
- `docs/LOCAL-SETUP.md` and `scripts/start-local.sh` are kept as they arrived. The setup doc names a contributor's local path.

## Risks

- The deck v2 slides still show 1,872 tests and "live demo URL pending".

## Open questions / contract change requests

None.

## Next action

The orchestrator reviews and commits the merge.
