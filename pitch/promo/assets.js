/* MedX promo: ONE map of every image the film loads.
 *
 * UI stills are referenced by their original file names (assets/ui/<name>), so the 2x refresh is a
 * drop-in: run tools/sync-assets.mjs, then re-render.
 *
 * Every crop / hot / patch / blur rect is a COMPONENT BOUNDING BOX in native pixels
 * [x0, y0, x1, y1] of the still it was measured on (`native`, measured with tools/measure.py on
 * 18 Oct 2026). Crops sit inside one component's own background, never through a container border;
 * the film's CSS card supplies the frame and an equal padding on all sides.
 *
 * Refresh rules (timeline.js applies them at load time):
 *  - same aspect ratio as `native` AND a clean pixel ratio (1x, 1.25x, 1.5x, 2x, 2.5x, 3x; for example a 2x
 *    capture of the same page): every rect is scaled by
 *    naturalWidth / native[0], so the crops stay on the same components;
 *  - anything else (other aspect, or an odd size such as 828 px for a 1000 px layout): the layout changed,
 *    so the boxes are no longer valid. The film falls back
 *    to the frozen copy in `verified` (assets/ui-verified/) and records a warning in
 *    window.__assetWarnings (the renderer prints it). Re-measure the boxes, then update `native`.
 *  - upscale guard: a crop shown above 1.4x of its own pixels records a warning (not an error).
 */
window.ASSETS = {
  ui: {
    patientIntake: {
      src: 'assets/ui/patient-voice.webp', verified: 'assets/ui-verified/patient-voice.webp', native: [720, 900],
      // question card + transcript box + "Synthetic example" + "Check this example before you send it."
      // (stops in the white gap above the next line, so no half line shows)
      crop: { screen: [0, 22, 720, 853] },
      hot: { line1: [97, 324, 562, 362], line2: [97, 374, 554, 411], confirm: [77, 817, 612, 846] },
      cardEdge: [36, 683], // main white card, left/right edge (continued below the crop in CSS)
    },
    nurseCase: {
      src: 'assets/ui/case.png', verified: 'assets/ui-verified/case.png', native: [1280, 720],
      crop: {
        patientWords: [875, 104, 1233, 288],   // "Patient's words" title, meta row, paragraph
        chiefComplaint: [286, 364, 728, 410],  // Chief complaint row (whole card content)
        ageRow: [286, 456, 728, 546],          // "Patient" header + Age row + "Patient wrote"
        plate: [0, 0, 1280, 720],              // whole screen, blurred, as a depth plate
      },
      hot: {
        sorePhrase: [944, 173, 1112, 193], agePhraseA: [1176, 219, 1230, 238], agePhraseB: [877, 241, 968, 259],
        soreChip: [568, 370, 724, 392], ageChip: [548, 499, 705, 522],
      },
      blur: { caseCode: [289, 109, 393, 148], nextCase: [448, 277, 572, 310], queueBadge: [186, 215, 218, 243] },
      notes: 'Plate is blurred as a whole; case codes and the red queue badge get an extra grey blur (red stays reserved for S11).',
    },
    triage: {
      src: 'assets/ui/nurse-case.webp', verified: 'assets/ui-verified/nurse-case.webp', native: [1000, 752],
      crop: {
        suggestion: [52, 48, 948, 258],   // badge, "Suggested triage level 3", scale line, NEWS2 bullet
        confirmed: [62, 304, 938, 662],   // inside the teal-bordered box: check + title + Level / Confirmed by / At
      },
      hot: { check: [89, 324, 157, 393] },
    },
    consultFull: {
      src: 'assets/ui/consult-full.png', verified: 'assets/ui-verified/consult-full.png', native: [1280, 1648],
      crop: {
        considerations: [846, 1159, 1249, 1431], // inside the Considerations box border
        transcriptPlate: [262, 732, 832, 1176],  // Live transcript card (blurred depth plate)
        draftNote: [288, 1472, 1240, 1567],      // (unused since fix round 2: S10 uses a CSS recreation)
      },
      hot: { notDiagnosis: [1006, 1204, 1083, 1207], keepInNote: [865, 1379, 988, 1414] },
      notes: 'Never show x > 830 for y 440-1100 (red Rule-out cards).',
    },
    patientPickup: {
      src: 'assets/ui/patient-pickup.webp', verified: 'assets/ui-verified/patient-pickup.webp', native: [720, 554],
      crop: { codeCard: [0, 0, 720, 350] }, // the whole "Your code" card with its own corners and shadow
      notes: 'Below the code card the phone shows a CSS recreation of the counter card (exact app copy), because this still cuts the counter number.',
    },
  },
  // Fix round 2: these four plates were 1x stills shown at 9-13 px body text. They are now token-based CSS
  // recreations with the exact app copy (index.html): S10 draft + signed note (consult _c18n.ts draftNote,
  // noteDisclaimer, signedNote, signedBanner, signedTitle), S11 Options plate ((pharmacy)/_orders.tsx suggestTitle,
  // suggestHint, fromTable, returnOrder), S16 allergy entry, S17 Live summary (_c18n.ts summary + hero-consult values).
  // Kept here, NOT loaded, so a later 2x refresh can bring a still back by moving its entry into `ui`.
  retired: {
    note: {
      src: 'assets/ui/consult.webp', verified: 'assets/ui-verified/consult.webp', native: [1000, 650],
      crop: { signed: [20, 22, 980, 230] }, // title, read-only strip, Note signed banner, Presenting complaint
      hot: { signedIcon: [38, 117, 74, 153] },
      // paint the banner's own tint over the Write orders / Next case buttons (the next-case code must not show)
      patch: { buttons: [714, 106, 964, 162, '#E2F5F1'], buttonShadow: [714, 160, 952, 166.6, '#E2F5F1'] },
    },

    pharmacyVerify2: {
      src: 'assets/ui/pharmacy-verify.webp', verified: 'assets/ui-verified/pharmacy-verify.webp', native: [1000, 394],
      crop: { options: [14, 14, 986, 265] }, // inside the Options box: title, two options, dictionary field, buttons
      hot: { clarCheck: [31, 62, 48, 79], returnBtn: [20, 230, 145, 258] },
      notes: 'Still shows clarithromycin already ticked; an unticked overlay sits on it until 30.6 s.',
    },

    pverifyFull: {
      src: 'assets/ui/pverify-full.png', verified: 'assets/ui-verified/pverify-full.png', native: [1280, 2099],
      crop: { allergyEntry: [286, 1549, 520, 1653] }, // penicillin / Reaction: rash / From patient's words
    },

    heroConsult: {
      src: 'assets/ui/hero-consult.webp', verified: 'assets/ui-verified/hero-consult.webp', native: [1400, 236],
      crop: { summary: [30, 32, 1244, 208] }, // Live summary card content
    },
  },
  brand: {
    finListening: { src: 'assets/brand/fin3d-listening-512.png', native: [417, 417] },
    finPointing: { src: 'assets/brand/fin3d-pointing-512.png', native: [379, 379], tip: [0.87, 0.42], vis: [0.108, 0.037, 0.889, 0.963] }, // vis = alpha bbox (fractions)
  },
  logo: {
    lockupColor: 'assets/logo/lockup-color.svg',
    lockupWhite: 'assets/logo/lockup-white.svg',
  },
  data: {
    qr: 'assets/data/qr.svg',
    url: 'medx.areazeroai.com',
    pickupCode: 'B-015',
  },
  // CSS recreations (exact app copy, token colours). Sources are noted next to each string.
  copy: {
    // apps/web/app/(pharmacy)/_orders.tsx CHECK_ITEMS labels and OL.checklist
    checklistTitle: 'Six-item final check',
    checks: ['Right patient', 'Right drug', 'Right dose', 'Right route', 'Allergies re-checked', 'Labelled'],
    // packages/shared/src/medrules.json messages.allergy_conflict + pharmacy _lib.ts allergy_conflict label
    alert: {
      drug: 'amoxicillin 500 mg', detail: 'oral · three times daily · 5 days · penicillin',
      badge: 'High', title: 'Allergy conflict', rule: 'MR-ALLERGY-PEN',
      message: 'This medicine may conflict with an allergy the patient reported.',
      action: 'Check: Confirm the allergy (what reaction, when) and the product before any dose.',
    },
    // apps/mobile/src/i18n.ts (en): pickupEyebrow, pickupCounter, pickupReadyBody
    pickup: { eyebrow: 'Pharmacy', counter: 'Counter', counterNo: '2', body: (code) => `Please go to pharmacy counter 2 and show code ${code.replace(/-/g, '‑')}.` },
    // Case trace (trace.webp): 8 steps · 4 rule checks · 2 model calls
    trace: [
      ['Human', '1. Human', 'Patient turn'], ['Rule', '2. Rule', 'Redact personal data'], ['Rule', '3. Rule', 'Red-flag rules'],
      ['Model', '4. Model', 'Model red-flag screen'], ['Model', '5. Model', 'Model extraction'], ['Rule', '6. Rule', 'Verify against patient words'],
      ['System', '7. System', 'Next question'], ['Rule', '8. Rule', 'Order checks'],
    ],
  },
};
