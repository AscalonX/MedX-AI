# w9 · Doctor report: patient-facing red-flag wording (rules v1.1.1)

## STATUS
done (nothing committed)

## SUMMARY
Patient messages in `packages/shared/src/redflags.json` were rewritten to address w9 clinical-safety SHOULD-FIX 1 and the red-flag part of 2. Version bumped to `1.1.1`. Matching is untouched.

| Issue (w9 review) | Fix |
|---|---|
| Urgent messages promise "You will be seen as a priority" / `คุณจะได้รับการตรวจก่อน` | All 5 urgent rules now say: show this screen to the staff at the desk now; if symptoms get worse or you feel very unwell, tell staff straight away; if not at the clinic, call the emergency number (in Thailand 1669, in Italy 112, elsewhere the local number). Rule-specific advice is kept (SYNC: sit or lie down; ABD: nothing to eat or drink; FEVER-INF: phrased for the baby). |
| TH emergency messages omitted 112 | All 13 emergency messages name "in Thailand 1669, in Italy 112, elsewhere your local emergency number" identically in th/it/en. |
| RF-SUICIDE-01: crisis line only in TH | Support lines are now in **all three** languages: Thailand mental-health hotline 1323 and Italy Telefono Amico 02 2327 2327, plus the emergency numbers. Calm wording ("Thank you for telling us… there are people here who can help"). "Do not leave the patient alone" stays in the clinician `action`. |
| Italian gendered or informal | Formal *Lei* throughout and gender-neutral: removed "Sarà visitato", "solo/a", "resti seduto". Now "Qui ci sono persone che possono aiutarla", "rimanga in posizione seduta o sdraiata", "Se non si trova in clinica". |
| Thai politeness particles | Neutral politeness, no ค่ะ/ครับ anywhere in the file (grep count 0). |
| SHOULD-FIX 5 (bare `ไม่เจ็บหน้าอก` over-escalates) | Listed explicitly as a known false-alarm source in SPEC §7. |

## FILES CHANGED
- `packages/shared/src/redflags.json` (patientMessage only, version 1.1.1)
- `docs/clinical/SPEC.md` (§3 patient-sees row, §7 known false alarm, changelog row 1.1.1)
- `docs/reports/w9-doctor.md`

## TESTS / EVIDENCE
- `node docs/clinical/check-redflags.mjs` → **175 passed, 0 failed, 18 rules**.
- The rewrite script asserted, before writing, that for every rule `match`, `label`, `action`, `severity`, `source`, `negationCues` and `negationWindowChars` are byte-identical to v1.1. It also asserted that no patient message contains "priority", "priorità", "ตรวจก่อน", "ค่ะ", "ครับ", "visitato", "sola", "seduto", and that every message in every language contains both 1669 and 112.
- The Telefono Amico Italia national number 02 2327 2327 was verified by web search: it appears on the organisation's own site, in telefonoamico.it press releases (2022–2024), and replaced 199.284.284 in 2020. Hours are about 9:00–24:00, **not 24 h**, which is why 112 stays in the Italian and English messages too. Sources: https://www.telefonoamico.it/z_site2021/wp-content/uploads/CS_NonStopNatale2024_TAI.docx, https://www.telefonoamico.it/z_site2021/wp-content/uploads/CS_2023_NonStopNatale.pdf
- Thailand 1323 (Department of Mental Health hotline) is carried over from v1.0. It was **not re-verified online in this wave**.

## ASSUMPTIONS
- "Elsewhere your local emergency number" is added to the emergency, urgent and suicide messages so that the three message types read the same way.
- The CONSC-01 message addresses a companion ("bring the person to the desk"), as before.

## RISKS
- The Thai and Italian wording was written by the team clinician, not a native-speaker reviewer, and still needs a native read.
- Patient messages are longer now. The mobile red-flag screen must not truncate the emergency numbers (UI check for the mobile builder).
- The messages tell the patient to show the screen; they do **not** say anyone was notified. This matches MF-1, and the mobile app must not add such a promise.
- SHOULD-FIX 10 (indirect suicide wording, e.g. passive death wish plus stockpiled pills) is **not addressed** in this wave (wording-only scope). It needs new terms built from a new blind set, never the holdout.

## OPEN QUESTIONS / NEXT ACTION
- Mobile builder: render the full `patientMessage` (no truncation) and keep MF-1's corrected "at the desk" copy.
- Orchestrator: schedule the SUICIDE-01 term extension against a fresh blind set (SHOULD-FIX 10).
- Native-speaker check of the TH and IT messages if anyone is available before submission.
