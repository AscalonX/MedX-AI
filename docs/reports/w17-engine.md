# W17 engine report (Sonnet)

STATUS: done, not committed.

## Fixes
- P0-1 staff names: reviewerId/orderedBy/by are validated (non-empty, <=80 chars) and never redacted (orders.ts `actorId`, consult.ts `reviewer`, pipeline.ts review/takeover, pharmacyReview.ts). Clinician consult speech and sign-time edits use `redactKeepStaff` (exact STAFF names kept, all other names redacted); patient speech unchanged. Demo seed approver is now `Dr. Marco Bianchi`.
- Extra root bug: overlapping name triggers ("hello Mr. Smith") produced corrupted text (`[NAME_2]AME_1]`); spans are now merged in redact.ts.
- P1 allergies field mirrors supported/verified/edited pharmacy allergies (or the verified denial) with the same evidence (pharmacyExtraction.ts).
- P1 considerations: only rules whose first match group matches, ranked by groups*10 + distinct matched spans (tie: earliest mention), max 4 shown. The draft note and orders chips draw only on the shown set.
- P1 draft note presenting complaint comes from the supported chief_complaint field; fallback (escalation, no extraction) is the first patient turn plus substantive (>=4 word) turns, never short answers.
- P1 mock recognises sore throat, fever, back pain, rash, dizziness, stomach ache variants (plus existing headache/cough).

## Tests
wave17.test.ts (29 new). wave2/wave15 updated: reviewer name, and the MF-2 scenario moved off "fever + sore throat" because the Doctor's tightened rules (concurrent) no longer give that case a consideration.

## Risks
consultrules.json was being edited by the Doctor during the run; one transient wave11 failure came from that. Rank weights are heuristic.
