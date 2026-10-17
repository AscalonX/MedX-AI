# w18 Case trace UI

STATUS: done (against live GET /api/sessions/:id/trace; typed fixture fallback with "fixture" badge)

SUMMARY: `/review/[id]/trace` shows the executed per-case graph: layered left-to-right SVG (cubic curves, arrowheads), nodes are buttons coloured by actor (rule ink outline, model ocean, human teal, system grey) and status (escalated red left accent, skipped dashed+faded, failed/abstained amber; each also has icon + text, not colour alone). Summary strip, legend, step panel (actor, status, detail, latency, time, audit ids, EvidenceHighlight on the redacted patient turn), List view toggle, Export JSON (medx-trace-<code>.json), Deterministic replay check (auditDigest + Re-derive that refetches and compares). Graph auto-fits its card down to 0.7 scale, then scrolls sideways.

FILES CHANGED (all new): apps/web/app/(trace)/layout.tsx, _graph.ts (layout + summary), _fixture.ts, review/[id]/trace/page.tsx, review/[id]/trace/_trace.tsx; docs/reports/w18-trace-ui.md; docs/reports/screens/v11-trace-{routine,redflag,orders}.png.
Imports (read-only reuse): (clinician)/_frame, (orders)/_lib, _bits, _fixture.

TESTS: `tsc --noEmit` clean; `eslint 'app/(trace)'` clean. Browser at 1440 on live route: red-flag case (7 steps, escalated at step 3, 3 skipped nodes, evidence "chest pain"/"sweating" highlighted), routine (14 steps, 2 turns), orders (8 steps incl. order checks). Re-derive on the live route shows "Match". No unit tests added (layout is pure but untested; `layoutTrace`/`summarize` in _graph.ts are the candidates).

RISKS: a medication order on the "orders" case did not add a medication node beyond `order_check` (trace derivation is the other agent's). Layout assumes edges point forward (cycles are ignored safely). th/it strings need native review. Export button uses blob download (not exercised in headless). Link from case page ("Case trace") still to be added by the clinician builder: href `/review/${id}/trace`.
