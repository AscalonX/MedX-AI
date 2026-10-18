# MedX: Every word, understood. 60 s launch film

Final storyboard, version final-1, 18 Oct 2026. Fix round 1 changes are listed under `revisions` in storyboard.json (S04 holds to 12.4, S05 runs 12.4-14.0; end card is one centred column).

**Fix round 2 (18 Oct 2026)** changes the timing below in a few places; `revisions` (round fix-2) in storyboard.json is the full list. In short: S04 is an exposure bloom from 7.85 and runs 0.5 s earlier (logo 9.5, arc lifts at 11.6); S05 runs 11.8-14.1 with all six nodes and FLIPs into the docked rail; every hold has a continuous camera (2-4% push plus parallax); S10 is a macro on the Note signed stamp, S12 a low-angle checklist, S14 a lateral track; four plates are CSS recreations; S16 ends in an exposure-lift dissolve and S17 hands over to the end card through a radial colour bloom from the QR; the end card builds lockup, tagline, pill and keeps light moving (QR static).
**Fix round 4 (18 Oct 2026)**, full list under `revisions` (round fix-4) in storyboard.json:
- **S03** bars share one visible 0-100% track: 49.1% fills just under half and stops at the 50% gridline. The source line is now 26 px.
- **Bloom (7.85-8.5)** is a brand-tinted light. No grey frame.
- **Lockup** holds untouched 9.98-12.0, then exits cleanly. The arc-to-rail match cut is retired; the S05 rail draws itself.
- **One headline system:** 72 px at three anchors. Every line is measured readable for at least 1.2 s (`tools/readcheck.mjs`).
- **No in-place cross-fades:**
  - S10 changes from draft to signed note through a masked wipe;
  - S11 and S15 swap their headlines with a masked push;
  - S07 to S08 is a punch-in cut;
  - S08 to S09 and S09 to S10 are pushes.
- **New shots:** S07 is a split screen (patient phone, nurse fields). S08 is an over-the-shoulder laptop.
- **Phone screens:** S06, S07 and S17 show the real 3x intake capture; S13 shows the real 3x pickup screen.
- **Fin** is not in S17. It enters only on the end card (54.5), on a soft light disc.

**Fix round 6 (18 Oct 2026)**, full list under `revisions` (round fix-6) in storyboard.json. Shot timing, beats and copy are unchanged; only the framing of S10-S12 changes, so 23-36 s no longer repeats "headline plus one flat card":
- **S10** is a slow macro push onto the "Note signed" stamp: from 26.45 the card grows around the stamp until it fills about 70% of the frame width at 27.4, with a shallow depth of field. "Drafted from their words." leaves at 26.97 to make room.
- **S11** is a tilted plate seen from low and to the side (yaw 18 deg, slowly orbiting to 8 deg).
- **S12** opens on the two pharmacist rings in the foreground with the checklist out of focus behind them. Focus racks to the checklist at 32.72 while the rings drift into the left column, and racks back to them at 34.6.
- **S09** is unchanged.

The machine-readable source of truth is `storyboard.json` in this folder. This page is the readable version for review.

**Format:** 60.0 s, 1920x1080, 60 fps (30 fps only if 60 cannot render), H.264 yuv420p, AAC 48 kHz. 120 BPM: 1 beat = 0.5 s, 1 bar = 2.0 s, 30 bars. Every cut lands on the beat grid. No voice-over, so it works muted.

---

## 1. Decision

### Scores (1 to 10)

| Concept | Hook | Clarity | Premium | Conversion | Honesty | Feasibility | Total /60 |
|---|---|---|---|---|---|---|---|
| Every Word Arrived (human story) | **9** | 8 | 8 | 7 | 7 | 6 | 45 |
| **MedX: Every word, understood. (product launch)** | 7 | **9** | **9** | **9** | **9** | **7** | **50** |
| Fin Prepares. People Decide. (trust first) | 7 | 6 | **9** | 6 | **9** | 5 | 42 |

**Winner: the product launch concept.** It is the closest match to the brief: Apple-launch pacing, a silent breath before the bloom reveal, a journey rail that shows progress, and a 10 s CTA with a QR code. Its crops check out against the real stills.

- **Every Word Arrived** has the best emotional spine: one Thai sentence that breaks apart and later holds together. Against it: the Thai and Italian lines were invented, the CTA comes late, the build is heavy, and the stills come from several English demo cases.
- **Fin Prepares** has the best trust positioning. Its metaphors take time to decode at this pace, and the cold open is English only.
- The third concept reached me truncated after its third shot (about 8.4 s). I scored it on its angle, logline and the first three shots.

### What was merged

**Taken from Every Word Arrived**
- The Thai sentence as the spine:
  - it breaks apart in the cold open (S01);
  - it re-forms as the Thai pickup line (S13);
  - it returns and holds as a sourced chip (S16).
- Fin's sound arcs morph into the arcs of the logo (S04).
- The "Synthetic demo data" micro-tag.
- LC and NW pharmacist avatars (S12).
- Six rising pentatonic plucks for the six checks.
- A calm, low alert tone.
- A piano motif that hangs at 0:02 and resolves at 0:48.
- A gradient end card.

**Taken from Fin Prepares**
- The line "Some words can't get lost." (S02).
- Rack focus plus the app's dotted evidence underline (S01, S16).
- A light gate in front of the model nodes (S14).
- A dual-key seal for the two-person check (S12).
- An append-only ledger (S15).
- "MedX prepares. People decide." (S15), adapted from "Fin prepares. People decide." Fin is not on screen in the trust band, so the product carries the line.
- Glass capsule stat bars (S03).

### Compliance fixes I made as judge
- **Thai patient line.** The invented "ฉันแพ้ยาเพนิซิลลิน" is replaced by the team's own synthetic case MED-01: **"แพ้เพนิซิลลิน กินแล้วผื่นขึ้นตามตัว"**, gloss "Allergic to penicillin. It gave me a rash all over." Its gold field is *Penicillin (rash)*, which matches the allergy card shown later.
- **Italian line.** The invented "Ha allergie?" is replaced by the real app string "Che cosa la porta qui oggi?".
- **Fin art.** Only the `fin3d-*` art is used. It matches the Fin inside the patient app. `fin-hello` and `fin-wave` are a different render style and would look like a second mascot.
- **Cropped out:**
  - the trace legend (it has the red "Escalated" swatch) and the ungrammatical "1 human decisions";
  - "burning urination" in the note still (another case);
  - the partial-vitals bullets on the triage card;
  - the sticky sign-off bar;
  - every case code except the patient's own pickup code B-015.
- **Stat bars.** The 49.1% bar is white, not brand teal and not red, so the brand never reads as "harm".
- **No model claims.** There is no Gemma / AMD / accuracy claim, per the rule in pitch/VIDEO-SCRIPT.md.

---

## 2. The film at a glance

| Time | Shot | On screen | What we see |
|---|---|---|---|
| 0.0-3.0 | S01 Cold open | แพ้เพนิซิลลิน กินแล้วผื่นขึ้นตามตัว, gloss "Allergic to penicillin. It gave me a rash all over." | Thai line forms on a voice waveform in an ink void, then breaks into particles |
| 3.0-4.5 | S02 | **Some words can't get lost.** | Thai chip and the clinic's Italian question; the dashed line between them snaps |
| 4.5-8.0 | S03 | **Language gaps cause harm.** 49.1% vs 29.5% | Glass bars count up. Source on screen: *Divi et al., Int J Qual Health Care 2007 · six US hospitals*. Black breath at 7.75 |
| 8.0-12.4 | S04 Reveal | MedX / **Every word, understood.** | Light bloom to mist studio; Fin (listening) rises; its sound arcs fly into the logo |
| 12.4-14.0 | S05 | **From first words to the pharmacy counter.** | Journey rail: Patient, Nurse, Doctor, Pharmacist 1, Pharmacist 2, Pickup. It then docks at the bottom until 39 s |
| 14.0-18.0 | S06 Patient | **Speak your own language. / Check the words. Then send.** | Three generic phones: real English intake plus Thai and Italian recreations using exact app strings |
| 18.0-21.0 | S07 Nurse | **Every field points back to their words.** | Patient's words panel threaded to the "From patient's words" chips |
| 21.0-23.0 | S08 Nurse | **Triage suggested. The nurse confirms.** | Suggestion card, then "Triage confirmed by Nurse A. Rossi" |
| 23.0-25.5 | S09 Doctor | **Considerations for the doctor.** small: Not a diagnosis. The doctor decides. | Real Considerations card, "Keep in note" press |
| 25.5-28.0 | S10 | **Drafted from their words. / Signed by a clinician.** | Amber draft banner, then the teal "Note signed" stamp; slow macro push onto the stamp (card about 70% of the frame by 27.4) |
| 28.0-32.0 | S11 Pharmacist 1 | **A rule check flags the allergy. / Options go back to the prescriber.** small: Not a prescription. The prescriber decides. | **The only red in the film:** the app's own High allergy alert (amoxicillin vs penicillin). Then clarithromycin is ticked and "Return with report" pressed. Tilted plate from a low side angle |
| 32.0-36.0 | S12 Pharmacist 2 | **A second pharmacist. Six final checks. / Never the same person.** | LC and NW rings lock into a seal in the foreground, the checklist out of focus behind; rack focus to the checklist; six checks tick on the beat; "6 of 6 confirmed" |
| 36.0-39.0 | S13 Pickup | ยาของคุณพร้อมแล้ว (Your medicine is ready.) / **Ready at counter 2.** | Pickup card on a phone; the Thai line forms from particles; the rail completes |
| 39.0-42.0 | S14 Trace | **Red-flag rules run before any model.** tag: Every step in the audit log | Real Case trace graph; a light gate holds the pulse until the rule check passes |
| 42.0-46.0 | S15 Trust | **No quote? It shows "Needs check." / MedX prepares. People decide.** | Ink band, the three state chips (ocean / amber / teal) and the append-only ledger |
| 46.0-50.0 | S16 Callback | the same Thai line, then **This time, every word arrived.** | The line starts to scatter, then locks; a thread runs to the real allergy card "penicillin · Reaction: rash · From patient's words" |
| 50.0-54.0 | S17 CTA | **Try the live demo.** medx.areazeroai.com, QR "Scan to try" | Browser plate and intake phone float on mist; Send is tapped at 51.0. No Fin here (fix round 4). No store badges |
| 54.0-60.0 | S18 End card | MedX / **Every word, understood.** / Try the live demo / URL / QR / *Research prototype · Synthetic data · Not a medical device* | Brand gradient. Fully static from 57.5 so the QR scans. No fade to black |

The QR code is on screen from 51.5 to 60.0 s (8.5 s).

---

## 3. Shot notes for the build

**S01 Cold open (0.0-3.0)**
- Look: ink vignette, 3% grain, one teal key light.
- Type: Noto Sans Thai 600 at 88 px, line-height 1.45.
- Glyph timing: glyphs reveal on the waveform peaks at 0.5, 1.0 and 1.5. At 1.6 the clause "แพ้เพนิซิลลิน" stays sharp while the rest softens. At 2.2 about 450 canvas particles, sampled from the text alpha, drift away.
- Micro-tag: "Synthetic example".

**S02 (3.0-4.5)**
- Layers: a frosted "ไทย" chip in front; "Che cosa la porta qui oggi?" defocused behind.
- Headline: 96 px, 800 weight.
- The dashed line snaps on the 4.0 beat. A push-through into black hands off to the stat.

**S03 Stat (4.5-8.0)**
- Numbers count up with tabular figures.
- Source line: 20 px, bottom-left, on screen the whole time the numbers are visible.
- Black breath at 7.75-8.0.

**S04 Reveal (8.0-12.0)**
- Fin: `fin3d-listening` at up to 460 px.
- Logo: inline the SVG lockup. Its two arc paths are separate elements, so Fin's arcs can tween into them.
- Fix round 4: hold the complete lockup 9.98-12.0 (2.0 s) with a 4% push and a light sweep at 10.9. Exit cleanly at 12.0: lift, soften and fade over 0.16 s. The arc-to-rail match cut is retired.

**S05 Rail (12.0-14.0)**
- Nodes pop on 8th notes.
- The rail then docks at y 1004, 1040 px wide. The current role is lit, done roles are teal, and it never turns red.

**S06 Patient (14.0-18.0)**
- Centre phone: the real `patient-voice` capture, with the case pill cropped.
- Thai phone (recreation): q1, the MED-01 sentence in the transcript box, "คุณพูดแบบนี้ใช่ไหม" and "ส่ง".
- Italian phone (recreation): q1 and "In ascolto" with a waveform, and no invented Italian transcript.
- Language chips glow at 14.5, 15.0 and 15.5. Highlighter at 16.0, Send at 17.0.

**S07 Nurse (18.0-21.0)**
- Two sharp crops float in front of a blurred laptop (the blur hides the case code).
- Evidence threads at 18.8 ("sore throat for two days" to its chip) and 19.6 ("24 year old man" to "24 years").

**S08 Triage (21.0-23.0)**
- Suggestion card, then a mask-wipe to the confirmed block on the 22.0 clap.

**S09 Doctor (23.0-25.5)**
- Real Considerations card.
- The background plate is the transcript column, never the red Rule-out column.

**S10 Note (25.5-28.0)**
- Amber first, then the teal signed stamp at 26.5.
- Fix round 6: macro push onto the stamp. From 26.45 the note rig scales 1 to 1.62 around the stamp (0.95 s), so the card fills about 70% of the frame width by 27.4 (left edge x 580, top y 206). It then creeps 3% to the cut. The empty right end of the teal boxes runs off the frame; every text line stays inside.
- Depth of field: the card title (1.2 px) and the lines below the stamp row (1.8 px) soften; the bokeh behind moves less than the card.
- "Drafted from their words." leaves 26.97-27.15 (readable 1.23 s); "Signed by a clinician." stays to the cut, 40 px clear of the card.
- Hard cut on the 28.0 bar line, with no flourish.

**S11 Pharmacist 1 (28.0-32.0)**
- Stage at 85% with an ink tint; Fin absent.
- Fix round 6: the card is a tilted plate seen from low and to the side (yaw 18 deg, camera 7 deg below, roll -1.6 deg). It orbits slowly toward the front and is still turned 8 deg at 31.75. It sits 80 px right of centre.
- One red rim pulse at 28.6, gone by 29.4, never flashing.
- Options plate, the clarithromycin tick at 30.6, "Return with report" at 31.3, then the "Returned to prescriber: 1" chip in the warn style.

**S12 Pharmacist 2 (32.0-36.0)**
- The `pdisp-full` Stage 2 crop shows all six rows at one scale, with the patient code blurred.
- Fix round 6: the LC and NW rings open in the foreground (1.4x, sharp) over the checklist, which is out of focus (blur 9 px).
  - 32.72: focus racks to the checklist (0.3 s) while the rings drift down-left into the left column (0.78 s), clear of every row before its tick.
  - 34.6: focus racks back to the rings ("Never the same person").
- Seal at 32.3-32.5.
- Ticks at 33.00 / 33.25 / 33.50 / 33.75 / 34.00 / 34.25.
- Caption is the app's own rule text: "A second pharmacist must dispense".

**S13 Pickup (36.0-39.0)**
- `pickupReadyTitle` in Thai forms from particles, the reverse of S01.
- The big "2" pops at 36.6 with the counter chime.

**S14 Trace (39.0-42.0)**
- Nodes light on 8ths.
- The gate scans from 39.75 to 40.5, then the pulse passes into the model nodes.
- The summary row is a CSS recreation of "8 steps · 4 rule checks · 2 model calls", because the source still clips the "8".

**S15 Trust (42.0-46.0)**
- Ink band.
- Chips: From patient's words (ocean), Needs check (amber, dashed), Approved (teal).
- Ledger rows use only real step labels and end at "Append-only audit log".

**S16 Callback (46.0-50.0)**
- Same Thai line, position and timing as S01.
- Rack focus and the dotted underline at 47.0. The glyphs tremble at 47.4 and then lock.
- A thread runs to the real allergy card from `pverify-full`.

**S17 CTA (50.0-54.0)**
- Devices: the Live summary browser plate and the intake phone (real 3x capture), side by side. No patient-home capture here, because it contains Fin.
- Fix round 4: no Fin in S17. `fin3d-pointing` appears only on the end card (54.5), left of the QR, on a soft light disc.
- The URL types on from 50.9. The QR appears at 51.5.

**S18 End card (54.0-60.0)**
- Layout:
  - white lockup at 420 px, top at y 210;
  - tagline at y 430;
  - pill and URL at y 600;
  - Fin at x 1130-1400 pointing at the QR;
  - QR at x 1460-1780;
  - claim line at baseline y 1030, 24 px, white at 90%.
- Static from 57.5.

---

## 4. Music and sound

Original score, written in our own Python/numpy code. No samples, no third-party music. D major, opening in B minor.

| Time | Section | What happens |
|---|---|---|
| 0-8 | Intro / problem | Room tone, B-minor pad. The piano motif B3-D4-F#4 lands on the Thai syllables, then hangs on E4. Then the glyph scatter, the snap, the count ticks and a riser. **Silence at 7.75-8.0** |
| 8-12 | Reveal | Impact plus D(add9) bloom, Fin pop, logo bell, shimmer |
| 12-28 | Journey groove | Kick, clap, 16th pluck arpeggio, sub bass. D - A/C# - Bm - G. Piano counter-melody from 24 |
| 28-32 | Safety dip | Drums out, pad low-passed. **One calm alert (B2 + F#3, 0.6 s, never a siren)**. Filter reopens from 30 |
| 32-39 | Return and chorus | Full drums. Six check plucks D E F# A B D. Chorus lift at 36. Counter chime at 36.6 |
| 39-42 | Trace | Kick plus shaker, node blips, gate scan and pass chime |
| 42-46 | Breakdown | Warm pad, sparse piano, heartbeat |
| 46-50 | Callback | Motif returns and **resolves E4 to D4 at 48.0-48.5** (the musical "understood") |
| 50-54 | Final chorus | Brightest groove |
| 54-60 | Outro | Final impact, last bell at 56, ring-out to silence by 59.8 |

Mix target: -14 LUFS integrated, true peak at or below -1 dBTP. The alert sits 3 dB under the groove. Every SFX time is listed in `storyboard.json` under `sfx`.

---

## 5. Brand and claim rules (QA checklist)

- **Red** only in S11. That means the app's alert card and one rim pulse. No red in the stat, the trace legend, the Rule-out cards or the rail.
- **Fin** in S04 and S18, and inside the S13 pickup UI still (the app's own calm pickup card, non-alert). Since fix round 4, Fin is not in S17: it never shares a frame with clinical UI. It is never in S11, S14 or S15 and never next to alert content. Use only the `fin3d-*` family.
- **Claim line** is on screen 55.6-60.0 s. The statistic is verbatim from README "Why", with its source on screen.
- **Verbs** are limited to prepares, points back, flags, suggests and checks. Never diagnoses, prescribes, decides urgency or "AI doctor". No Gemma / AMD claims.
- **CTA** is "Try the live demo" plus medx.areazeroai.com plus a locally generated QR. No store badges.
- **Micro-tag** "Synthetic demo data" (16 px, 55%) appears on every UI shot. Case codes must be unreadable.
- **Recreations** (CSS) are allowed only where listed, using tokens and exact app copy.
- **Originality:** fonts are Plus Jakarta Sans and Noto Sans Thai (OFL, local @fontsource); devices are CSS with no Apple marks; all audio is generated by our code. No emoji, no sparkles, no chat bubbles.

## 6. Assets

- **One assets map.** Every image is loaded through the map in `storyboard.json` (`assets`).
- **Same file names.** Files are copied to `promo/assets/<group>/` under their original names, so the 2x UI refresh can be dropped in for a re-render.
- **Normalized crops.** Crops are fractions of each image. I checked them by eye against today's stills on 18 Oct.
- **Upscaling.** Never upscale a 1x still past 1.4x.

## 7. Open questions

1. A native speaker should check the Thai line (from synthetic case MED-01) and its English gloss.
2. Today's UI stills are English-language demo cases. Re-capturing the Thai MED-01 case in the polished UI would make the Thai thread literally true on screen. That means the nurse case and the pharmacist allergy card.
3. Confirm that medx.areazeroai.com is live before publishing.
4. After the 2x refresh, re-check every crop. The trace summary must stop before "1 human decisions".
