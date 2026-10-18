# W20 report: Landing builder (marketing landing at "/", /demo persona hub, /home, metadata)

## STATUS
partial. All of M-07 is built and unit-tested in my scope. Two parts need a running Next server, which this wave forbids, so they are not done yet:
- the Playwright check that each persona card lands with the right identity selected;
- `curl localhost:3000/` against a real `next build`. I checked the same section order with a static render test and with Playwright on a static render.

Nothing committed.

## SUMMARY
- **`/` is the marketing landing.**
  - `app/page.tsx` is a static server component (`dynamic = "force-static"`), with no AppShell, no ClinicianFrame and no `/api/metrics` polling.
  - Client islands: the nav (language toggle), the video button, and the model label, which reads `/api/health` once.
  - Section ids, in order: `nav, hero, built-with, video, how-it-works, features, safety, why, demo-accounts, phone-and-web, under-the-hood, limitations, cta, footer`. This contains the acceptance order, plus the reference's "why" and "limitations" sections.
- **Hero.**
  - Eyebrow, then the two-tone H1 "Every word, understood." and a subtitle naming Fin as the helper who listens while people decide.
  - Two calls to action: Try the demo (`/demo`) and Watch in 60 seconds (`#video`).
  - Five trust chips, "Synthetic data only" first.
  - The 3D Fin (`FinStage`, `hero-hello`, priority image) with three patient-side cards: language picked, a question read aloud, "Sent. A nurse will review." This is the only Fin on the page.
- **Built-with strip.** Text names only (AMD Developer Hackathon ACT III, Gemma, Next.js, Expo) and the caption "Built for AMD Developer Hackathon ACT III · Track 2. Names only, no partnership implied…". It also says Gemma on AMD is the designed target.
- **Video** (FIXED PATHS `/media/medx-demo.mp4`).
  - The build checks `public/media`. When the file is missing, the section renders a poster-only state ("The 60-second video is on its way" plus Try the demo) instead of a broken player.
  - When the file exists, the player is `<video controls muted playsInline preload="metadata" poster>`, with no autoplay and an optional `.vtt` track (`/media/medx-demo.en.vtt` or `/media/medx-demo.vtt`).
  - A "Play with sound" button under the frame unmutes and plays. It reads "Play" when the MP4 has no `soun` track, which the build reads from the file header.
- **How it works.**
  - Three numbered `StepCard`s; the last is the human step, in teal.
  - "Try saying" chips: EN-01, IT-01, DEMO-GOLD and EN-02 from `DEMO_SAMPLES`, plus the routine Thai fixture TH-01, copied verbatim because DEMO_SAMPLES has no routine Thai example.
  - The build runs `checkRedFlags` on each one, so no red-flag phrase can appear here.
  - Each chip links to `/patient/?new=1&lang=…&sample=…` and is labelled synthetic.
- **Features bento.** 12 cards; 1 ink card (voice intake); 10 cards with real screen crops from `/landing/*.webp`, each with alt text.
  - The red-flag card renders real output: the build runs the deterministic rules on the synthetic TH-05 sample and shows the matched words, the rule id `RF-CHEST-01` with its label, and "zero model calls". Red appears only on this card.
  - The audit card lists real `AUDIT_TYPES` event types from the golden visit, in journey order.
  - Counts (18 rules, 59 drugs, 18 interactions, 31 dose ceilings) are read from `redflags.json` and `medrules.json` at build time, never typed in copy.
- **Safety by design.** Ink band; the headline is "Fin prepares. People decide." (owner decision); 4 cards worded from the README safety bullets.
- **Why.** `StatStrip` with the README's published numbers (Divi 2007 and Sinsky 2016 with DOI links; the 13 to 59% range cites the MedX research notes).
- **Try a role** (`#demo-accounts`). 6 `PersonaCard`s from `DEMO_PERSONAS`, each one link to `/demo/<id>`, with the notice "Synthetic data only. Do not enter real patient information."
- **Phone and web.** A QR code for `${NEXT_PUBLIC_SITE_URL || https://medx.areazeroai.com}/patient/`, built at build time as a single-path SVG in token colours.
- **Under the hood.**
  - The model chip reads `/api/health`: "Demo runs a mock model; Gemma on AMD pending" when the provider is mock, otherwise `{model} on {hardware}` from the server. A test makes sure no copy says "runs on AMD".
  - Tech chips are shown beside it.
- **Limitations.** Taken from the README.
- **Final call to action.** The one primary-gradient panel; no Fin and no 3D mark on it.
- **Footer.** The full claim boundary.
- **Languages.** English at `/`, Thai at `/th`, Italian at `/it` (static routes in `app/(marketing)/`).
  - The EN/ไทย/IT toggle writes `medx.lang`, so the staff app follows, and opens that language's page.
  - The Thai and Italian pages show "native review pending".
  - The document `lang` follows the page.
- **`/demo` (persona hub).**
  - English on first paint, then the language the visitor last chose (`medx.lang`).
  - Shows the persona grid, the patient QR and the live demo counts from the old home page (visits today, awaiting review, in the pharmacy, ready to collect). It polls `/api/metrics` every 10 s, on `/demo` only.
  - The escalation count is left out, so no red appears on a marketing page.
- **`/demo/<persona>` (launcher, static per persona, `noindex`).**
  - Writes `medx.demo.persona`; for staff it also writes `ROLE_STORAGE_KEY`, `medx.clinicianRole` (nurse and doctor) and `reviewerStorageKey(role) = staffName`.
  - Then it calls `POST /api/demo/start {stage: persona.stage}`. On any failure (429, 404 when DEMO_SEED is off, network) it falls back to `GET /api/demo/cases`. Strict-mode double runs are guarded, so there is one case per visit.
  - It then replaces itself with the case:
    - nurse: `/review/<id>`;
    - doctor: `/review/<id>/consult?mode=doctor`;
    - pharmacists: `/pharmacy/<id>`;
    - ops: `/ops`;
    - patient: `/patient/?new=1&lang=…`, a fresh intake, with no case created.
  - Without a case, staff land on their queue.
- **`/home`.** The old staff home moved here unchanged (ClinicianFrame, metrics, QR, journey). The QR colours now come from tokens.
- **Layout and metadata.**
  - `fontVariables` (Plus Jakarta Sans and Noto Sans Thai) is on `<html>`. SCBX is no longer loaded on the web.
  - `metadataBase` is `SITE_URL` (`https://medx.areazeroai.com` unless `NEXT_PUBLIC_SITE_URL` is set), with a title template, Open Graph, Twitter `summary_large_image` and `themeColor` from tokens.
  - Each landing language has its own metadata with `alternates` hreflang.
  - `app/opengraph-image.png` is 1200x630 from `pitch/cover/cover-v4.png`, cropped above the chip row (see Assumptions), with `opengraph-image.alt.txt`.
  - `robots.ts` disallows `/review`, `/pharmacy`, `/ops`, `/api`, `/home` and `/demo/` (opening a persona page starts a demo case).
  - `sitemap.ts` lists `/`, `/th`, `/it` and `/demo`.
- **Landing stills.** 10 WebP files in `apps/web/public/landing/` (217,778 bytes total), cropped from real screenshots in `docs/reports/screens` with no edits. The page reads each file's real aspect from its WebP header, so fresh captures under the same names keep their proportions.

## FILES CHANGED
- Modified:
  - `apps/web/app/page.tsx`: now the landing.
  - `apps/web/app/layout.tsx`: fonts and metadata.
- New pages and routes:
  - `apps/web/app/(marketing)/th/page.tsx`, `apps/web/app/(marketing)/it/page.tsx`
  - `apps/web/app/home/page.tsx`: the old home, moved.
  - `apps/web/app/demo/page.tsx`, `apps/web/app/demo/DemoHub.tsx`
  - `apps/web/app/demo/[persona]/page.tsx`, `apps/web/app/demo/[persona]/Launcher.tsx`
  - `apps/web/app/robots.ts`, `apps/web/app/sitemap.ts`
  - `apps/web/app/opengraph-image.png`, `apps/web/app/opengraph-image.alt.txt`
- New in `apps/web/app/_landing/`:
  - `Landing.tsx`, `Features.tsx`, `Personas.tsx`
  - Client islands: `LandingNav.tsx`, `HealthChip.tsx`, `LandingVideo.tsx`
  - Modules: `copy.ts` (en/th/it), `demoCopy.ts`, `data.ts` (build-time facts), `demo.ts` (persona logic), `nav.ts`, `meta.ts`, `site.ts`
  - `landing.test.ts` (31 tests)
- New stills: `apps/web/public/landing/{patient-voice,hero-consult,nurse-case,consult,orders,pharmacy-verify,pharmacy-dispense,patient-pickup,ops,trace}.webp`
- Evidence: `docs/reports/screens/w20-landing-static-{en-1440-fold,th-390-fold,demo-1440,demo-390-fold}.png` and `w20-landing-static-en-{1440,390}-full.jpg`
- This report.

## TESTS RUN + RESULTS
All commands were run from `apps/web`.

| Command | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit -p .` | exit 0 (whole app, final run) |
| `./node_modules/.bin/eslint app/page.tsx app/layout.tsx "app/(marketing)" app/_landing app/demo app/home app/robots.ts app/sitemap.ts` | exit 0, no output |
| `./node_modules/.bin/vitest run app/_landing components/ui lib/pipeline/__tests__/w20-platform.test.ts` (final) | 4 files, 77/77 pass (landing 31) |
| `./node_modules/.bin/vitest run` (whole suite, before the last nav tweak) | 45 files; 2335 pass, 1 fail. The failure is `llm-api.test.ts > returns health metadata…` (platform's `/api/health` shape change, already reported in w20-platform/w20-engine), not landing code |
| `next build` / `next dev` / `next start` | not run (wave rule) |
| Live Playwright persona check | not run (needs a server) |

`landing.test.ts` checks:
- **Page structure:**
  - section ids in order in all 3 languages;
  - no "Signed in as", no `/api/metrics`, no AppShell or ClinicianFrame in the landing code;
  - one H1, the nav anchors and the demo call to action;
  - the hero's two-tone H1, Fin named in the subtitle and the trust chips.
- **Design rules:**
  - exactly one Fin image, in the hero, with no red there;
  - red only on the red-flag card;
  - 12 cards, 1 ink, at least 9 real crops with alt text; the safety band is the only other dark surface;
  - every still exists and parses as a WebP;
  - 3 steps with the human last, in teal.
- **Content and data:**
  - Try saying samples are verbatim, free of red-flag text, and cover en, th and it;
  - the red-flag card shows the real rule hit;
  - counts come from the rule files;
  - audit rows are real `AUDIT_TYPES`;
  - 6 single-link persona cards;
  - QR SVG in token colours.
- **Live labels and copy:**
  - the model label mapping (mock, amd, not configured, unknown);
  - no "runs on AMD" in any copy;
  - the footer claim boundary;
  - native-review notes on th and it;
  - house style (no em or en dashes, no "!", no banned claims);
  - no raw hex in landing sources.
- **Video:** the poster-only state; video, poster, track and audio detection on a fake MP4; player attributes (`muted`, `controls`, `playsInline`, `preload=metadata`, no autoplay, the button label).
- **Persona entry:**
  - storage writes per persona (`medx.clinicianRole` equals `CLINICIAN_ROLE_KEY` in `useStaffRole.ts`);
  - the landing URL per persona;
  - `/api/demo/start` with the persona stage, falling back to `/api/demo/cases`, then null; no call for the patient or ops.
- **Metadata:** robots, sitemap, layout metadata and fonts, and the PNG size of the OG image (1200x630).

## EVIDENCE
- **Method for the visual check** (no Next server):
  - `Landing` and `DemoHub` rendered to static HTML with vitest and react-dom/server;
  - Tailwind compiled from `globals.css`;
  - served by a small local server that maps `/_next/image` to `public/`;
  - captured with Playwright (Chromium) with `reducedMotion: "reduce"`, after scrolling and waiting for every image.
  - Harness: `C:\Users\User\AppData\Local\Temp\claude\c--Users-User-OneDrive---Mahidol-University-Documents-GitHub-MedX-AI\86cd279c-cfbf-45d5-a5d2-57cf5ffc9ebd\scratchpad\landing-render\`
- **Measured:**

  | Page | scrollWidth | Height (px) |
  |---|---|---|
  | en 1440 | 1440 | 11238 |
  | en 390 | 390 | 16899 |
  | th 390 | 390 | 17353 |
  | it 390 | 390 | 17977 |
  | demo 390 | 390 | 2766 |

  - No element extends past 390px in en, th or it, after two fixes: the Italian "All roles" link now wraps, and the /demo nav call to action is shorter.
  - H1 is 76px at 1440 and 40px at 390.
  - `document.fonts.check` is true.
  - No broken images; no failed requests (no video file exists yet, so no request was made).
- **Screenshots:**
  - `docs/reports/screens/w20-landing-static-en-1440-fold.png`
  - `docs/reports/screens/w20-landing-static-en-1440-full.jpg` (downscaled to 720 wide)
  - `docs/reports/screens/w20-landing-static-en-390-full.jpg`
  - `docs/reports/screens/w20-landing-static-th-390-fold.png`
  - `docs/reports/screens/w20-landing-static-demo-1440.png`
  - `docs/reports/screens/w20-landing-static-demo-390-fold.png`
- **Stills (WebP, crop of the source, native pixels unless noted):**

  | Still | Source | Crop (x, y, w, h) | Output | Bento card |
  |---|---|---|---|---|
  | `patient-voice` | `v3-mobile-voice-6-confirm-ios.png` | 0, 230, 1206, 1508 (×0.6) | 724x905 | Voice intake (ink) |
  | `hero-consult` | `v6-consult-doctor.png` | 284, 150, 1121, 356 | 1121x356 | Consult assistant (wide) |
  | `nurse-case` | `v9-vitals-live.png` | 855, 372, 506, 380 (×1.5) | 759x570 | NEWS2 suggestion |
  | `consult` | `v6-consult-doctor.png` | 284, 1380, 487, 365 (×1.5) | 731x548 | Considerations and signed note |
  | `orders` | `v7-orders.png` | 855, 180, 506, 380 (×1.5) | 759x570 | Orders with checks |
  | `pharmacy-verify` | `w19-pharmacy-return-report.png` | 62, 300, 500, 375 (×1.5) | 750x563 | Pharmacist 1 |
  | `pharmacy-dispense` | `w19-pharmacy-dispense-checklist.png` | 96, 325, 560, 420 (×1.4) | 784x588 | Pharmacist 2 |
  | `patient-pickup` | `w19-patient-pickup-ready-en.png` | 40, 392, 700, 525 | 700x525 | Pickup |
  | `ops` | `final-ops.png` | 150, 262, 320, 183 (×2) | 640x366 | Ops |
  | `trace` | `v11-trace-orders.png` | 272, 180, 1145, 275 | 1145x275 | Case trace (wide) |

  Crops were chosen to keep red off every card except the red-flag card. The two exceptions are listed under Risks.

## ASSUMPTIONS
- **Owner decisions win over M-07 wording where they disagree:**
  - nav label "Try a role" (the section id stays `demo-accounts` and its eyebrow says "Demo accounts");
  - Safety headline "Fin prepares. People decide." (the subtitle says "MedX prepares the record and a clinician approves it");
  - trust chips are the union of both lists (5);
  - the toggle offers EN/ไทย/IT, not EN/TH only;
  - FIXED PATHS replace `/media/medx-60s-v1.mp4` and `/landing/*.png`.
- **Language lives in the URL** (`/`, `/th`, `/it`), so every page is static and shareable. `/` stays English even when `medx.lang` is `th` (owner decision 3: English by default).
- **The patient persona starts a fresh intake** (`/patient/?new=1`), matching its task "Tell Fin what brings you in". It creates no demo-start session. Ops lands on `/ops` with no case call. Both persona types still write `medx.demo.persona`, and ops also writes its identity.
- **Two cards render real output instead of a crop:** the red-flag card (the real rule hit, computed at build time) and the audit card (real event types). The other 10 cards use crops.
- **A 10th still, `patient-voice.webp`, was added** for the ink voice-intake card, because none of the 9 fixed names shows the patient intake. "hero-consult" is used for the consult live summary.
- **OG image:** I cropped the pitch cover above its "Gemma on AMD" chip, because that chip implies the model runs on AMD and DIRECTION 12.1 forbids that claim unless `/api/health` confirms it. The cover's "chest pain" bubble next to Fin is still in the image; it is the pitch lead's owner-approved art, and DIRECTION 12.3 governs the page, not the OG card.
- **Persona initials** come from my `personaInitials` (for example "LC" for Pharmacist Laura Conti). The `PersonaCard` regex turns "Pharmacist" into "PL", so I pass the initials as `icon`.
- **SCBX** is removed from the layout. `globals.css` keeps `--font-scbx` only as a named fallback; the OTF files are untouched.

## RISKS
- **Seeded stills are older UI** (pre-v3 fonts) until the video agent recaptures them. Two seeds show a little red:
  - the `trace` legend's "Escalated" swatch, about 14px;
  - the `consult` crop's bottom edge, which shows amber Needs-check chips (amber is allowed).

  The wide `hero-consult` and `trace` strips are small on phones.
- **No live server check:** next/font, opengraph-image, `force-static` with fs reads, and the dynamic `[persona]` params are type-checked but not built in this wave. `next build` must run on the merged tree.
- **`next/font/google` needs network at build time.** This is fine on Vercel; an offline Docker build would fail, as the design lead noted.
- **The video and stills are read at build time.** A newly added `/media/medx-demo.mp4` needs a redeploy before the player appears. `/media/*` is also cached immutable for 1 year (platform), so a re-cut needs a new filename or a header change.
- **Each staff persona click creates one demo-start session** (cap 150, then 429, then the shared `/api/demo/cases` fallback). Crawlers are kept off by `robots.txt` and `noindex`.
- **The QR points at the production domain** unless `NEXT_PUBLIC_SITE_URL` is set at build. On a preview or local build it still opens production.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
1. **Engine/orchestrator, `packages/shared/src/demo.ts`:** add a routine Thai sample (TH-01, synthetic, `redFlag: false`) to `DEMO_SAMPLES`. The landing already shows TH-01 verbatim. The patient app's deep link (`samples.ts`, `findSample`) only knows DEMO_SAMPLES ids, so `?sample=TH-01` today opens a fresh Thai intake without the prefill.
2. **Video agent:**
   - Recapture the 10 stills above under the same names, in the redesigned UI, as panel crops. Suggested aspects:
     - about 3:1 for `hero-consult` (live summary);
     - about 4:1 for `trace` (graph, without the red legend swatch);
     - 4:5 for `patient-voice` (phone question plus transcript check);
     - about 4:3 for the rest.

     The page reads each file's real aspect within a per-card range (Features.tsx `SPECS`).
   - No red except on the red-flag card.
   - Add the poster `/media/medx-demo-poster.jpg` and captions `/media/medx-demo.en.vtt`.
3. **Clinician builder:** the frame's Home link already points to `/demo`. `/home` (the old staff home) still exists and uses `active="home"`. Decide whether staff should land on `/home` or `/demo`.
4. **Design lead:** run the S-06 sign-off (DIRECTION 12.12) on `/`, `/th` and `/demo` at 1440 and 390 once a server may run.
5. **Orchestrator:**
   - Set `NEXT_PUBLIC_SITE_URL=https://medx.areazeroai.com` on Vercel (optional; it is the default).
   - After `next build`, run `curl -s localhost:3000/ | grep -o 'id="[a-z-]*"'`.
   - Run a Playwright pass that clicks each persona card and reads `localStorage` plus the selected identity on the landing screen.
6. **Pitch lead:** the OG crop removes the cover's "Gemma on AMD" chip. Consider a cover variant without that chip and without the "chest pain" bubble beside Fin.

## NEXT ACTION
- **Orchestrator:** run `next build` on the merged tree, deploy, and run the live persona-card Playwright check.
- **Video agent:** overwrite the stills and add the video, poster and captions.
- **Design lead:** sign off on `/` and `/demo`.
