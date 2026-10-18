# w19 pitch deck v2

STATUS: done (not committed). Owner decision applied: subtitle "MedX: Multilingual AI Copilot for Clinic Visits" on cover and closing; "Every word, understood." kept only as a small tagline.

SUMMARY: New dense, evidence-heavy 34-slide deck (1440x810) in the five-section structure (Situation, Solution & Tech, Business, Impact, Sustainability) with header, kicker, takeaway headline, evidence cards, real screenshots with numbered callouts, Fin quote bar, section pills and page numbers. Old deck.html and MedX-deck.pdf untouched.

FILES CHANGED (all new, under pitch/deck/): deck-v2.html, MedX-deck-v2.pdf (6.3 MB), build-v2.py (generator), SOURCES-v2.md, png-v2/s-01..34.png (96 dpi previews), img2/ (copied logos, cover-v4, journey, trace screenshots, mascot). Plus this report.

SLIDE LIST: 1 cover; 2 exec summary; 3 language-barrier harm; 4 medication-list errors; 5 allergy and brand names; 6 time/documentation; 7 AI summaries need evidence; 8 Thailand/Italy context; 9 who suffers + one pattern; 10 today vs MedX; 11 4-role journey; 12 patient app; 13 nurse (+vitals/NEWS2); 14 doctor; 15 orders with checks; 16 pharmacist; 17 safety table; 18 red flags before model; 19 evidence-linking; 20 Case trace; 21 architecture; 22 how we built it; 23 customers; 24 value proposition; 25 alternatives; 26 revenue and GTM; 27 roadmap with gates; 28 measured today; 29 pending AMD and targets; 30 risks; 31 feasibility and legal; 32 why now and ask; 33 team; 34 closing.

SOURCES ADDED FROM THE WEB: none new. All external figures come from docs/research/PROBLEM.md and PHARMACY-PROBLEM.md (already cited, PMIDs on slides). Mapping in pitch/deck/SOURCES-v2.md.

TESTS / CHECKS: `npm --prefix apps/web test` re-run: 23 files, 1,872 tests passed. 18 red-flag rules counted from redflags.json; medrules.json has 59 drugs, 18 interactions; 52 case files and 18 holdout files counted. Holdout rules-only 7/10, 3/8 read from eval/results/holdout-rules-only.md and eval/REPORT.md. Every slide PNG was viewed; fixed headline wraps, screenshot overflow into the quote bar, callout placement, table overflow. PDF exported with Chrome headless (--print-to-pdf, @page 1440x810); 34 pages.

RISKS / CLAIMS I AM UNSURE OF:
- 34 slides, above the 26-32 target.
- "dose ceilings for 31" is taken from README/SUBMISSION, not re-counted from medrules.json.
- Italy 5.37M (ISMU, secondary; ISTAT 5.42M) is labelled secondary on the slide.
- Business slides 23-27 (customers, alternatives by category, revenue options, phases, gates, owners) are our plan, labelled "assumption for discussion"; no products, prices or market sizes named.
- Slide 21/29 give every AMD number as "[pending AMD run]"; no AMD claim made. eval/REPORT.md mock numbers are not quoted.
- Slide 29 targets come from docs/ai/METRICS.md thresholds; labelled "target".
- Screens 13-16 show synthetic data from mock provider; some screenshot contents (e.g. ops dashboard with mock metrics) deliberately not used.
- Footnotes are 11px; some dense body text is 14px; sparse slides (31, 33) have white space.

OPEN QUESTIONS: team member names (not in repo; slide 33 says to be added); live demo URL (closing slide says pending); whether to trim to 32 slides (candidates: 22, 32).

NEXT ACTION: orchestrator review; after the AMD run replace "[pending AMD run]" on slides 21, 29, 30, 34 and re-run `bash`-free: `python3 pitch/deck/build-v2.py` then Chrome print-to-pdf.
