# W5 clinician web restyle (v2 "calm clinical banking")

Not committed. `tsc --noEmit` clean; `eslint 'app/(clinician)' app/page.tsx` clean. All behaviour and the W4 safety fixes are kept (approve guard, false-alarm strip, per-step provenance, stale-poll guard, th/it/en chrome).

## Changes
- `app/page.tsx`: landing inside AppShell: time-of-day greeting, GradientHero "MedX Bridge: multilingual intake you can trust" with Clinician / Pharmacist / Ops pills, StatTile row from `/api/metrics` (intakes today, escalated, awaiting review; quiet message if the call fails), Patient app card with Expo QR placeholder and "Open a demo review" link.
- `(clinician)/_frame.tsx` (new): AppShell wrapper with language, reviewer (localStorage), greeting, role switch (Nurse/Doctor stay on /review, Pharmacist to /pharmacy, Ops to /ops), nav, red count of unacknowledged escalations, soft card-enter keyframe (flattened by the global reduced-motion rule).
- `review/_shell.tsx`: queue polling and context only. `review/_queue.tsx` (new): StatTile row (escalated, awaiting, needs human, approved today), queue as rounded white cards with status pills, TH/IT/EN avatar badges, All / Escalated / To review filters, escalated pinned first. `/review` is now tiles plus queue (no auto-redirect).
- `review/_workspace.tsx`: GradientHero patient header (code, one-line complaint, status pill, language, waiting time, Review queue / Next case / Patient's words buttons); with a red flag the hero is replaced by the red interrupt card and a plain header card. Fields in grouped Cards with the v2 safety-state chips, transcript as a card with the highlighter, sticky pill action bar with audit panel.
- Deleted `_morph.tsx` (LangMorph fixed upstream); `_i18n.ts` extended with landing, queue and nav strings in th/it/en.
- Screens: `docs/reports/screens/v2b-review-{landing,index,escalated,awaiting_review,1024}.png`.

## Verified in the browser
Landing and queue (live data), escalated B-001 with interrupt, awaiting B-003/B-014, real click and arrow keys select a row and sweep the quote, red-flag acknowledge guard, 1024 layout. A real click was needed for the sweep: the Browser pane does not give the document focus to scripted clicks, so `armed` never fired there (not an app bug).

## Notes and risks
- Three columns do not fit beside the 248px sidebar at 1440, so the queue column became the /review page and a "Review queue / Next case" pair in the case header; the case view is summary + 400px transcript. At <1280 the transcript is a drawer.
- AppShell role switch overflows its 248px sidebar ("Ops" spills past the track); design lead's component, not touched.
- Dev-only Next badge overlaps the sidebar footer text in screenshots.
- Demo data is still mutated from earlier testing; re-seed before judging.
- Th/it strings still need native review.
