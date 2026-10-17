# Review after requested pull

STATUS: done — pulled latest main and assessed updates; no new product or pitch edits.

## Summary

Pulled main with fast-forward only from `e049be6` to `94d0c4e`. Two commits:

- `17b52ab`: descriptive submission title.
- `94d0c4e`: new 34-slide PDF/HTML deck, generator, previews and source map.

Upstream changed presentation/documentation only. No application, dependency or
test code changed, so the previous browser findings remain applicable. The new
title is clearer and the deck appropriately separates pending AMD results from
mock checks and rules-only holdout results. A product redesign is not indicated.

## Preservation and files changed

Before pulling, saved tracked edits as a binary patch and untracked work as an
archive under `/private/tmp/medx-prepull.GYwRZY`. Stashed tracked and untracked
work, pulled, then applied the stash without conflicts. The tracked diff after
restoration is byte-identical to the saved patch. The named stash is retained as
an additional backup. Ignored environment and runtime data were not stashed or
included in that archive and remain intact.

This report is the only new authored file in this task. No commit or push was
performed. Previously authored local setup, mock fix, regressions, reports and
screenshots remain uncommitted.

## Recommended updates, in order

1. **Fix the approval navigation gap and include the local engine fixes in the
   reviewed submission revision.** The approved/no-flags header still exposes
   only Next case and Review queue. The local mock-negation correction and
   privacy-test correction are preserved but are not yet upstream. Keep the
   previously reviewed scope; do not add new features before these fixes.

2. **Correct slide 21's provider behavior.** It says an unset AMD_BASE_URL makes
   the provider mock and calls mock a fallback. Actual code selects mock only
   when MODEL_PROVIDER=mock. Missing AMD configuration otherwise returns
   provider_error and abstains. Describe explicit mock mode and fail-closed
   provider failure. This is a documentation correction, not a request to make
   runtime silently switch to mock.

3. **Correct slide 20's trace claims.** The digest hashes ordered audit event
   IDs/types, not the complete trace payload. Replace "a hash over the trace"
   with "audit-event digest". Replace "No personal data in the trace" with a
   bounded statement about redacted excerpts, synthetic demo data and imperfect
   redaction. The trace contains patient-provided symptom text and evidence;
   it is not a guarantee that all sensitive data has been removed. Its footer
   also names B-018 while the shown screenshot reads B-015.

4. **Tighten slide 31's boundaries.** "Takeover is available at any point" is
   contradicted by the explicit rejection of takeover after approval. Use
   "Takeover is available during open intake". The categorical "not a medical
   device" statement sits alongside a footer saying no regulatory
   classification has been obtained. Prefer "research prototype; not for
   clinical use; regulatory status not assessed" without claiming a legal
   classification. No legal classification is being made by this review.

5. **Finish the submission references.** README and HANDOFF still link to the
   older MedX-deck.pdf. If v2 is the chosen submission, point those references
   to MedX-deck-v2.pdf. Add real team member names on slide 33 and the final
   public demo/video links when available. Do not invent identities or links.

6. **Keep counts tied to the submitted commit.** Published main has 1,872 tests;
   the local version has 12 additional regressions (1,884 total). The deck's
   1,872 is accurate for its upstream revision. Update counts to 1,884 only when
   those local tests are included in the submission revision. The drug count
   (59), interactions (18) and drugs with doseRange (31) were checked from JSON.

7. **Presentation length is an editorial choice.** Keep the 34-slide version
   as the detailed reference/appendix and use a shorter main pitch for the demo
   video. This is not a newly discovered hackathon slide-count restriction.

The earlier AMD execution gap, font-permission question, lack of measured
task-level benefit and pharmacy "acknowledged/handled" wording remain unchanged
by this pull. The new deck honestly labels AMD as pending; that wording does
not itself satisfy the runtime requirement.

## Tests and inspection

- Focused post-pull checks: **58 tests passed in 3 files**, covering the local
  negation regressions, trace and provider fault/compatibility behavior.
- `git diff --check`: passed.
- Saved tracked patch compared with restored tracked diff: identical.
- Local env and runtime JSON remain ignored; server remains bound to
  127.0.0.1:3000.
- Submission form strings: title **47**, short description **251**, long
  description **1,871** characters. These already meet the previously checked
  form limits; no change needed.
- pdfinfo: actual v2 PDF has **34 pages**, 6,270,353 bytes.
- Rendered the actual exported PDF pages 2, 20, 28, 31 and 33 with Poppler and
  inspected them. Reviewed the relevant HTML/generator text and source map.
  Renderings are in `/private/tmp/medx-deck-latest-review/page-*.png`.
- No full-suite or application rebuild was repeated because upstream application
  and dependency code did not change; the final full-suite/build results remain
  in the preceding local review report.

## Assumptions, risks and open questions

The external medical/economic citations in the new deck were not independently
audited in full in this task. A source-map entry is not proof that the paper
supports every slide claim. Only five selected pages of the actual PDF were
visually inspected, so this is not an all-pages layout approval. There is no
new evidence of an AMD run or font redistribution permission in these commits.

## Next action

Correct the concrete pitch/code mismatches and approval navigation, include the
reviewed local fixes, then synchronize submission references and counts to the
exact revision being submitted. Keep the improved title and the honest
mock/pending-AMD distinctions.
