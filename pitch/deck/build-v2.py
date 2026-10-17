#!/usr/bin/env python3
# Generates deck-v2.html (1440x810 slides). Run: python3 pitch/deck/build-v2.py
import os
HERE = os.path.dirname(os.path.abspath(__file__))
SECTIONS = ["Situation Analysis", "Solution & Tech", "Business Model", "Impact", "Sustainability"]
SLIDES = []

CSS = r"""
@font-face{font-family:"SCBXBeta2";src:url("fonts/SCBXBeta2-Light.otf");font-weight:300}
@font-face{font-family:"SCBXBeta2";src:url("fonts/SCBXBeta2-Regular.otf");font-weight:400}
@font-face{font-family:"SCBXBeta2";src:url("fonts/SCBXBeta2-Bold.otf");font-weight:700}
@page{size:1440px 810px;margin:0}
:root{--teal:#08716A;--tealb:#0A8077;--ocean:#1A5CBF;--oceanb:#1A5FC4;--ink:#0F1E2E;--soft:#45566A;--gr:#56657A;--desk:#EEF3F6;--rule:#E3E9EF;--red:#BE1B2B;--redt:#FDEAEC;--warn:#8F4508;--warnt:#FEF2D7;--tealt:#E1F4F1;--oceant:#E5EEFB;--grad:linear-gradient(135deg,#0A8077,#1A5FC4)}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#c9d3da;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"SCBXBeta2","Helvetica Neue",Arial,sans-serif;color:var(--ink)}
.slide{width:1440px;height:810px;position:relative;overflow:hidden;page-break-after:always;break-after:page;background:var(--desk)}
@media screen{.slide{margin:0 auto 20px}}
.hd{position:absolute;left:56px;top:22px;font-size:15px;font-weight:700;color:var(--ink)}
.hd span{color:var(--gr);font-weight:400}
.lg{position:absolute;right:56px;top:18px;height:26px}
.kick{position:absolute;left:56px;top:56px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--teal);font-weight:700}
.h{position:absolute;left:56px;top:76px;right:56px;font-size:26px;line-height:1.15;font-weight:700;letter-spacing:-.01em}
.body{position:absolute;left:56px;right:56px;top:128px;height:506px}
.qb{position:absolute;left:56px;right:56px;top:644px;height:54px;border-radius:27px;background:linear-gradient(90deg,#E1F4F1,#E5EEFB);display:flex;align-items:center;padding:0 22px 0 66px}
.qb img{position:absolute;left:8px;top:-8px;height:62px}
.qb b{font-size:15px;font-weight:700;color:var(--ink)}
.qb i{font-style:normal;font-size:12.5px;color:var(--soft);margin-left:10px}
.src{position:absolute;left:56px;right:140px;top:703px;font-size:11px;line-height:1.3;color:var(--gr)}
.pills{position:absolute;left:56px;bottom:20px;display:flex;gap:8px}
.pill{font-size:12px;padding:5px 18px;border-radius:999px;border:1px solid #cdd7df;color:var(--gr);background:#fff}
.pill.on{background:var(--grad);color:#fff;border-color:transparent;font-weight:700}
.pn{position:absolute;right:56px;bottom:18px;width:30px;height:30px;border-radius:50%;background:var(--grad);color:#fff;font-size:13px;font-weight:700;display:grid;place-items:center}
.row{display:flex;gap:14px;height:100%}
.col{display:flex;flex-direction:column;gap:12px}
.card{background:#fff;border:1px solid var(--rule);border-radius:14px;padding:16px 18px;box-shadow:0 3px 14px rgba(15,30,46,.06);position:relative}
.card.t{border-top:4px solid var(--tealb)}.card.o{border-top:4px solid var(--oceanb)}.card.w{border-top:4px solid #D9A93A;background:#FFFBF0}.card.r{border-top:4px solid var(--red);background:#FFF8F8}
.card.g{background:var(--grad);color:#fff;border:0}
.tag{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--teal);margin-bottom:6px}
.card.r .tag{color:var(--red)}.card.w .tag{color:var(--warn)}.card.g .tag{color:#cdeee9}
.num{font-size:52px;line-height:1;font-weight:700;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;white-space:nowrap}
.num.red{background:none;color:var(--red)}.num.w{background:none;color:#fff}
.num small{font-size:.5em}
.lab{font-size:16px;line-height:1.3;color:var(--ink);margin-top:6px}
.lab b{font-weight:700}
.sm{font-size:14px;line-height:1.3;color:var(--soft);margin-top:4px}
.ss{font-size:11.5px;line-height:1.25;color:var(--gr);margin-top:6px}
.card.g .lab,.card.g .sm,.card.g .ss{color:#fff}
.card.g .ss{opacity:.8}
.f1{flex:1}.f2{flex:2}.f3{flex:3}
table{border-collapse:collapse;width:100%;font-size:14.5px}
th{background:var(--ink);color:#fff;text-align:left;padding:8px 12px;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase}
td{padding:10px 12px;border-bottom:1px solid var(--rule);vertical-align:top;line-height:1.3;background:#fff}
td b{font-weight:700}
.chip{display:inline-block;font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;background:var(--tealt);color:var(--teal);white-space:nowrap}
.chip.r{background:var(--redt);color:var(--red)}.chip.w{background:var(--warnt);color:var(--warn)}.chip.o{background:var(--oceant);color:var(--ocean)}.chip.n{background:#EDF1F5;color:var(--soft)}
.bar{height:16px;border-radius:8px;background:#EDF1F5;position:relative;overflow:hidden}
.bar i{position:absolute;left:0;top:0;bottom:0;border-radius:8px;background:var(--grad)}
.bar i.red{background:var(--red)}.bar i.gr{background:#9AA8B8}
.bl{display:flex;align-items:center;gap:10px;font-size:14px;margin-top:10px}.bl>span:first-child{width:120px;color:var(--soft)}.bl .bar{flex:1}.bl>span:last-child{width:52px;text-align:right;font-weight:700}
.shot{border-radius:10px;border:1px solid var(--rule);box-shadow:0 4px 16px rgba(15,30,46,.10);display:block;width:100%;height:auto}
.sw{position:relative}
.co{position:absolute;width:24px;height:24px;border-radius:50%;background:var(--ocean);color:#fff;font-size:13px;font-weight:700;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);transform:translate(-50%,-50%)}
.ol{list-style:none;counter-reset:c}.ol li{counter-increment:c;position:relative;padding-left:34px;margin-bottom:11px;font-size:15px;line-height:1.3}
.ol li:before{content:counter(c);position:absolute;left:0;top:0;width:23px;height:23px;border-radius:50%;background:var(--ocean);color:#fff;font-size:12.5px;font-weight:700;display:grid;place-items:center}
.ol li b{display:block;font-size:16px}
.ol li span b{display:inline;font-size:inherit}.ol li span{color:var(--soft);font-size:13.5px}
.step{background:#fff;border:1px solid var(--rule);border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.3;flex:1;position:relative}
.step b{display:block;font-size:13.5px;margin-bottom:3px}
.step.red{background:var(--redt);border-color:#f2b9bf}.step.red b{color:var(--red)}
.arr{align-self:center;color:var(--gr);font-size:18px}
.blk{background:var(--ink);color:#fff;border-radius:12px;padding:14px 18px;font-size:15.5px;line-height:1.35}
.blk b{color:#9fe3da}
.pend{display:inline-block;background:var(--warnt);color:var(--warn);border:1.5px dashed #D9A93A;border-radius:8px;padding:1px 8px;font-weight:700;font-size:.92em;white-space:nowrap}
.tgt{display:inline-block;background:var(--oceant);color:var(--ocean);border-radius:8px;padding:1px 8px;font-weight:700;font-size:.92em;white-space:nowrap}
.cover{background:#0c3a52}.cover img.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cover .cap{position:absolute;left:56px;bottom:26px;font-size:15px;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.5)}
.big table{font-size:15.5px}.big td{padding:11px 14px}.big th{font-size:13px;padding:11px 14px}.gs{background:var(--grad);color:#fff}
"""

def esc(s): return s

def slide(sec, kick, head, body, quote, follow, src="", extra=""):
    SLIDES.append(dict(sec=sec, kick=kick, head=head, body=body, quote=quote, follow=follow, src=src, extra=extra))

def card(inner, cls="", st=""):
    return f'<div class="card {cls}" style="{st}">{inner}</div>'

def stat(tag, num, lab, src="", cls="", numcls="", st=""):
    return card(f'<div class="tag">{tag}</div><div class="num {numcls}">{num}</div><div class="lab">{lab}</div><div class="ss">{src}</div>', cls, st)

def shot(path, cos=(), st=""):
    c = "".join(f'<div class="co" style="left:{x}%;top:{y}%">{i+1}</div>' for i, (x, y) in enumerate(cos))
    return f'<div class="sw" style="{st}"><img class="shot" src="{path}">{c}</div>'

def ol(items):
    return '<ol class="ol">' + "".join(f'<li><b>{a}</b><span>{b}</span></li>' for a, b in items) + '</ol>'

def flow(steps):
    out = []
    for s in steps:
        cls, a, b = (s if len(s) == 3 else ("", *s))
        out.append(f'<div class="step {cls}"><b>{a}</b>{b}</div>')
    return '<div style="display:flex;gap:6px">' + '<div class="arr">&rsaquo;</div>'.join(out) + '</div>'

def table(head, rows, widths=None):
    h = "".join(f'<th>{x}</th>' for x in head)
    r = "".join('<tr>' + "".join(f'<td>{c}</td>' for c in row) + '</tr>' for row in rows)
    return f'<table><tr>{h}</tr>{r}</table>'

# ------------------------------------------------------------------ SITUATION (sec 0)
slide(0, "Executive summary", "Without a shared language, communication errors become safety events.",
 '<div class="row" style="height:230px">'
 + stat("The problem", "49.1%", "of adverse events in limited-English patients involved physical harm, vs 29.5% for English speakers.", "Divi et al., Int J Qual Health Care 2007 (6 US hospitals)", "t")
 + stat("Our answer", "1 journey", "Patient voice intake, nurse and doctor see fields linked to the patient's own words, a pharmacist verifies. People decide.", "Research prototype, synthetic data only", "o")
 + stat("The proof so far", "1,872", "automated tests, 18 deterministic red-flag rules, 52 synthetic cases and an 18-case blind holdout.", "npm --prefix apps/web test; eval/, data/", "t")
 + '</div><div style="height:12px"></div>'
 + table(["Who", "Today", "With MedX"], [
   ["<b>Patient</b>", "Cannot explain symptoms, medicines or allergies in the clinic's language", "Speaks or types in Thai, Italian or English; confirms the transcript"],
   ["<b>Nurse and doctor</b>", "Free text, interpreter wait, documentation after the visit", "One screen: every field quotes the patient; unknowns shown as unsupported"],
   ["<b>Pharmacist</b>", "Medication list built from memory and brand names", "Reconcile list with allergy and interaction checks; verify or return"]]),
 "I do the legwork. You keep the final say.", "People decide. MedX supports clinicians and never diagnoses.",
 "Divi C, Koss RG, Schmaltz SP, Loeb JM. Language proficiency and adverse events in US hospitals: a pilot study. Int J Qual Health Care 2007;19(2):60-67. PMID 17277013. Test and rule counts: repo, 18 Oct 2026. Not clinically validated.")

slide(0, "The problem: language barrier", "Limited English proficiency doubled the odds of an adverse event for hospitalised children.",
 '<div class="row"><div class="col f2">'
 + card('<div class="tag">Six US hospitals, 2005</div>'
   '<div style="font-size:13px;color:var(--soft)">Share of adverse events: limited English proficiency (LEP) vs English speakers</div>'
   '<div class="bl"><span>Physical harm</span><div class="bar"><i style="width:49.1%"></i></div><span>49.1%</span></div><div class="bl"><span>&nbsp;</span><div class="bar"><i class="gr" style="width:29.5%"></i></div><span>29.5%</span></div>'
   '<div class="bl"><span>Moderate harm or worse</span><div class="bar"><i style="width:46.8%"></i></div><span>46.8%</span></div><div class="bl"><span>&nbsp;</span><div class="bar"><i class="gr" style="width:24.4%"></i></div><span>24.4%</span></div>'
   '<div class="bl"><span>Due to communication errors</span><div class="bar"><i style="width:52.4%"></i></div><span>52.4%</span></div><div class="bl"><span>&nbsp;</span><div class="bar"><i class="gr" style="width:35.9%"></i></div><span>35.9%</span></div>'
   '<div class="ss" style="margin-top:10px">Colour bar = LEP patients, grey bar = English speakers. Divi 2007, PMID 17277013.</div>')
 + '<div class="row" style="height:auto">'
 + stat("7-hospital cohort, 1,666 parents", "17.7% vs 9.6%", "adverse events in children of parents with limited comfort in English (adjusted OR 2.1, 95% CI 1.2-3.7).", "JAMA Pediatrics, Dec 2020. PMID 33074313", "o")
 + '</div></div><div class="col f2">'
 + stat("Delay and under-assessment", "33 studies", "in a pediatric-surgery scoping review: LEP patients had fewer pain assessments, longer waits for analgesia, longer time to treatment.", "Liu O et al., J Surg Res 2024;302:540-554. PMID 39178570", "t")
 + stat("What helps", "28 studies", "in a systematic review: professional interpreters are linked to better communication, outcomes and satisfaction than ad hoc interpreters.", "Karliner LS et al., Health Serv Res 2007;42(2):727-754. PMID 17362215", "t")
 + card('<div class="tag">Honest caveat</div><div class="lab">Length-of-stay effects are inconsistent across 11 studies (2025 scoping review). We do not claim that language barriers lengthen stays.</div><div class="ss">Kulkarni S et al., BMJ Open Qual 2025;14(4). PMID 41314683</div>', "w")
 + '</div></div>',
 "A missed word at the desk can become a missed safety signal.", "We use only figures we could trace to a paper. The rest is left out.",
 "Sources: Divi 2007 (PMID 17277013); JAMA Pediatr 2020 (PMID 33074313); Liu 2024 (PMID 39178570); Karliner 2007 (PMID 17362215); Kulkarni 2025 (PMID 41314683). US data; no verified Thai or Italian rate was found. Full list: docs/research/PROBLEM.md.")

slide(0, "The problem: medication lists", "13% to 59% of patients have an unintended error in their admission medication list.",
 '<div class="row"><div class="col" style="flex:1.55">'
 + card('<div class="tag">Patients with at least one unintended discrepancy</div>'
   '<div class="bl"><span style="width:200px">Ethiopia ED, no pharmacist</span><div class="bar"><i class="gr" style="width:59%"></i></div><span>59%</span></div>'
   '<div class="bl"><span style="width:200px">Tertiary hospital</span><div class="bar"><i style="width:48.3%"></i></div><span>48.3%</span></div>'
   '<div class="bl"><span style="width:200px">Older adults, Saudi Arabia</span><div class="bar"><i style="width:42.4%"></i></div><span>42.4%</span></div>'
   '<div class="bl"><span style="width:200px">Endocrinology, France</span><div class="bar"><i style="width:29.4%"></i></div><span>29.4%</span></div>'
   '<div class="bl"><span style="width:200px">Ortho, pharmacist history</span><div class="bar"><i style="width:13%"></i></div><span>13.0%</span></div>'
   '<div class="bl"><span style="width:200px">Ethiopia ED, with pharmacist</span><div class="bar"><i style="width:10.5%"></i></div><span>10.5%</span></div>'
   '<div class="ss" style="margin-top:10px">Settings and methods differ, so we show a range, not an average. Order by rate. Sources M1-M6 below.</div>')
 + table(["Finding", "Number"], [["Most common discrepancy type", "Omission (37% in older adults, 77% of discrepancies in the tertiary study)"], ["Could cause moderate to severe discomfort", "52% of discrepancies (tertiary study)"], ["10 or more drugs", "4 times the odds of an admission discrepancy (OR 4.0)"]])
 + '</div><div class="col f1">'
 + stat("Language makes it worse", "13 studies", "in a 2025 systematic review: low health literacy and limited English were linked to more comprehension errors and medication discrepancies.", "J Racial Ethn Health Disparities 2025. PMID 40180697", "o")
 + card('<div class="tag">What MedX does</div><div class="lab">Shows what the patient <b>said</b> they take, in their words, maps brand names to generics, and flags duplicates. The pharmacist confirms what they actually take.</div>', "t")
 + card('<div class="tag">Not claimed</div><div class="sm">We found no verified Thai or Italian error rate. This is evidence from other countries.</div>', "w")
 + '</div></div>',
 "A medicine the patient forgot to mention is a risk nobody can see.", "That is why every field points back to what the patient actually said.",
 "[M1] Int J Clin Pharm 2018, PMID 30367379. [M2] Int J Clin Pharm 2017, PMID 29248986. [M3] J Patient Saf 2021, PMID 28877049. [M4] BMC Health Serv Res 2026, PMID 42001177. [M5] BMC Health Serv Res 2020, PMID 32791965. [M6] Int J Clin Pharm 2018, PMID 30155773. [L1] PMID 40180697. Details: docs/research/PHARMACY-PROBLEM.md.")

slide(0, "The problem: allergies and brand names", "Allergy labels and brand names travel badly across borders.",
 '<div class="row"><div class="col f1">'
 + stat("Maternity cohort, Australia, 145 patients", "36%", "of records with a beta-lactam allergy needed amending (52 patients). 56% of the allergies were judged low risk.", "Aust N Z J Obstet Gynaecol 2024. PMID 38721775", "t")
 + stat("Hong Kong cohort, 141 adults", "83%", "were delabelled after structured testing (117). Yet 17% of 88 followed for 12 months were incorrectly relabelled (15).", "Ann Allergy Asthma Immunol 2026. PMID 41763604", "o")
 + '</div><div class="col f2">'
 + card('<div class="tag">Case report, not a prevalence study</div><div class="lab">A cruise passenger took a 1000 mg paracetamol cold product without knowing that paracetamol is another name for acetaminophen (Tylenol), risking an unnoticed overdose. A Reactine bought in Italy also contained pseudoephedrine.</div><div class="ss">ISMP Canada, Safe Medication Use newsletter 5(5), 18 Aug 2014</div>', "w")
 + table(["Same ingredient, different names", "Why it matters"], [["Tachipirina (IT), Efferalgan, Sara, Tiffy (TH), Tylenol (US)", "A traveller can take two products with the same paracetamol"], ["Lay terms: \"ยาความดัน\", \"la pastiglia per la pressione\", \"my blood thinner\"", "The record needs a generic name, strength and last dose"]])
 + card('<div class="tag">What MedX does</div><div class="lab">Shows the allergy the patient states, <b>in their words</b>, with the reaction if given. Nothing is marked verified until the pharmacist confirms. We do not claim to remove false allergy labels.</div>', "t")
 + '</div></div>',
 "Brand names change at the border. The ingredient does not.", "MedX maps names to generics and flags duplicate paracetamol; the pharmacist decides.",
 "[A1] PMID 38721775 (2024). [A2] PMID 41763604 (2026). [T1] ISMP Canada, https://www.safemedicationuse.ca/newsletter/newsletter_Travelling.html. No study quantifying traveller brand confusion was found; no rate is given. docs/research/PHARMACY-PROBLEM.md.")

slide(0, "The problem: time and documentation", "For every hour with a patient, doctors spend almost two more hours on EHR and desk work.",
 '<div class="row"><div class="col f1">'
 + card('<div class="tag">57 physicians, 4 specialties, 430 hours observed</div>'
   '<div class="bl"><span>Direct face time</span><div class="bar"><i style="width:27%"></i></div><span>27.0%</span></div>'
   '<div class="bl"><span>EHR and desk work</span><div class="bar"><i class="gr" style="width:49.2%"></i></div><span>49.2%</span></div>'
   '<div class="ss" style="margin-top:10px">Share of the office day. Sinsky C et al., Ann Intern Med 2016;165(11):753-760. PMID 27595430</div>')
 + card('<div class="tag">Ward nurses, Western Australia, 120 hours observed</div>'
   '<div style="display:flex;gap:30px;margin-top:6px"><div><div class="num" style="font-size:34px">28.1%</div><div class="sm">morning</div></div><div><div class="num" style="font-size:34px">22.7%</div><div class="sm">afternoon</div></div><div><div class="num" style="font-size:34px">20.9%</div><div class="sm">night</div></div></div>'
   '<div class="sm" style="margin-top:8px">of time spent on documentation. Nurses estimated 50.4%, 40.7% and 37.9%: perceived burden is higher than measured, but the measured share is still large.</div><div class="ss">J Clin Nurs, Mar 2021. PMID 33590554</div>')
 + '</div><div class="col f1">'
 + card('<div class="tag">What this means for intake</div><div class="lab">A patient who needs repeated clarification, or an interpreter wait, adds to a load that is already high. If the nurse starts with a structured, evidence-linked summary, the documentation starts from the patient\'s words instead of a blank page.</div>', "t")
 + card('<div class="tag">Limit we state openly</div><div class="lab">These are ward and clinic data, not triage-desk data. We found no verified triage-specific timing figure, so we claim <b>no time saving</b>. Our demo scenario of 2 to 3 minutes per intake is a design assumption, not a result.</div>', "w")
 + '</div></div>',
 "Less typing, more listening. That is the hope, and it has to be measured.", "A measured pilot is the gate before any time-saving claim.",
 "Sinsky C et al., Ann Intern Med 2016 (PMID 27595430); Is nursing and midwifery clinical documentation a burden? J Clin Nurs 2021 (PMID 33590554). docs/research/PROBLEM.md section 2.")

slide(0, "The problem: AI summaries", "Good clinical LLMs still omit or invent content, so every claim needs a source.",
 '<div class="row" style="height:210px">'
 + stat("Framework study, 12,999 sentences", "1.47%", "hallucination rate, with a 3.45% omission rate, across 18 configurations.", "npj Digit Med, May 2025. PMID 40360677", "o")
 + stat("30 synthetic Dutch letters, 31 clinicians", "78%", "judged correct. Medication sections had the highest hallucination rate; missing information was the commonest error.", "JMIR Med Inform, May 2026. PMID 42114040", "t")
 + stat("100 hospital-course summaries", "25%", "had omissions and 20% inaccuracies; 2% hallucinations. 88% of unedited summaries were rated no harm potential.", "JAMA Netw Open, May 2026. PMID 42101844", "w")
 + '</div><div style="height:14px"></div>'
 + table(["Risk in clinical AI", "What MedX does about it"], [
   ["Model invents a symptom or medicine", "A field with no verified patient quote is <span class=\"chip w\">unsupported</span> and never shown as fact"],
   ["Model misses a warning sign", "Red-flag rules are code, run before any model call, and no model output can clear them"],
   ["Model is unsure or fails", "Low confidence, provider error or schema error means abstain: <span class=\"chip n\">needs human review</span>"],
   ["Nurse trusts a field at a glance", "Each field carries its quote, a confidence mark and a status; nothing is final until a clinician approves"]]),
 "Show me the sentence it came from.", "Low error rates are still too high when a nurse may trust a field at a glance.",
 "[L1] npj Digit Med 2025 (PMID 40360677); [L2] JMIR Med Inform 2026 (PMID 42114040); [L3] JAMA Netw Open 2026 (PMID 42101844). Studies are on other tools and settings; they motivate our design and say nothing about MedX accuracy. docs/research/PROBLEM.md section 4.")

slide(0, "Context: Thailand and Italy", "Our demo languages sit where patients and clinicians often share none.",
 '<div class="row"><div class="col f1">'
 + card('<div class="tag">Thailand</div>', "t", "padding-bottom:6px")
 + stat("Foreign tourist arrivals, 2025", "32,974,321", "Every one of them can end up at a clinic in a language the staff may not share.", "Ministry of Tourism and Sports, via Bernama, 6 Jan 2026", "t")
 + stat("Unregistered migrant workers", "~338,000", "from Cambodia, Laos, Myanmar and Vietnam (Department of Employment estimate, Oct 2025).", "Khaosod English, 6 Oct 2025", "o")
 + '</div><div class="col f1">'
 + card('<div class="tag">Italy</div>', "o", "padding-bottom:6px")
 + stat("Foreign residents, 1 Jan 2025", "5.37M", "9.1% of residents (ISMU report built on ISTAT data; ISTAT first release: 5.42M, 9.2%).", "ISMU 31st Report on Migrations, Feb 2026. Secondary source: check against ISTAT", "o")
 + stat("European paediatricians naming cultural or language factors as the top barrier", "90%", "yet only 37% had access to professional interpreters and cultural mediators (n=492; Europe, not Italy-only).", "Carrasco-Sanz A et al., Child Care Health Dev 2018. PMID 29159977", "t")
 + '</div><div class="col f1">'
 + card('<div class="tag">What studies in Thailand found</div><div class="lab"><b>987</b> migrant workers surveyed: language barrier (via acculturative stress) was linked to poorer access to antenatal and postpartum care.</div><div class="ss">Holumyong C et al., J Pregnancy 2018. PMID 29686905</div>', "w")
 + card('<div class="lab">Along the Thai-Myanmar border, communication barriers were a main factor in satisfaction with the migrant child immunisation service.</div><div class="ss">Pinna C et al., Vaccines 2020;8(1):68. PMID 32033393</div>', "w")
 + card('<div class="tag">Left out on purpose</div><div class="sm">Medical-tourism patient counts (sources disagree) and Italian tourist totals (definitions differ).</div>')
 + '</div></div>',
 "Thai, Italian, English: three languages, one desk.", "We start where we can demo it and where the need is documented.",
 "Bernama 6 Jan 2026 (bernama.com/en/news.php?id=2509419); Khaosod English 6 Oct 2025; ISMU 31st Report Feb 2026 / ISTAT; Carrasco-Sanz 2018; Holumyong 2018; Pinna 2020. Tourist arrivals are a population-at-risk figure, not a count of patients.")

slide(0, "Who suffers today", "One pattern: the right information is lost on the way to the person who decides.",
 '<div class="row" style="height:230px">'
 + card('<div class="tag">Patient</div><div class="lab"><b>Cannot say it.</b> Symptoms, medicines and allergies get lost or simplified. Waits for an interpreter or relies on a relative.</div><div class="sm">Evidence: 49.1% vs 29.5% physical harm; 2.1x odds of adverse events (children).</div>', "t")
 + card('<div class="tag">Nurse</div><div class="lab"><b>Cannot hear it all.</b> Takes history, checks vitals and documents, often in a second language.</div><div class="sm">Evidence: 21% to 28% of shift on documentation (measured).</div>', "o")
 + card('<div class="tag">Doctor</div><div class="lab"><b>Cannot verify it.</b> Reads a summary with no trail back to what was said. Nearly 2 hours of desk work per face-time hour.</div><div class="sm">Evidence: 49.2% desk vs 27.0% face time.</div>', "t")
 + card('<div class="tag">Pharmacist</div><div class="lab"><b>Cannot trust the list.</b> Brand names, lay terms and missing allergies.</div><div class="sm">Evidence: 13% to 59% admission lists with an unintended error.</div>', "o")
 + '</div><div style="height:14px"></div>'
 + '<div class="blk"><b>One pattern.</b> When something is lost between the patient\'s words and the final decision, the person at the end sees a clean-looking record with no trail back. MedX keeps the trail: every field quotes the patient, and every action is in the audit log.</div>'
 + '<div style="height:12px"></div><div class="row" style="height:70px">' + card('<div class="lab" style="margin:0"><b>Buyer view (assumption for discussion):</b> private hospitals and clinics with international patients feel this as interpreter cost, documentation time and medication-error risk. We have not validated these costs.</div>', "w", "flex:1") + '</div>',
 "I keep the trail from the patient's words to the decision.", "That is the whole product in one sentence.",
 "All numbers are from the previous slides (Divi 2007; JAMA Pediatr 2020; J Clin Nurs 2021; Sinsky 2016; PHARMACY-PROBLEM.md M1-M6). Business statement is an assumption, not a finding.")

# ------------------------------------------------------------------ SOLUTION (sec 1)
slide(1, "Introducing MedX", "Say it in your language. The clinician reads it in theirs, and can check every line.",
 '<div class="row"><div class="col f1">'
 + card('<div class="tag">Without MedX, a typical intake</div>' + ol([("Patient and clinic find a common language", "Interpreter, relative, or a phone app"), ("Nurse takes history by hand", "Free text, written from memory"), ("Vitals on a separate screen", "Triage level decided by eye"), ("Doctor re-asks the same questions", "No trail to what was said"), ("Prescription typed, checked in the head", "Allergy or duplicate seen late"), ("Pharmacist rebuilds the medicine list", "From brand names and memory")]), "r")
 + '</div><div class="col f1">'
 + card('<div class="tag">With MedX, the same journey</div>' + ol([("Patient speaks or types in Thai, Italian or English", "Confirms the transcript before sending"), ("Nurse sees a live summary", "Each field quotes the patient; unknowns say so"), ("Vitals give a NEWS2 suggestion", "The nurse confirms the level"), ("Doctor sees considerations and a draft note", "From a fixed list, with guideline links; signs or edits"), ("Orders are checked by rules", "Allergy, interaction, duplicate, pregnancy, dose range"), ("Pharmacist verifies or returns", "Reconciled list, written reason to override")]), "t")
 + '</div><div class="col" style="flex:.8">'
 + card('<div class="tag">One sentence</div><div class="lab" style="font-size:17px;font-weight:700">A multilingual intake that gives clinicians a case where every field points back to the patient\'s own words.</div>', "g")
 + card('<div class="tag">What stays human</div><div class="sm">Diagnosis, urgency decision, orders, signing and verification. The AI never decides these.</div>', "w")
 + card('<div class="tag">Where it runs</div><div class="sm">Web app for staff, Expo app for patients. Mock model today; designed for Gemma via AMD Token Factory.</div>')
 + '</div></div>',
 "I do the legwork. You keep the final say.", "Six steps either way. With MedX each one leaves a trail.",
 "Process steps are a design description, not a measured comparison. Not clinically validated. Research prototype, synthetic data only. See docs/DEMO.md.")

slide(1, "The 4-role journey", "One case, four people: each gets a screen made for their job.",
 '<div class="row"><img class="shot" src="img2/journey.png" style="width:auto;height:500px;flex:none"><div class="col f1">'
 + "".join(card(f'<div class="tag">{t}</div><div class="lab"><b>{a}</b></div><div class="sm">{b}</div>', c) for t, a, b, c in [
   ("1 Patient app", "Voice or text intake", "Thai, Italian, English. Guided chat, follow-up questions, red-flag screen that says go to the desk.", "t"),
   ("2 Nurse", "Consult assistant + vitals", "Live summary linked to the patient's words; ask-next suggestions; NEWS2 triage suggestion to confirm.", "o"),
   ("3 Doctor", "Considerations, note, orders", "Doctor-only list with guideline links; draft note to sign; orders with deterministic checks.", "t"),
   ("4 Pharmacist", "Verify or return", "Reconciled medicines and allergies; verify, edit, or return with a written reason.", "o")])
 + '</div></div>',
 "Four screens, one trail.", "Every step is in the append-only audit log, and nothing is final until a clinician approves.",
 "Screenshots: real app, synthetic data, mock provider (docs/readme/journey.png). Research prototype.")

slide(1, "Use case: patient app", "The patient answers in their own language, by voice or text, and confirms what was heard.",
 '<div class="row"><div style="width:600px;display:flex;gap:14px;align-items:flex-start">'
 + shot("img/m-voice.jpg", [(14, 16), (50, 70), (88, 95)], "width:190px;flex:none") + shot("img/m-status.jpg", [(20, 22), (50, 55)], "width:190px;flex:none") + shot("img/m-red.jpg", [(50, 25), (50, 70)], "width:190px;flex:none")
 + '</div><div class="col f1">'
 + ol([("Speak or type", "Voice goes through the phone's speech service; text works offline of speech. The patient sees the transcript and confirms before sending."), ("Guided questions", "A short chat in Thai, Italian or English. If something required is missing, one follow-up question, at most 3."), ("Red-flag screen", "If a warning sign is detected, the app stops and tells the patient to go to the desk now. A rule fired, not a model."), ("Redaction", "Names, phone and ID numbers become tokens before anything is stored or sent to a model.")])
 + card('<div class="tag">Limits we state</div><div class="sm">Speech goes to the browser or phone cloud speech service. Redaction is imperfect. Italian and Thai UI wording needs native-speaker review.</div>', "w")
 + '</div></div>',
 "Tell me in your own words. I will make sure the nurse sees them.", "Left to right: voice intake, status, red-flag screen.",
 "Screens: apps/mobile, synthetic data (pitch/deck/img/m-*.jpg). Follow-up cap and redaction: docs/ARCHITECTURE.md steps 2 and 8.")

slide(1, "Use case: nurse consult assistant", "While the nurse takes history, the summary builds itself, and every field quotes the patient.",
 '<div class="row"><div style="width:560px">'
 + shot("img/consult-nurse.png", [(7, 12), (7, 38), (62, 42), (7, 74)])

 + '</div><div class="col f1">'
 + ol([("Live summary", "Chief complaint, onset, severity. Each field shows <b>From patient's words</b>; empty ones say <b>Not mentioned yet</b>."), ("Capture by voice or typing", "Speaker toggle (patient or clinician). Speech goes to the browser's speech service."), ("Ask next and rule out", "Rule-based suggestions with a one-line reason. The nurse asks, dismisses, or marks as asked."), ("Live transcript", "Each line tagged patient or question; the quotes behind the fields come from here."), ("Vitals and NEWS2", "Seven parameters give a triage suggestion; incomplete vitals say so. The nurse confirms the level.")])
 + shot("img/vitals.png", [(75, 36)], "width:330px")
 + '</div></div>',
 "Ask this next. Rule this out. You decide.", "Suggestions, never decisions: the nurse confirms every triage level.",
 "Screens: /review/<id>/consult?mode=nurse and /vitals, synthetic case B-012, mock provider. Triage level is a NEWS2-based suggestion for adults (not pregnancy); the nurse confirms. docs/clinical/CONSULT-SPEC.md.")

slide(1, "Use case: doctor", "The doctor gets a draft note and doctor-only considerations from a fixed list. Not a diagnosis.",
 '<div class="row"><div class="col" style="width:540px">'
 + shot("img/doctor-note.png", [(6, 22), (6, 45), (8, 78)])
 + shot("img/orders.png", [(8, 18), (8, 78), (62, 14)], "width:400px")
 + '</div><div class="col f1">'
 + ol([("Draft, not a diagnosis", "The note carries a banner: draft for clinician review. Nothing is final until signed."), ("Signed note", "Reviewer name and time are stored in the audit log; the patient's own name is redacted."), ("Needs check", "Anything without a verified quote is shown dashed as <b>Needs check</b>."), ("Considerations", "Doctor-only, from a fixed list of 12 presentations (not a full differential), each with a guideline link such as NICE NG228."), ("Orders", "Investigations are listed as considered, not ordered. Prescribing is checked by rules (next slide).")])
 + card('<div class="sm">The consult assistant never diagnoses, orders, prescribes or decides urgency.</div>', "w")
 + '</div></div>',
 "Here is what to consider. What to do is up to you.", "A fixed list with guideline links, not a model's guess.",
 "Screens: /review/<id>/consult?mode=doctor and /orders, synthetic data. 12-presentation list: docs/clinical/CONSULT-SPEC.md; README limitations. Guideline names appear as shown in the app.")

slide(1, "Use case: orders with checks", "Prescriptions run through deterministic checks; overriding a high alert needs a reason.",
 '<div class="row"><div style="width:500px">'
 + shot("img/rx-check.png", [(8, 32), (8, 62), (8, 85)], "width:300px;margin:0 auto")
 + '</div><div class="col f1">'
 + table(["Check", "Alert", "Example in the app"], [
   ["Allergy conflict", '<span class="chip r">High</span>', "Amoxicillin-clavulanate with a stated penicillin allergy"],
   ["Interaction", '<span class="chip r">High</span>', "From a list of 18 interactions"],
   ["Duplicate therapy", '<span class="chip w">Moderate</span>', "Two products with the same ingredient or class"],
   ["Pregnancy", '<span class="chip w">Check</span>', "Flags medicines to review in pregnancy"],
   ["Dose range", '<span class="chip w">Check</span>', "Adult dose ceilings for 31 drugs"]])
 + '<div class="row" style="height:auto">' + stat("Rule set size", "59 / 18 / 31", "drugs / interactions / dose ceilings in medrules.json (v3)", "packages/shared/src/medrules.json; README", "t") + card('<div class="tag">Callouts</div><div class="lab"><b>1</b> Alert with reason. <b>2</b> Prescriber note: "Allergy history unclear, discussed with patient". <b>3</b> Edit and resubmit, or cancel.</div>', "o", "flex:1.3") + '</div>'
 + card('<div class="sm"><b>Limit:</b> a small rule set. It misses what it does not contain. Alerts are code, not model output, and a model cannot clear one.</div>', "w")
 + '</div></div>',
 "Check first. Then prescribe.", "The alert is in code. The decision stays with the prescriber.",
 "Screens: /review/<id>/orders and /pharmacy, synthetic data. Counts: medrules.json and README limitations (59 drugs, 18 interactions, dose ceilings for 31). Not a complete drug-interaction check.")

slide(1, "Use case: pharmacist", "The pharmacist sees what the patient said, with quotes, and verifies or returns each prescription.",
 '<div class="row"><div style="width:700px">'
 + shot("img/pharmacy.png", [(8, 12), (20, 34), (82, 28), (50, 95)])
 + '</div><div class="col f1">'
 + ol([("Case header", "Language, medicines, allergies and alert counts at a glance."), ("Medicines", "Each row: patient's words in the original language, generic name, dose and timing, and status. Verify, edit, or discontinue."), ("Medication alerts", "High, moderate, or duplicate-paracetamol alerts with a short check to do. Acknowledge or mark false alarm."), ("Sign off reconciliation", "Blocked until every high alert is handled.")])
 + card('<div class="tag">Return to prescriber</div><div class="sm">A returned order carries the pharmacist\'s note back to the doctor, who can edit and resubmit or cancel.</div>', "t")
 + card('<div class="sm">The system never recommends a new drug, a dose, a substitution or stopping a drug.</div>', "w")
 + '</div></div>',
 "I verify. If something is wrong, I send it back with a reason.", "Sign-off stays blocked while a high alert is unhandled.",
 "Screens: /pharmacy and /pharmacy/<id>, synthetic case B-010, mock provider. Spec: docs/clinical/PHARMACY-SPEC.md.")

slide(1, "Safety layer", "What could go wrong, and what MedX does about it.",
 '<div class="big">' + table(["What could go wrong", "Risk", "What MedX does"], [
   ["A warning sign is buried in a long answer", '<span class="chip r">Urgent</span>', "18 deterministic red-flag rules run before any model call. A hit stops the flow and shows a red banner; no model output can clear it."],
   ["The model invents a symptom, medicine or allergy", '<span class="chip w">Wrong fact</span>', "A field with no verified quote from the patient's own turns is <b>unsupported</b> and never shown as fact."],
   ["The model fails or is unsure", '<span class="chip w">Guess</span>', "Provider error, schema error or low confidence means abstain: <b>needs human review</b>. A 40-second per-turn deadline."],
   ["Patient text leaks personal data", '<span class="chip n">Privacy</span>', "Names, phones and IDs are redacted before storage or any model call. Synthetic data only."],
   ["A prescription conflicts with an allergy or another drug", '<span class="chip r">Harm</span>', "Rules in code flag it. High alerts need a written override reason. Pharmacist verifies."],
   ["Someone acts on an unchecked output", '<span class="chip w">Overtrust</span>', "Nothing is final until a clinician approves. Every action is in the append-only audit log with reviewer."],
   ["The model tries to add or remove flags", '<span class="chip n">Control</span>', "The model's red-flag screen can only add flags, and those need clinician confirmation."]]) + '</div>',
 "I can be wrong. So the system is built to show its work.", "Seven risks, seven controls. Each one has automated tests.",
 "Invariants and flow: docs/ARCHITECTURE.md (safety invariants table), apps/web/lib/pipeline/__tests__. Not clinically validated; the controls reduce risk and do not remove it.")

slide(1, "Red flags before any model", "Red-flag rules are code. They run first, and the model cannot clear them.",
 '<div class="row"><div class="col" style="width:760px">'
 + flow([("Patient turn", "Text is redacted first"), ("red", "Red-flag rules", "18 rules, TH / IT / EN, with negation cues"), ("Stop or continue", "Hit: status escalated, zero model calls"), ("Model", "Extraction and an add-only screen")])
 + '<div style="height:6px"></div>' + shot("img/redflag.png", [(6, 18), (6, 42), (6, 78)], "width:500px")
 + '</div><div class="col f1">'
 + ol([("Red banner, urgency only", "Chest pain with sweating, found by RF-CHEST-01, with the patient's quote shown in Thai."), ("Evidence, not inference", "The rule id and the quote that triggered it."), ("Clinician actions", "Acknowledge, mark false alarm, approve supported fields, or take over intake.")])
 + stat("Blind holdout, rules alone", "7/10", "escalation cases caught; 3/8 false alarms. We publish the 3 misses: suicidal ideation, meningitis, seizure phrasing.", "eval/results/holdout-rules-only.md; eval/REPORT.md (18 cases, authored blind)", "r", "red")
 + '</div></div>',
 "I would rather ask a nurse than guess.", "Rules miss paraphrases. That is why a clinician reviews every flag and every case.",
 "Rule count: packages/shared/src/redflags.json (18). Holdout: data/holdout/ (18 synthetic cases: 10 escalate, 8 not), rules v1.1 recall 7/10, false alarms 3/8, recorded 17 Oct 2026. A mock-provider arm adds no hits (labelled mock, not evidence).")

slide(1, "Evidence-linking", "Every field points to the patient's own words. If it cannot, it says so.",
 '<div class="row"><div style="width:640px">'
 + shot("img/review.png", [(6, 16), (45, 32), (45, 55), (80, 20)])
 + '</div><div class="col f1">'
 + ol([("Case header", "Language, status, and a triage chip once vitals are confirmed."), ("From patient's words", "Each field shows its quote on hover and links to the line in the transcript."), ("Missing or unverified", "Required but absent fields are flagged for a follow-up question."), ("Patient's words panel", "The original text, with the quoted passages highlighted.")])
 + '<div style="font-size:12px;color:var(--soft);margin:4px 0">Five statuses, always visually distinct</div><div style="display:flex;gap:6px;flex-wrap:wrap"><span class="chip o">verified</span><span class="chip w">unverified</span><span class="chip n">missing</span><span class="chip">edited</span><span class="chip">approved</span></div>'
 + card('<div class="tag">How it is checked</div><div class="sm">Each model-proposed quote must be found in the patient\'s turns (fuzzy match across translation). If a majority of fields fail, the whole case abstains.</div>', "t", "margin-top:10px")
 + '</div></div>',
 "Click a field. See the words.", "Evidence is the product; the summary is only the surface.",
 "Screen: /review/<id>, synthetic case B-003, mock provider. Verification logic: apps/web/lib/pipeline/verify.ts, docs/ARCHITECTURE.md step 5. Safety invariant 2 in CLAUDE.md.")

slide(1, "Case trace", "Every case has a trace: the exact path of rules, model calls and human decisions.",
 '<div class="row"><div style="width:700px">'
 + shot("img2/v11-trace-redflag.png", [(30, 38), (52, 38), (78, 38), (10, 78)])
 + '</div><div class="col f1">'
 + ol([("Graph of steps", "Patient turn, redaction, red-flag rules, model steps, escalation, human decision."), ("Model steps skipped", "On a red flag the model steps are shown as skipped. Zero model calls."), ("Step details", "Actor, status, what happened and the rule id, with the audit id."), ("Deterministic digest", "A hash over the trace, and an Export JSON button. No personal data in the trace.")])
 + card('<div class="sm">The trace is derived from the audit log. It answers \"how was this case handled?\" for a reviewer, a regulator, or a judge.</div>', "t")
 + card('<div class="sm">It describes what happened. It does not judge whether the decision was right.</div>', "w")
 + '</div></div>',
 "Here is how this case was handled, step by step.", "Rules, models and people are all in the same picture.",
 "Screen: /review/<id>/trace, synthetic escalated case B-018, mock provider (docs/reports/screens/v11-trace-redflag.png). Case trace was added in waves 17-18 (docs/reports/w18-trace-ui.md).")

slide(1, "Architecture", "One API gateway, one model client, and a mock fallback that is always labelled.",
 '<div class="row"><div class="col f2">'
 + '<div style="display:flex;gap:10px;align-items:stretch">'
 + card('<div class="tag">Clients</div><div class="lab"><b>Patient app</b><br>Expo / React Native, TH IT EN</div><div class="lab"><b>Staff web</b><br>/review /pharmacy /ops, Next.js 15</div>', "t", "flex:1")
 + '<div class="arr" style="align-self:center">&rsaquo;</div>'
 + card('<div class="tag">API gateway (the only backend)</div><div class="lab"><b>apps/web/app/api</b></div><div class="sm">Validate, redact, run pipeline, append audit. JSON store, single instance.</div>', "o", "flex:1.3")
 + '<div class="arr" style="align-self:center">&rsaquo;</div>'
 + card('<div class="tag">Pipeline (no UI imports)</div><div class="sm">redact -> red-flag rules -> extract + safety screen -> verify quotes -> abstain rules -> next question -> med alerts</div>', "t", "flex:1.4")
 + '</div>'
 + '<div style="display:flex;gap:10px;align-items:stretch">'
 + card('<div class="tag">Model client (llm.ts)</div><div class="lab"><b>OpenAI-compatible</b> chat/completions, JSON schema output, timeout, one repair retry, latency recorded per call.</div>', "o", "flex:1.3")
 + '<div class="arr" style="align-self:center">&rsaquo;</div>'
 + card('<div class="tag">Designed target</div><div class="lab"><b>Gemma via AMD Token Factory</b></div><div class="sm">Endpoint, model id and keys are env vars. Not yet run.</div>', "g", "flex:1")
 + card('<div class="tag">Fallback</div><div class="lab"><b>Mock provider</b></div><div class="sm">Deterministic. UI and /api/health say mock, never AMD.</div>', "w", "flex:1")
 + '</div>'
 + card('<div class="tag">Contracts</div><div class="sm">packages/shared: types, API shapes, tokens, redflags.json, medrules.json. Imported by web and mobile; changed only by the orchestrator.</div>')
 + '</div><div class="col f1">'
 + stat("Status of the AMD run", '<span class="pend">pending</span>', "Gemma-on-AMD accuracy and latency are not measured. Every current number comes from the mock provider or from code rules.", "docs/ARCHITECTURE.md; eval/REPORT.md header", "w", "", "")
 + card('<div class="tag">Honest labels</div><div class="sm">If AMD_BASE_URL is unset, the provider is mock and the UI says so. Keys only from env vars; .env is never committed.</div>', "t")
 + '</div></div>',
 "Same pipeline, any OpenAI-compatible model. The label never lies.", "Designed for Gemma on AMD; the result is [pending AMD run].",
 "docs/ARCHITECTURE.md (components, data flow, AMD integration). We do not claim that MedX runs on AMD Instinct or ROCm; no AMD latency or accuracy number exists yet.")

slide(1, "How we built it", "A human lead orchestrated AI agents in role lanes, and every lane was cross-reviewed.",
 '<div class="row" style="height:210px">'
 + card('<div class="tag">Orchestrator</div><div class="lab"><b>Claude Opus</b></div><div class="sm">Plans waves, owns shared contracts, reviews reports, integrates.</div>', "g")
 + card('<div class="tag">Builders</div><div class="lab"><b>Claude Sonnet</b></div><div class="sm">Web, mobile, pharmacist, clinician and ops screens; engine work in later waves.</div>', "t")
 + card('<div class="tag">Engine and reviewer</div><div class="lab"><b>OpenAI Codex</b></div><div class="sm">AI engineer lane (pipeline, API) and cross-review of UI work.</div>', "o")
 + card('<div class="tag">Specialists</div><div class="lab"><b>Clinical, research, AI, design, pitch</b></div><div class="sm">Doctor rules, evidence, eval design, design system, deck.</div>', "t")
 + '</div><div style="height:12px"></div>'
 + table(["Review wave", "Reports in repo", "What it checked"], [
   ["QA bug waves", "7-qa-bugs, w14-qa-bugs", "Flows, edge cases, regressions"],
   ["UX audits and re-audit", "w7-ux-audit, w8-ux-reaudit, w16-ux-final", "Journeys, language leftovers, red-flag behaviour"],
   ["Clinical-safety reviews", "w9, w14 clinical-safety-review", "Rules, alerts, claim boundary"],
   ["Cross-vendor review", "w6-engine-review, w5-codex-ui-review, w9-codex-final-review", "Claude reviewed Codex's engine; Codex reviewed the UI"]])
 + '<div style="height:10px"></div><div class="blk"><b>Every task ends with a report</b> (status, files, tests run, evidence, risks, open questions). No report means not done; findings were fixed under regression tests.</div>',
 "Many hands, one trail. Each wave left a report.", "Humans decide; agents draft and review.",
 "docs/reports/ (w1 to w19 role reports), docs/DECISIONS.md, README section Team MedX. Agent roles as described in the repo; no claim about code quality beyond the test suite and reviews listed.")

# ------------------------------------------------------------------ BUSINESS (sec 2)
slide(2, "Customer analysis", "The buyer is a private clinic. The users are nurses, doctors and pharmacists. The patient benefits.",
 '<div class="row" style="height:190px">'
 + card('<div class="tag">Buyer</div><div class="lab"><b>Private hospitals and clinics with international patients</b>, including tourist-area clinics.</div><div class="sm">Pains: interpreter cost and throughput, documentation time, verifiable AI, medication-error risk.</div>', "t")
 + card('<div class="tag">Users</div><div class="lab"><b>Nurses, doctors, pharmacists</b></div><div class="sm">Head nurse: documentation time. Doctors: want AI they can check. Quality team: medication errors.</div>', "o")
 + card('<div class="tag">Beneficiary</div><div class="lab"><b>Patients with limited local-language skills</b></div><div class="sm">Tourists and migrant workers; Thai, Italian, English first.</div>', "t")
 + '</div><div style="height:12px"></div>'
 + table(["Stakeholder", "Job to be done", "Evidence it matters", "Validated with them?"], [
   ["CEO / CFO", "Serve international patients without growing interpreter cost", "Interpreter access is limited (37% in one European survey)", '<span class="pend">not yet</span>'],
   ["Head nurse", "Cut documentation load", "21% to 28% of shift on documentation (measured, ward)", '<span class="pend">not yet</span>'],
   ["Doctor", "Trust a summary without re-asking", "LLM omission/hallucination rates in studies", '<span class="pend">not yet</span>'],
   ["Quality team", "Fewer medication-list errors", "13% to 59% admission lists with an unintended error", '<span class="pend">not yet</span>']]),
 "I do not claim customers. I claim a clear first customer profile.", "Next step: a measured pilot at one clinic, with no savings figure promised.",
 "Business case text: pitch/SUBMISSION.md. Evidence figures from docs/research (Carrasco-Sanz 2018; J Clin Nurs 2021; PHARMACY-PROBLEM.md). No customer interviews, pilots or agreements exist; none are claimed.")

slide(2, "Value proposition", "MedX is worth paying for if it makes safe intake faster to check, not faster to skip.",
 '<div class="row"><div class="col f1">'
 + card('<div class="tag">For the clinic</div><ul style="margin:0 0 0 16px;font-size:14px;line-height:1.5"><li>One intake in three languages without a custom integration per language</li><li>Audit log and Case trace for every case</li><li>Rules in code, so safety does not depend on a prompt</li></ul>', "t")
 + card('<div class="tag">For the clinician</div><ul style="margin:0 0 0 16px;font-size:14px;line-height:1.5"><li>Every field links to the patient\'s sentence</li><li>Unsupported fields are never shown as fact</li><li>Suggestions with guideline links; you decide</li></ul>', "o")
 + card('<div class="tag">For the patient</div><ul style="margin:0 0 0 16px;font-size:14px;line-height:1.5"><li>Speak in their own language, confirm the transcript</li><li>Red-flag screen: told to go to the desk now</li></ul>', "t")
 + '</div><div class="col f1">'
 + table(["Pain", "Gain", "Measure in a pilot"], [
   ["Interpreter wait", "Intake starts before the interpreter is free", "Time to structured summary"],
   ["Re-asking", "Doctor starts from linked quotes", "Repeat questions per visit"],
   ["Silent AI errors", "Unsupported fields shown as such", "Unsupported claims shown as fact (target: 0)"],
   ["Medication list errors", "Reconciled list with checks", "Discrepancies found at pharmacist check"]])
 + card('<div class="tag">What we do not promise</div><div class="sm">No cost savings, no diagnosis, no triage decision. Gains are hypotheses until measured. Interpreters remain the gold standard where available (Karliner 2007).</div>', "w")
 + '</div></div>',
 "Faster to check, never faster to skip.", "The gain is trust you can verify.",
 "Value hypotheses are ours (assumption for discussion). Karliner LS et al., Health Serv Res 2007 (PMID 17362215). Pilot measures follow docs/ai/METRICS.md; the 0 target is safety invariant 2 in CLAUDE.md.")

slide(2, "Alternatives and positioning", "MedX does not replace interpreters or scribes. It structures the first words and keeps the trail.",
 table(["Alternative (category)", "What it does well", "Where it falls short for intake", "MedX difference"], [
   ["Professional interpreter, in person", "Best communication quality (Karliner 2007)", "Scarce, costly, a wait; not always available", "Starts intake before the interpreter; hands over a structured case"],
   ["Phone or video interpreting service", "On-demand languages", "Another step in the visit; not linked to the record", "Capture and structure the patient's own answers asynchronously"],
   ["Generic translation app", "Fast, free, many languages", "No clinical structure, no evidence trail, no red-flag rules", "Fields with quotes, rules in code, audit log"],
   ["Ambient scribe (category)", "Drafts notes from the visit audio", "Built for the doctor visit, not patient-side intake; fields may lack quotes", "Evidence-linked fields; unsupported shown as unsupported"],
   ["Paper or EHR intake forms", "Already in use", "One language; free text; no checks", "Multilingual guided chat plus checks"]])
 + '<div style="height:12px"></div><div class="row" style="height:80px">'
 + card('<div class="lab" style="margin:0"><b>Positioning.</b> The safety-first intake layer for clinics with international patients: <b>evidence-linked, rule-checked, human-approved</b>.</div>', "g", "flex:1.3")
 + card('<div class="sm" style="margin:0">We name categories, not products, because we have no verified product-by-product comparison. This table is our reading of the categories, not a benchmark.</div>', "w", "flex:1")
 + '</div>',
 "Not instead of an interpreter. Before one, and alongside one.", "Honest about where each option wins.",
 "Karliner LS et al., Health Serv Res 2007 (PMID 17362215) for interpreter quality. Other cells are our characterisation of categories (assumption for discussion); no competitor product, price or market share is stated.")

slide(2, "Revenue model and go-to-market", "Options under discussion, with no price or market size claimed.",
 '<div class="row"><div class="col f1">'
 + card('<div class="tag">Revenue options <span class="pend">assumption for discussion</span></div>'
   + table(["Option", "Fit"], [["Per-site subscription", "Simple for a clinic; one budget line"], ["Per active clinician seat", "Scales with use; needs seat management"], ["Pilot fee, then subscription", "Aligns with a measured pilot"], ["Language packs / integrations", "Later: add-ons per language or EHR"]])
   + '<div class="ss">No price, margin or willingness-to-pay number has been validated. None is stated.</div>', "w")
 + card('<div class="tag">What would have to be true</div><div class="sm">Clinics accept a research-grade tool only after safety review, language review and legal review. The first revenue is not before those gates.</div>', "t")
 + '</div><div class="col" style="flex:1.3">'
 + '<div class="tag" style="color:var(--teal)">Go-to-market phases (plan, not commitments)</div>'
 + flow([("Phase 0", "Now: research prototype, synthetic data, public repo"), ("Phase 1", "Shadow review: de-identified clinic data with ethics approval; no patient impact"), ("Phase 2", "Supervised pilot at one clinic with clinician sign-off"), ("Phase 3", "More clinics and languages after review")])
 + '<div style="height:6px"></div>'
 + card('<div class="tag">First customers to approach</div><div class="lab">Private clinics in tourist areas of Thailand with international patients. Italian-speaking tourists and Thai patients are the first two demo languages.</div><div class="sm">No conversation with any clinic has taken place. We are not claiming interest, pilots or signed deals.</div>', "o")
 + '</div></div>',
 "Earn trust first. Charge for it later.", "Revenue follows the gates. It does not come before them.",
 "Option list and phases are our plan (pitch/SUBMISSION.md business case, docs/PLAN.md). Everything on this slide is an assumption for discussion; there is no customer, pilot, price or market-size claim.")

slide(2, "Roadmap with gates", "No step towards clinical use without its gate: validation comes before expansion.",
 '<div class="row" style="height:200px">'
 + "".join(card(f'<div class="tag">{t}</div><div class="lab"><b>{a}</b></div><div class="sm">{b}</div>', c) for t, a, b, c in [
   ("Now", "Hackathon prototype", "4 role screens, 18 red-flag rules, med checks, Case trace, 1,872 tests. Synthetic data, mock model.", "t"),
   ("Next", "Gemma on AMD run", "Run the pre-declared eval (METRICS.md) with the real model; publish results either way.", "o"),
   ("Then", "Shadow pilot", "De-identified data, ethics approval, clinicians compare MedX to their own notes.", "t"),
   ("Later", "Supervised pilot", "One clinic, sign-off on every case, measured outcomes.", "o")])
 + '</div><div style="height:12px"></div>'
 + table(["Gate (all must pass)", "Owner", "Status"], [
   ["Native-speaker review of Thai and Italian wording", "Language reviewers", '<span class="chip w">open</span>'],
   ["Clinical safety review of rules, alerts and claims", "Clinical lead", '<span class="chip w">open: prototype review done, not clinical validation</span>'],
   ["Privacy: PDPA assessment, data-processing terms, hosting choice", "Legal / DPO", '<span class="chip w">open</span>'],
   ["Model results: holdout recall target 9/10, unsupported-as-fact 0", "AI lead", '<span class="chip w">pending AMD run</span>'],
   ["Regulatory position confirmed (software as medical device or not)", "Regulatory adviser", '<span class="chip w">open</span>']]),
 "Gates are boring on purpose.", "A gate that is not passed stops the roadmap.",
 "Targets from docs/ai/METRICS.md (M11 holdout recall >= 9/10). Gate list and owners are our plan (assumption for discussion). docs/reports/w9 and w14 clinical-safety-review are internal prototype reviews, not clinical validation.")

# ------------------------------------------------------------------ IMPACT (sec 3)
slide(3, "Impact: measured today", "What we can verify today comes from the repo: tests, rules, data and a blind holdout.",
 '<div class="row" style="height:200px">'
 + stat("Automated tests", "1,872", "pass in apps/web (vitest); regression tests for every fixed finding.", "npm --prefix apps/web test, 18 Oct 2026", "t")
 + stat("Red-flag rules", "18", "deterministic rules in Thai, Italian and English, run before any model.", "packages/shared/src/redflags.json", "r", "red")
 + stat("Med rule set", "59 / 18 / 31", "drugs / interactions / dose ceilings, adult only, small set.", "packages/shared/src/medrules.json", "o")
 + stat("Synthetic data", "52 + 18", "cases (TH, IT, EN) and a blind holdout, never used to tune rules.", "data/cases, data/holdout", "t")
 + '</div><div style="height:12px"></div>'
 + '<div class="row"><div class="col f2">'
 + card('<div class="tag">Blind holdout, red-flag rules alone (v1.1)</div>'
   '<div class="bl"><span style="width:200px">Emergency cases caught</span><div class="bar"><i class="red" style="width:70%"></i></div><span>7/10</span></div>'
   '<div class="bl"><span style="width:200px">False alarms on 8 non-urgent</span><div class="bar"><i class="gr" style="width:37.5%"></i></div><span>3/8</span></div>'
   '<div class="sm" style="margin-top:8px">Misses: HO-04 suicidal ideation, HO-08 meningitis, HO-09 seizure (paraphrased wording). False alarms: HO-11, HO-12, HO-17 (look-alikes). We report them because the holdout is the honest number.</div><div class="ss">eval/results/holdout-rules-only.md; eval/REPORT.md. 95% CI for 7/10 is 40 to 89%.</div>', "r")
 + '</div><div class="col f1">'
 + card('<div class="tag">Not evidence</div><div class="sm">Pipeline numbers in eval/REPORT.md come from a <b>mock provider</b> and prove only that the harness runs. We do not quote them as model quality.</div>', "w")
 + card('<div class="tag">Not claimed</div><div class="sm">No accuracy, time saving or patient outcome. Not clinically validated.</div>', "w")
 + '</div></div>',
 "Small, checkable numbers. No big claims.", "Everything on this slide can be re-run from the repo.",
 "Test count: vitest run, apps/web, 18 Oct 2026 (also README). Rules: redflags.json (18 rules). medrules.json v3 (59 drugs, 18 interactions); 31 dose ceilings per README limitations. Cases: data/cases (52 JSON), data/holdout (18 JSON). Holdout run recorded 17 Oct 2026, rules v1.1.")

slide(3, "Impact: pending and targets", "The AMD run and the pilot are still ahead. We state them as targets, not results.",
 '<div class="row"><div class="col f1">'
 + card('<div class="tag">Gemma via AMD Token Factory</div>'
   + table(["Metric", "Result"], [["Field precision and capture recall", '<span class="pend">pending AMD run</span>'], ["Turn latency p50 / p95", '<span class="pend">pending AMD run</span>'], ["Holdout recall with model screen", '<span class="pend">pending AMD run</span>'], ["Unsupported claims shown as fact", '<span class="pend">pending AMD run</span>']])
   + '<div class="ss">Filled from eval/REPORT.md after the run. We publish a result even if a threshold is not met.</div>', "w")
 + '</div><div class="col f1">'
 + card('<div class="tag">Pre-declared targets <span class="tgt">target</span></div>'
   + table(["Metric", "Target"], [["Holdout red-flag recall (rules + model)", '<span class="tgt">&ge; 9/10</span>'], ["Field capture recall", '<span class="tgt">&ge; 0.70</span>'], ["Unsupported claims with verifier", '<span class="tgt">&le; 5%</span>'], ["Abstain recall on should-abstain cases", '<span class="tgt">&ge; 0.90</span>'], ["Unnecessary abstain rate", '<span class="tgt">&le; 0.10</span>'], ["Turn latency p50 / p95", '<span class="tgt">&le; 6 s / 12 s</span>']])
   + '<div class="ss">Targets were written before any run (docs/ai/METRICS.md). They are goals, not claims.</div>', "o")
 + '</div><div class="col f1">'
 + card('<div class="tag">Pilot measures <span class="tgt">to be measured</span></div><ul style="margin:0 0 0 16px;font-size:13.5px;line-height:1.5"><li>Time from first word to structured summary</li><li>Repeat questions per visit</li><li>Discrepancies found at the pharmacist check</li><li>Red flags caught vs missed, reviewed by clinicians</li><li>Clinician trust and corrections per case</li></ul><div class="ss">No target number is set for time saved. We will not state one before a measurement exists.</div>', "t")
 + '</div></div>',
 "Targets are promises to measure, not results.", "Missing a target will be published as plainly as meeting one.",
 "Thresholds: docs/ai/METRICS.md (M1, M3, M8, M11 and the abstain metrics). Mock-provider values in eval/REPORT.md are not evidence. Latency and accuracy on AMD: [pending AMD run]. We do not claim that MedX runs on AMD Instinct or ROCm.")

# ------------------------------------------------------------------ SUSTAINABILITY (sec 4)
slide(4, "Risks and mitigations", "The biggest risks are clinical safety, privacy and over-trust. Each has an owner and a mitigation.",
 table(["Risk", "Owner", "Mitigation today", "Still open"], [
   ["Clinical safety: missed red flag (rules miss paraphrases: 7/10 on holdout)", "Clinical lead", "Rules before any model; model can only add; clinician reviews; unit tests; holdout published", "Broader clinician-authored rules; real-world validation"],
   ["Wrong or invented fields", "AI lead", "Evidence quote required, else unsupported; abstain on low confidence", "Measure on Gemma (pending AMD run)"],
   ["Privacy and PDPA", "Legal / DPO", "Redaction before storage or model call; synthetic data only; keys in env", "Redaction is imperfect; PDPA assessment; hosting region"],
   ["Model provider dependency", "Engineering", "OpenAI-compatible client, env-driven endpoint, fallback model, labelled mock", "Provider SLA, rate limits unknown"],
   ["Language quality (Thai, Italian wording)", "Language reviewers", "Spot checks in UAT; follow-up questions in three languages", "Native-speaker clinical review needed"],
   ["Clinician over-trust or alert fatigue", "Product", "Status chips, red reserved for urgency, human approval for everything", "Usability testing with real clinicians"],
   ["Adoption", "Business", "Role-specific screens; no EHR change needed in the prototype", "No clinic validated; EHR integration unknown"]]),
 "I list what could go wrong before someone else does.", "Mitigation reduces risk. It does not remove it.",
 "Owners are role lanes, not named people. Mitigations: docs/ARCHITECTURE.md, README limitations, docs/reports/w9 and w14 clinical-safety reviews. Holdout: eval/results/holdout-rules-only.md. Reviewer identity is self-declared; the store is a single-instance JSON file.")

slide(4, "Feasibility and legal", "A research prototype that supports clinicians. Not a medical device, no real patient data.",
 '<div class="row"><div class="col f1">'
 + card('<div class="tag">Claim boundary</div><ul style="margin:0 0 0 16px;font-size:14px;line-height:1.5"><li>Supports clinicians; never diagnoses, treats, prescribes or decides urgency</li><li>Language: "suggests for review", "flags for clinician", "decision support"</li><li>Not clinically validated; not a medical device</li><li>Synthetic data only</li></ul>', "t")
 + card('<div class="tag">Human in the loop</div><div class="sm">Nothing is final until a clinician approves. Overriding a high alert needs a written reason. Takeover is available at any point. Every action is in the audit log.</div>', "o")
 + '</div><div class="col f1">'
 + table(["Feasibility question", "Today"], [["Runs end to end?", "Yes: 4 role screens, mock provider, Docker image"], ["Model path?", "OpenAI-compatible client; Gemma on AMD pending"], ["Offline / low-cost?", "Not tested; not claimed"], ["Integrates with an EHR?", "No; standalone for now"], ["Legal basis for real data?", "Not established; PDPA assessment needed"]])
 + '</div><div class="col f1">'
 + card('<div class="tag">Known limits</div><ul style="margin:0 0 0 16px;font-size:13px;line-height:1.45"><li>Doctor-only considerations come from a fixed 12-presentation list</li><li>NEWS2 triage is for adults, not pregnancy; nurse confirms</li><li>Prescribing checks use a small rule set</li><li>Speech goes to a cloud speech service</li><li>Reviewer identity is self-declared</li></ul>', "w")
 + '</div></div>',
 "A tool that supports clinicians. Not one that replaces them.", "We stopped short of every claim we could not check.",
 "CLAUDE.md claim boundary and safety invariants; README Limitations and safety; pitch/SUBMISSION.md. No regulatory classification has been obtained; that remains a gate.")

slide(4, "Why now and the ask", "Open models make a safety-first multilingual layer practical. We ask clinicians to test it.",
 '<div class="row"><div class="col f1">'
 + card('<div class="tag">Why now</div><ul style="margin:0 0 0 16px;font-size:14px;line-height:1.5"><li>Open models such as Gemma can run behind an OpenAI-compatible endpoint, so a clinic can choose where the model runs</li><li>AMD Token Factory offers such an endpoint; we built to it and wait for the run</li><li>Studies show LLM summaries need checks; our design answers with evidence-linking and rules in code</li></ul><div class="ss">Gemma and Token Factory fit is a design choice. No claim about performance.</div>', "t")
 + '</div><div class="col f1">'
 + card('<div class="tag">What we ask for</div>' + ol([("Clinicians and nurses", "Review the screens and rules; tell us what is wrong."), ("Language reviewers", "Thai and Italian wording, clinic register."), ("A clinic partner, later", "Only for a shadow pilot after the gates.")]), "o")
 + '</div><div class="col f1">'
 + card('<div class="tag">Next 30 days <span class="tgt">plan</span></div><ul style="margin:0 0 0 16px;font-size:14px;line-height:1.5"><li>Run the pre-declared eval on Gemma via AMD</li><li>Publish results, met or not</li><li>Native-speaker review pass</li><li>Safety review of rules with clinicians</li></ul>', "t")
 + card('<div class="sm">Repo: github.com/KingPhuripol/MedX-AI. Live demo: pending.</div>', "w")
 + '</div></div>',
 "Help us break it, so a patient does not have to.", "We ask for review, not for trust.",
 "pitch/SUBMISSION.md; docs/ARCHITECTURE.md AMD integration. The plan is ours and not a commitment. No partner, pilot or agreement exists.")

slide(4, "Team MedX", "A human lead orchestrating AI agents in role lanes, built for AMD Developer Hackathon ACT III.",
 '<div class="row" style="height:210px">'
 + card('<div class="tag">Lead</div><div class="lab"><b>Human lead and orchestrator</b></div><div class="sm">Direction, decisions and review. Named team members: to be added.</div>', "g")
 + card('<div class="tag">Clinical and research</div><div class="lab"><b>Doctor and medical researcher lanes</b></div><div class="sm">Red-flag and med rules, consult spec, cited problem evidence.</div>', "t")
 + card('<div class="tag">AI and engine</div><div class="lab"><b>AI engineer and researcher lanes</b></div><div class="sm">Pipeline, eval design, pre-declared metrics.</div>', "o")
 + card('<div class="tag">Product</div><div class="lab"><b>Design, web, mobile, pitch lanes</b></div><div class="sm">Design system, four role screens, patient app, deck.</div>', "t")
 + '</div><div style="height:14px"></div>'
 + '<div class="row"><div class="col f1">'
 + card('<div class="tag">How we work</div><div class="sm">Role lanes with folder ownership; shared contracts changed only by the orchestrator; every task ends with a report; QA, UX and clinical-safety waves; cross-vendor review (Claude reviewed Codex, Codex reviewed the UI).</div>', "t")
 + '</div><div class="col f1">' + card('<div class="tag">Honest note</div><div class="sm">The roles are AI agent lanes directed by a human; they are not employees or clinicians. We do not list named advisors or institutions because none are confirmed.</div>', "w") + '</div></div>',
 "Many lanes, one human who is accountable.", "Thank you for reading the trail, not only the headline.",
 "README Team MedX; CLAUDE.md layout and ownership; docs/reports/. Team member names are not listed here because they are not recorded in the repo; add from the lablab team page before sharing.")

# ------------------------------------------------------------------ RENDER
def render():
    out = []
    n = 0
    # cover
    n += 1
    out.append(f'<section class="slide cover"><img class="bg" src="img2/cover-v4.png"><div style="position:absolute;left:56px;bottom:56px;font-size:26px;font-weight:700;color:#fff;background:rgba(8,40,60,.72);padding:8px 20px;border-radius:12px">MedX: Multilingual AI Copilot for Clinic Visits</div><div class="cap">Research prototype &middot; synthetic data only &middot; Track 2 Health &amp; Wellbeing &middot; AMD Developer Hackathon ACT III</div></section>')
    for s in SLIDES:
        n += 1
        pills = "".join(f'<div class="pill {"on" if i == s["sec"] else ""}">{t}</div>' for i, t in enumerate(SECTIONS))
        out.append(f'''<section class="slide">
<div class="hd">MedX <span>&middot; {SECTIONS[s["sec"]]}</span></div><img class="lg" src="img2/lockup-color.svg">
<div class="kick">{s["kick"]}</div><div class="h">{s["head"]}</div>
<div class="body">{s["body"]}</div>
<div class="qb"><img src="img/fin-happy.svg"><b>&ldquo;{s["quote"]}&rdquo;</b><i>{s["follow"]}</i></div>
<div class="src">{s["src"]}</div>
<div class="pills">{pills}</div><div class="pn">{n}</div></section>''')
    n += 1
    out.append(f'''<section class="slide gs">
<img src="img2/lockup-white.svg" style="position:absolute;left:96px;top:90px;height:70px">
<div style="position:absolute;left:96px;top:250px;font-size:52px;font-weight:700;line-height:1.1;max-width:900px">MedX: Multilingual AI Copilot for Clinic Visits</div>
<div style="position:absolute;left:96px;top:420px;font-size:22px;line-height:1.5;max-width:760px;font-weight:300"><span style="font-size:15px;letter-spacing:.1em;text-transform:uppercase;opacity:.85">Every word, understood. &middot; A copilot supports clinicians and never decides.</span><br><br>One patient journey, from the patient's own words to the pharmacy. Every field points back to what the patient said. People decide.</div>
<div style="position:absolute;left:96px;bottom:90px;font-size:16px;line-height:1.6">Repo: github.com/KingPhuripol/MedX-AI &middot; Live demo: pending<br>Research prototype &middot; synthetic data only &middot; not a medical device &middot; Gemma via AMD Token Factory: designed, results [pending AMD run]</div>
<img src="img/fin-wave.svg" style="position:absolute;right:120px;top:170px;height:420px">
</section>''')
    return n, "\n".join(out)

n, body = render()
html = f'<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>MedX deck v2</title><style>{CSS}</style></head><body>\n{body}\n</body></html>'
open(os.path.join(HERE, "deck-v2.html"), "w").write(html)
print("slides", n)
