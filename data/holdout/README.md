# Blind holdout set

Purpose: independent, blind check of the red-flag rules. The author wrote these cases without having seen the rules (redflags.json, clinical docs, eval sets, pipeline code, existing cases), so wording is not tuned to them.

Date: 2026-10-17. All data is synthetic (`synthetic: true`).

Counts: 18 cases = 6 Thai, 6 Italian, 6 English; 10 escalate, 8 non-urgent (4 of them tricky look-alikes: HO-11, HO-12, HO-13, HO-14; also HO-16 to HO-18 contain denial/past-history/mild features).

Gold labels are clinician judgement for escalation, not rule output. Do not tune rules on these cases; if used for tuning, retire this set and write a new one.
