# Retire unused font dependencies

STATUS: done

## Summary

Pulled main from af48f8a to 99a687e before editing. The newer branch had already
migrated the application to Plus Jakarta Sans and Noto Sans Thai and removed
the old font binaries. The user authorized checking, committing and pushing
the remaining cleanup, provided it preserves the working product.

- Removed unused scbxFont, mobile font maps, mobileFont and FontRole exports.
  Repository search found no consumers; the patient app uses its own current
  fontFor mapping. FontWeightName remains because it has active consumers.
- Removed the obsolete CSS fallback from the shared web font stack, and rebuilt
  the patient export so the dead names also leave its generated bundle.
- Replaced missing font paths in four older cover sources and the older README
  banner source with the existing bundled Jakarta files. The Open Graph source
  is among these files; its render script no longer references missing fonts.
- Made the logo generator read canonical vector geometry from wordmark-path.json
  instead of opening a deleted font file. The existing letter outlines remain
  unchanged; this is not a logo redesign or a replacement of their geometry.
- Updated current documentation and removed obsolete font-cleanup warnings.
  The decisions log and historical wave reports retain their history. The
  earlier Track 2 review now explicitly identifies its historical snapshot.
- Removed a stale submission warning about the v2 PDF: its actual embedded font
  names are Jakarta, Noto Sans Thai and Helvetica Neue, with no SCBX font.

## Files changed

- packages/shared/src/tokens.ts
- apps/web/app/{globals.css,layout.tsx}, components/ui/fonts.ts
- Generated apps/web/public/patient bundles, index.html and source.sha
- docs/design/logo/{build.py,wordmark-path.json,readme-banner.html}
- pitch/cover/cover-v{2,3,4}.html and cover-v5-og.html
- pitch/deck/deck.html, pitch/SUBMISSION.md
- README.md, HANDOFF.md, docs/{DECISIONS,PROGRESS,SPEC}.md,
  docs/design/DIRECTION.md and the historical Track 2 review annotation
- This report and docs/reports/screens/2026-10-18-font-cleanup/*.jpg

## Tests run and results

- Full web suite: **2,508 tests passed in 57 files**, 42.89 seconds, exit 0.
- Web production build: compilation, lint/type checks, all 24 static pages,
  optimization and tracing passed. Used MEDX_DIST_DIR=.next-scbx-check to avoid
  touching an existing build. Next's automatic tsconfig path change was restored.
- Patient lint and tsc --noEmit: passed, exit 0.
- Patient web export: passed; source.sha refreshed. Patient-stamp tests passed.
- Logo generator: all 15 generated outputs compared byte for byte with existing
  assets and matched. Running the actual generator also passed and left every
  existing SVG and generated web logo module unchanged.
- All 12 font URLs across five cover/banner sources resolve to existing files.
- No tracked SCBX font filenames or OTF files remain. No SCBX strings remain in
  the rebuilt patient export. Active-code mentions remain only in the existing
  regression assertions that reject the obsolete font.
- git diff --check: passed before staging.

Logs: /private/tmp/medx-scbx-tests.log, /private/tmp/medx-scbx-web-build.log,
/private/tmp/medx-scbx-mobile-lint.log, /private/tmp/medx-scbx-mobile-types.log and
/private/tmp/medx-scbx-patient-build.log.

## Browser evidence

Reviewed the newly built standalone app on 127.0.0.1:3000 using computer use:

- Existing B-014 restored without a new intake. Thai input computed font:
  NotoSansThai_400Regular with PlusJakartaSans_400Regular fallback.
- Landing headline computed stack starts with Plus Jakarta Sans and Noto Sans
  Thai; the layout, brand logo and images rendered correctly.
- The Open Graph HTML source rendered correctly, computed Jakarta for its
  heading, and successfully fetched the 400 and 700 WOFF2 files (HTTP 200).
- Patient, web and cover tabs captured no warnings or errors.

Screenshots: 01-patient-thai.jpg, 02-og-source.jpg and 03-web-landing.jpg under
docs/reports/screens/2026-10-18-font-cleanup/.

Automatic approval review rejected serving the entire repository for preview
because it could expose environment files. The successful alternative copied
only 19 explicitly selected HTML/image/font files into a separate temporary
folder. That loopback preview server was stopped after verification. The
standalone app remains running on loopback.

## Assumptions, risks and open questions

- This cleanup preserves the current UI typefaces and approved outlined logo.
  It does not make a new claim about the origin or licensing of existing artwork.
- Historical reports and decisions intentionally retain historical font names;
  they are not runtime dependencies.
- No clinical logic, model settings, credentials or dependency versions changed.
  No live AMD requests or cloud deployment were performed. Native devices were
  not tested; mobile lint, types and the browser export were checked.
- Existing cover PNGs and Open Graph PNG remain unchanged. Their HTML sources
  now use available fonts for future regeneration. The five source font paths
  were checked; the Open Graph source was visually reviewed.
- No open contract change requests.

## Next action

Commit and push the verified cleanup for the user to review.
