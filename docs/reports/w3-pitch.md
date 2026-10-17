# W3 Pitch lead report

STATUS: done (copy drafted; metrics are placeholders pending the AMD run)

SUMMARY: Wrote submission copy, 3:00 video script, 8-slide outline and Track 2 safety page. All claims stay inside the claim boundary; only PROBLEM.md numbers are used, with citations. Gemma-on-AMD is described as design; every unmeasured number is [TBD-METRIC].

FILES CHANGED: pitch/SUBMISSION.md, pitch/VIDEO-SCRIPT.md, pitch/DECK-OUTLINE.md, pitch/SAFETY.md, docs/reports/w3-pitch.md

TESTS RUN + RESULTS: word/character counts checked by script: short description 253 chars (limit 255); slide on-slide text 17 to 23 words (limit 25); speaker notes 26 to 43 words (limit 60); long description about 450 words after trimming.

EVIDENCE: numbers used: 49.1% vs 29.5% and 52.4% vs 35.9% (D1); 49.2% / 27.0% (T1); 32.97M tourists (H1); holdout rules-only 7/10 recall, 3/8 false alarms (eval/results/holdout-rules-only.md). Italy foreign-residents figure (I1) deliberately omitted from final copy because PROBLEM.md marks it secondary.

ASSUMPTIONS: code paths in SAFETY.md taken from the repo tree at write time (pipeline files, review/takeover routes); the clinician and ops UI paths were not yet present, so not cited. "About 18 rules" from clinical SPEC v1.1. Demo case details (Italian stomach pain, Thai tiredness plus chest pain) are illustrative, not tied to specific case ids.

RISKS: video voice-over speed is tight; script says to cut ops segment first. If the AMD key is not live, "Gemma · AMD Instinct" footer must not be shown for mock runs. Thai/Italian on-screen text needs native-speaker check. The "2 to 3 minutes" figure is a design assumption, not cited.

OPEN QUESTIONS: team names and roles for slide 8; whether to add the model-screen holdout result once eval runs.

NEXT ACTION: after eval/REPORT.md exists, replace every [TBD-METRIC] in the four pitch files; verify demo cases against the built UI before recording.
