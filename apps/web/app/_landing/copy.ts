import type { AuditType, Lang } from "@medx/shared";

/*
 * Landing copy (/, /th, /it). MedX's own words; nothing is copied from the reference site.
 * Claim boundary (CLAUDE.md, DIRECTION.md 12.1): supports clinicians, suggests for review, flags for clinician.
 * Never "diagnoses", "triages", "decides", "AI doctor". Sentence case, no em or en dashes, no exclamation marks.
 * Placeholders: {rules} red-flag rules, {drugs} drugs, {interactions} interactions, {doses} adult dose ceilings
 * (all counted from the rule files at build time), {model} and {hardware} (from /api/health at runtime).
 * Thai and Italian: native review pending (shown on the page).
 */

export type FeatureId =
  | "voice"
  | "redflag"
  | "consult"
  | "news2"
  | "considerations"
  | "orders"
  | "verify"
  | "dispense"
  | "pickup"
  | "ops"
  | "trace"
  | "audit";

export interface FeatureCopy {
  eyebrow: string;
  title: string;
  body: string;
  /** What the screen crop shows (alt text). Empty for cards whose UI is rendered by the page. */
  alt: string;
}

/** Audit event types shown on the audit card, in journey order (all present in the synthetic golden case). */
export const AUDIT_ROWS = [
  "review",
  "vitals_recorded",
  "triage_confirmed",
  "consult_note_signed",
  "order_submitted",
  "order_pharmacy_action",
  "order_dispensed",
  "pickup_collected",
] as const satisfies readonly AuditType[];
export type AuditRow = (typeof AUDIT_ROWS)[number];

export interface TitledText {
  title: string;
  body: string;
}

export interface LandingCopy {
  meta: { title: string; description: string; locale: string };
  hero: {
    eyebrow: string;
    titleA: string;
    titleB: string;
    subtitle: string;
    ctaDemo: string;
    ctaVideo: string;
    trustLabel: string;
    trust: string[];
    cardsLabel: string;
    langMeta: string;
    askMeta: string;
    askTitle: string;
    sentTitle: string;
  };
  built: { label: string; caption: string };
  video: {
    eyebrow: string;
    titleA: string;
    titleB: string;
    subtitle: string;
    name: string;
    playSound: string;
    play: string;
    caption: string;
    captions: string;
    fallback: string;
    missingTitle: string;
    missingBody: string;
    missingCta: string;
    /** Secondary action under the promo: opens the screen-recorded walkthrough in a dialog. */
    walkthrough: string;
    walkthroughTitle: string;
    walkthroughNote: string;
    close: string;
  };
  how: {
    eyebrow: string;
    titleA: string;
    titleB: string;
    subtitle: string;
    steps: [TitledText, TitledText, TitledText];
    human: string;
    trySaying: string;
    trySayingNote: string;
    sampleLang: Record<Lang, string>;
  };
  features: {
    eyebrow: string;
    titleA: string;
    titleB: string;
    subtitle: string;
    cards: Record<FeatureId, FeatureCopy>;
    redSample: string;
    redRule: string;
    redZero: string;
    auditCaption: string;
    audit: Record<AuditRow, string>;
  };
  safety: { eyebrow: string; titleA: string; titleB: string; subtitle: string; cards: [TitledText, TitledText, TitledText, TitledText] };
  why: {
    eyebrow: string;
    titleA: string;
    titleB: string;
    subtitle: string;
    stats: { value: string; label: string; source: string }[];
    newTab: string;
  };
  roles: { eyebrow: string; titleA: string; titleB: string; subtitle: string; more: string };
  phone: { eyebrow: string; titleA: string; titleB: string; subtitle: string; points: string[]; qrLabel: string; open: string; scanNote: string };
  hood: {
    eyebrow: string;
    titleA: string;
    titleB: string;
    subtitle: string;
    modelLabel: string;
    modelLoading: string;
    modelMock: string;
    modelLive: string;
    modelNotConfigured: string;
    modelUnknown: string;
    designed: string;
    chips: string[];
  };
  limits: { eyebrow: string; titleA: string; titleB: string; items: string[] };
  cta: { titleA: string; titleB: string; body: string; demo: string; video: string };
  footer: {
    disclaimer: string;
    note: string;
    navLabel: string;
    homeLabel: string;
    product: string;
    demo: string;
    project: string;
    patientApp: string;
    allRoles: string;
    staffHome: string;
    video: string;
    hood: string;
    limits: string;
  };
}

const en: LandingCopy = {
  meta: {
    title: "MedX: every word, understood",
    description:
      "Multilingual pre-visit intake that supports clinicians. Patients speak Thai, Italian or English, every field cites their words, red flags are code, and clinicians decide. Research prototype, synthetic data only.",
    locale: "en_US",
  },
  hero: {
    eyebrow: "Pre-visit intake for multilingual clinics",
    titleA: "Every word,",
    titleB: "understood.",
    subtitle:
      "Patients tell Fin what brings them in, by voice or text, in Thai, Italian or English. Fin listens and prepares the record while nurses, doctors and pharmacists decide. Every field points back to the patient's own words.",
    ctaDemo: "Try the demo",
    ctaVideo: "Watch in 60 seconds",
    trustLabel: "What MedX holds to",
    trust: ["Synthetic data only", "Thai, Italian, English", "Every field cites the patient", "Red flags are code", "A clinician approves"],
    cardsLabel: "What the patient sees",
    langMeta: "Language picked",
    askMeta: "Read aloud",
    askTitle: "How long have you had it?",
    sentTitle: "Sent. A nurse will review.",
  },
  built: {
    label: "Built with",
    caption:
      "Built for AMD Developer Hackathon ACT III · Track 2. Names only, no partnership implied. Gemma on AMD is the designed model target; the live label under the hood says what runs today.",
  },
  video: {
    eyebrow: "Watch",
    titleA: "MedX in",
    titleB: "60 seconds",
    subtitle: "One synthetic visit, from the patient's phone to the pharmacy counter.",
    name: "MedX in 60 seconds",
    playSound: "Play with sound",
    play: "Play",
    caption: "Synthetic cases only. The video starts muted until you choose sound.",
    captions: "English captions",
    fallback: "Download the video",
    missingTitle: "The 60-second video is on its way",
    missingBody: "Until it is published, the live demo shows the same journey with synthetic cases.",
    missingCta: "Try the demo",
    walkthrough: "Watch the full product walkthrough (2 min 15 s, narrated)",
    walkthroughTitle: "Full product walkthrough",
    walkthroughNote: "A screen recording of one synthetic visit, through every role, with English narration and captions.",
    close: "Close",
  },
  how: {
    eyebrow: "How it works",
    titleA: "From the patient's words",
    titleB: "to a person's decision",
    subtitle: "Three steps for every visit. The last one is always a person.",
    steps: [
      {
        title: "The patient speaks",
        body: "By voice or text, in Thai, Italian or English. Fin reads each question aloud, and the patient checks the transcript before sending.",
      },
      {
        title: "Rules first, then Fin prepares",
        body: "Red-flag rules run as code before any model. Then fields are extracted, and each one must quote the patient, checked by code.",
      },
      {
        title: "A person decides",
        body: "The nurse confirms triage, the doctor signs and orders, and pharmacists verify and dispense. Nothing is final until a clinician approves.",
      },
    ],
    human: "A person decides",
    trySaying: "Try saying",
    trySayingNote: "Synthetic examples. Each one opens the patient app with a fresh intake.",
    sampleLang: { en: "English", th: "Thai", it: "Italian" },
  },
  features: {
    eyebrow: "Features",
    titleA: "One record,",
    titleB: "every role",
    subtitle: "Each card shows a real MedX screen from a synthetic case.",
    cards: {
      voice: {
        eyebrow: "Patient",
        title: "Voice intake in three languages",
        body: "A voice agent reads each question aloud in Thai, Italian or English. The patient checks the transcript before it is sent, and a live status shows when a nurse has read it.",
        alt: "Patient app asking what brings you in today, with the transcript to check before sending",
      },
      redflag: {
        eyebrow: "Before any model",
        title: "Red flags are code",
        body: "{rules} deterministic, guideline-sourced rules read the raw text before any model call. A hit stops the intake and interrupts the clinician screen. No model output can clear it.",
        alt: "",
      },
      consult: {
        eyebrow: "Nurse",
        title: "A consult assistant that cites",
        body: "Ambient listening with ask-next and rule-out prompts, and a live summary where every field links to the sentence the patient said.",
        alt: "Consult assistant live summary, each field marked as coming from the patient's words",
      },
      news2: {
        eyebrow: "Nurse",
        title: "A triage suggestion the nurse confirms",
        body: "Vitals give a NEWS2-based triage suggestion for adults. The nurse confirms it, or records another level with a note.",
        alt: "Suggested triage level with the NEWS2 reasons and the nurse's confirmation",
      },
      considerations: {
        eyebrow: "Doctor",
        title: "Considerations, then a signed note",
        body: "Doctor-only considerations from a fixed curated list, labelled not a diagnosis, with guideline links. The draft note keeps its evidence, and the doctor signs it.",
        alt: "Signed visit note, read only, with the doctor's signature receipt and the presenting complaint from the patient's words",
      },
      orders: {
        eyebrow: "Doctor",
        title: "Orders with deterministic checks",
        body: "Allergy, interaction, duplicate, pregnancy and dose-range checks from a {drugs}-drug rule set. A high alert needs a written reason.",
        alt: "Prescribing form with dose, route, frequency and duration, and the Check button",
      },
      verify: {
        eyebrow: "Pharmacist 1",
        title: "Verify, or return with options",
        body: "The first pharmacist verifies each prescription or returns it with a note and options for prescriber review. An option is never written into the order.",
        alt: "Return to prescriber form with options for prescriber review",
      },
      dispense: {
        eyebrow: "Pharmacist 2",
        title: "Dispense with a two-person check",
        body: "A second pharmacist completes a six-item final check. The pharmacist who verified an order cannot dispense it.",
        alt: "The second pharmacist's six-item final check before dispensing",
      },
      pickup: {
        eyebrow: "Patient",
        title: "Called to the counter",
        body: "When the medicines are ready, the patient's phone shows the counter and their code. The pharmacist records the collection.",
        alt: "Patient app showing pharmacy counter 2 and the visit timeline",
      },
      ops: {
        eyebrow: "Clinic manager",
        title: "Operations at a glance",
        body: "Queue by urgency, abstain rate, the pharmacy pipeline and an honest model label, refreshed every few seconds.",
        alt: "Ops pharmacy flow: orders to verify and to dispense, and patients called to the counter",
      },
      trace: {
        eyebrow: "Every case",
        title: "Case trace",
        body: "The executed graph of how a case was handled: rule checks, model calls, skipped steps and human decisions, with a deterministic replay check.",
        alt: "Case trace graph from the patient turn through rule checks and model calls to the order checks",
      },
      audit: {
        eyebrow: "Every action",
        title: "Append-only audit log",
        body: "Reviews, edits, orders, dispensing and pickup are recorded with who did what. Nothing is final until a clinician approves.",
        alt: "",
      },
    },
    redSample: "Synthetic example",
    redRule: "Rule hit",
    redZero: "Escalated to a clinician with zero model calls",
    auditCaption: "Event types from the synthetic golden case",
    audit: {
      review: "Intake approved",
      vitals_recorded: "Vitals recorded",
      triage_confirmed: "Triage confirmed",
      consult_note_signed: "Note signed",
      order_submitted: "Order submitted",
      order_pharmacy_action: "Checked by pharmacist 1",
      order_dispensed: "Dispensed by pharmacist 2",
      pickup_collected: "Medicines collected",
    },
  },
  safety: {
    eyebrow: "Safety by design",
    titleA: "Fin prepares.",
    titleB: "People decide.",
    subtitle: "MedX prepares the record and a clinician approves it. These rules hold in every build, and the tests fail if one breaks.",
    cards: [
      {
        title: "Red flags are code, not a model",
        body: "{rules} deterministic rules run on the raw text before any model call. An add-only model screen can raise a flag with a verified quote, never clear one.",
      },
      {
        title: "No quote, no fact",
        body: "Every field must carry a quote from the patient's text, checked by code. Without one, the field shows Needs check and is never shown as fact.",
      },
      {
        title: "Abstain, do not guess",
        body: "A provider error, a schema error or low confidence gives needs human review, never a guess.",
      },
      {
        title: "People decide, on the record",
        body: "Triage is a suggestion the nurse confirms. The AI never proposes drugs or doses. High alerts need a written reason, and every action goes to an append-only audit log.",
      },
    ],
  },
  why: {
    eyebrow: "Why",
    titleA: "Language gaps",
    titleB: "cause harm",
    subtitle: "Published research, not MedX results.",
    stats: [
      {
        value: "49.1%",
        label: "of adverse events in limited-English patients involved physical harm, against 29.5% for English speakers, in six US hospitals.",
        source: "Divi et al., Int J Qual Health Care 2007",
      },
      {
        value: "13 to 59%",
        label: "of patients had at least one unintended error in their admission medicine list, across six pharmacist-checked studies. Omission was the most common.",
        source: "Six studies, 2017 to 2026, in the MedX research notes",
      },
      {
        value: "49.2%",
        label: "of doctors' office day went to EHR and desk work, against 27.0% on direct face time with patients.",
        source: "Sinsky et al., Ann Intern Med 2016",
      },
    ],
    newTab: "opens in a new tab",
  },
  roles: {
    eyebrow: "Demo accounts",
    titleA: "Try a",
    titleB: "role",
    subtitle: "Six synthetic people, one synthetic journey. Pick a role and MedX opens a fresh synthetic case at that person's step, signed in as them.",
    more: "All roles, live counts and the patient QR",
  },
  phone: {
    eyebrow: "Phone and web",
    titleA: "One record,",
    titleB: "two screens",
    subtitle: "The patient app runs on the phone; staff work on the web. Both read and write the same synthetic case.",
    points: [
      "The patient sees a live status: sent, reviewed, ready to collect.",
      "Staff see the same case, with every field linked to the patient's words.",
      "The patient app is a web build of the Expo app, so the demo needs no install.",
    ],
    qrLabel: "Scan to open the patient app",
    open: "Open the patient app",
    scanNote: "Point a phone camera at the code.",
  },
  hood: {
    eyebrow: "Under the hood",
    titleA: "Honest",
    titleB: "by default",
    subtitle: "The model label is read live from the server. The chips describe how this build is made.",
    modelLabel: "Model",
    modelLoading: "Reading the live model label",
    modelMock: "Demo runs a mock model; Gemma on AMD pending",
    modelLive: "{model} on {hardware}",
    modelNotConfigured: "Model provider not configured; every call abstains to human review",
    modelUnknown: "Model label unavailable right now",
    designed:
      "Designed target: Gemma via the hackathon's AMD Token Factory, through an OpenAI-compatible API with JSON-schema output, a per-call timeout and one repair retry.",
    chips: [
      "Next.js 15",
      "Expo SDK 58",
      "TypeScript, strict",
      "Neon Postgres shared store on the public demo",
      "{rules} red-flag rules",
      "{drugs} drugs, {interactions} interactions",
      "Append-only audit log",
      "Deterministic replay check",
    ],
  },
  limits: {
    eyebrow: "Limitations",
    titleA: "What MedX",
    titleB: "does not do",
    items: [
      "Research prototype that supports clinicians. It does not diagnose, treat, prescribe or decide urgency.",
      "Synthetic data only. Not clinically validated, not a medical device.",
      "Red-flag rules miss paraphrases: keyword rules alone caught 7 of 10 emergencies on an 18-case synthetic holdout.",
      "Considerations come from a fixed 12-presentation list, not a complete differential.",
      "The NEWS2 suggestion is for adults, not pregnancy, and the nurse confirms it.",
      "Prescribing checks use a small rule set ({drugs} drugs, {interactions} interactions, adult dose ceilings for {doses}) and miss what it lacks.",
      "Speech goes to the browser's or phone's cloud speech service. Redaction is imperfect, and reviewer identity is self-declared.",
      "Gemma accuracy and latency on AMD are not measured yet.",
      "The public demo resets every day at 03:00 ICT: demo cases and their audit log are cleared.",
    ],
  },
  cta: {
    titleA: "Walk through one visit,",
    titleB: "end to end",
    body: "Start as the patient, or step in as the nurse, the doctor or a pharmacist. Every case is synthetic.",
    demo: "Try the demo",
    video: "Watch in 60 seconds",
  },
  footer: {
    disclaimer:
      "Research prototype. MedX supports clinicians; it does not diagnose, treat, prescribe or decide urgency. Synthetic data only. Not clinically validated, not a medical device.",
    note: "Built for AMD Developer Hackathon ACT III, Track 2 (Health and wellbeing).",
    navLabel: "Footer",
    homeLabel: "MedX home",
    product: "Product",
    demo: "Demo",
    project: "Project",
    patientApp: "Patient app",
    allRoles: "All roles",
    staffHome: "Staff home",
    video: "Watch the video",
    hood: "Under the hood",
    limits: "Limitations",
  },
};

const th: LandingCopy = {
  meta: {
    title: "MedX: เข้าใจทุกคำของผู้ป่วย",
    description:
      "ระบบซักประวัติก่อนพบแพทย์หลายภาษาที่สนับสนุนบุคลากรทางการแพทย์ ผู้ป่วยพูดภาษาไทย อิตาลี หรืออังกฤษได้ ทุกช่องข้อมูลอ้างอิงคำพูดของผู้ป่วย สัญญาณอันตรายตรวจด้วยโค้ด และบุคลากรเป็นผู้ตัดสินใจ ต้นแบบงานวิจัย ใช้ข้อมูลสังเคราะห์เท่านั้น",
    locale: "th_TH",
  },
  hero: {
    eyebrow: "ซักประวัติก่อนพบแพทย์ สำหรับคลินิกหลายภาษา",
    titleA: "ทุกคำพูด",
    titleB: "เข้าใจครบ",
    subtitle:
      "ผู้ป่วยเล่าให้ Fin ฟังว่ามาด้วยอาการอะไร ด้วยเสียงหรือการพิมพ์ เป็นภาษาไทย อิตาลี หรืออังกฤษ Fin ตั้งใจฟังและเตรียมข้อมูลให้ ส่วนพยาบาล แพทย์ และเภสัชกรเป็นผู้ตัดสินใจ ทุกช่องข้อมูลอ้างอิงกลับไปยังคำพูดของผู้ป่วยเอง",
    ctaDemo: "ลองเดโม",
    ctaVideo: "ดูใน 60 วินาที",
    trustLabel: "หลักที่ MedX ยึดถือ",
    trust: ["ข้อมูลสังเคราะห์เท่านั้น", "ไทย อิตาลี อังกฤษ", "ทุกช่องอ้างอิงคำพูดผู้ป่วย", "สัญญาณอันตรายตรวจด้วยโค้ด", "บุคลากรเป็นผู้อนุมัติ"],
    cardsLabel: "สิ่งที่ผู้ป่วยเห็น",
    langMeta: "เลือกภาษาแล้ว",
    askMeta: "อ่านออกเสียง",
    askTitle: "เป็นมานานแค่ไหนแล้ว",
    sentTitle: "ส่งแล้ว พยาบาลจะตรวจดู",
  },
  built: {
    label: "สร้างด้วย",
    caption:
      "สร้างสำหรับ AMD Developer Hackathon ACT III · Track 2 แสดงเพียงชื่อ ไม่ได้หมายถึงความเป็นพันธมิตร Gemma บน AMD คือเป้าหมายที่ออกแบบไว้ ส่วนป้ายโมเดลสดในหัวข้อเบื้องหลังบอกว่าวันนี้ใช้อะไรจริง",
  },
  video: {
    eyebrow: "ดูวิดีโอ",
    titleA: "MedX ใน",
    titleB: "60 วินาที",
    subtitle: "การมาพบแพทย์หนึ่งครั้งด้วยข้อมูลสังเคราะห์ ตั้งแต่โทรศัพท์ของผู้ป่วยจนถึงช่องรับยา",
    name: "MedX ใน 60 วินาที",
    playSound: "เล่นพร้อมเสียง",
    play: "เล่น",
    caption: "เคสสังเคราะห์เท่านั้น วิดีโอเริ่มแบบปิดเสียงจนกว่าคุณจะเลือกเปิดเสียง",
    captions: "คำบรรยายภาษาอังกฤษ",
    fallback: "ดาวน์โหลดวิดีโอ",
    missingTitle: "วิดีโอ 60 วินาทีกำลังจะมา",
    missingBody: "ระหว่างนี้ เดโมสดแสดงเส้นทางเดียวกันด้วยเคสสังเคราะห์",
    missingCta: "ลองเดโม",
    walkthrough: "ดูการสาธิตผลิตภัณฑ์ฉบับเต็ม (2 นาที 15 วินาที มีเสียงบรรยายภาษาอังกฤษ)",
    walkthroughTitle: "การสาธิตผลิตภัณฑ์ฉบับเต็ม",
    walkthroughNote: "บันทึกหน้าจอของการมาพบแพทย์หนึ่งครั้งด้วยข้อมูลสังเคราะห์ ผ่านทุกบทบาท พร้อมเสียงบรรยายและคำบรรยายภาษาอังกฤษ",
    close: "ปิด",
  },
  how: {
    eyebrow: "วิธีการทำงาน",
    titleA: "จากคำพูดของผู้ป่วย",
    titleB: "สู่การตัดสินใจของคน",
    subtitle: "สามขั้นตอนในทุกการมาพบแพทย์ ขั้นสุดท้ายเป็นคนเสมอ",
    steps: [
      {
        title: "ผู้ป่วยเล่าอาการ",
        body: "ด้วยเสียงหรือการพิมพ์ เป็นภาษาไทย อิตาลี หรืออังกฤษ Fin อ่านคำถามแต่ละข้อออกเสียง และผู้ป่วยตรวจข้อความที่ถอดได้ก่อนส่ง",
      },
      {
        title: "ตรวจกฎก่อน แล้ว Fin จึงเตรียมข้อมูล",
        body: "กฎสัญญาณอันตรายทำงานเป็นโค้ดก่อนโมเดลใดๆ จากนั้นจึงดึงข้อมูลแต่ละช่อง ซึ่งต้องอ้างอิงคำพูดของผู้ป่วยและตรวจด้วยโค้ด",
      },
      {
        title: "คนเป็นผู้ตัดสินใจ",
        body: "พยาบาลยืนยันระดับการคัดแยก แพทย์ลงนามและสั่งการรักษา เภสัชกรตรวจสอบและจ่ายยา ไม่มีอะไรถือเป็นที่สิ้นสุดจนกว่าบุคลากรจะอนุมัติ",
      },
    ],
    human: "คนเป็นผู้ตัดสินใจ",
    trySaying: "ลองพูดว่า",
    trySayingNote: "ตัวอย่างสังเคราะห์ แต่ละอันเปิดแอปผู้ป่วยพร้อมการซักประวัติใหม่",
    sampleLang: { en: "อังกฤษ", th: "ไทย", it: "อิตาลี" },
  },
  features: {
    eyebrow: "ฟีเจอร์",
    titleA: "ข้อมูลชุดเดียว",
    titleB: "ทุกบทบาท",
    subtitle: "ทุกการ์ดเป็นหน้าจอจริงของ MedX จากเคสสังเคราะห์",
    cards: {
      voice: {
        eyebrow: "ผู้ป่วย",
        title: "ซักประวัติด้วยเสียงสามภาษา",
        body: "ผู้ช่วยเสียงอ่านคำถามแต่ละข้อออกเสียงเป็นภาษาไทย อิตาลี หรืออังกฤษ ผู้ป่วยตรวจข้อความที่ถอดได้ก่อนส่ง และเห็นสถานะสดเมื่อพยาบาลอ่านแล้ว",
        alt: "แอปผู้ป่วยถามว่ามาด้วยอาการอะไร พร้อมข้อความที่ถอดได้ให้ตรวจก่อนส่ง",
      },
      redflag: {
        eyebrow: "ก่อนโมเดลใดๆ",
        title: "สัญญาณอันตรายคือโค้ด",
        body: "กฎแบบกำหนดแน่นอน {rules} ข้อที่อ้างอิงแนวทางเวชปฏิบัติ อ่านข้อความดิบก่อนเรียกโมเดลใดๆ เมื่อพบจะหยุดการซักประวัติและแจ้งเตือนบนหน้าจอบุคลากร ผลจากโมเดลไม่สามารถยกเลิกได้",
        alt: "",
      },
      consult: {
        eyebrow: "พยาบาล",
        title: "ผู้ช่วยซักประวัติที่อ้างอิงได้",
        body: "ฟังบทสนทนาพร้อมแนะนำคำถามถัดไปและคำถามเพื่อตัดสาเหตุอันตราย และสรุปสดที่ทุกช่องลิงก์ไปยังประโยคที่ผู้ป่วยพูด",
        alt: "สรุปสดของผู้ช่วยซักประวัติ ทุกช่องระบุว่ามาจากคำพูดของผู้ป่วย",
      },
      news2: {
        eyebrow: "พยาบาล",
        title: "ข้อเสนอระดับการคัดแยกที่พยาบาลยืนยัน",
        body: "สัญญาณชีพให้ข้อเสนอระดับการคัดแยกตาม NEWS2 สำหรับผู้ใหญ่ พยาบาลยืนยัน หรือบันทึกระดับอื่นพร้อมหมายเหตุ",
        alt: "ระดับการคัดแยกที่เสนอ พร้อมเหตุผลจาก NEWS2 และการยืนยันของพยาบาล",
      },
      considerations: {
        eyebrow: "แพทย์",
        title: "ข้อพิจารณา แล้วจึงลงนามบันทึก",
        body: "ข้อพิจารณาสำหรับแพทย์เท่านั้น จากรายการคัดสรรที่กำหนดไว้ ระบุว่าไม่ใช่การวินิจฉัย พร้อมลิงก์แนวทาง ร่างบันทึกเก็บหลักฐานไว้ และแพทย์เป็นผู้ลงนาม",
        alt: "บันทึกการตรวจที่ลงนามแล้ว อ่านได้อย่างเดียว พร้อมใบยืนยันการลงนามของแพทย์และอาการสำคัญจากคำพูดของผู้ป่วย",
      },
      orders: {
        eyebrow: "แพทย์",
        title: "คำสั่งการรักษาพร้อมการตรวจแบบกำหนดแน่นอน",
        body: "ตรวจการแพ้ยา ยาตีกัน ยาซ้ำซ้อน การตั้งครรภ์ และช่วงขนาดยา จากชุดกฎยา {drugs} รายการ การแจ้งเตือนระดับสูงต้องเขียนเหตุผล",
        alt: "แบบฟอร์มสั่งยา พร้อมขนาดยา วิธีให้ ความถี่ ระยะเวลา และปุ่มตรวจ",
      },
      verify: {
        eyebrow: "เภสัชกรคนที่ 1",
        title: "ตรวจสอบ หรือส่งคืนพร้อมทางเลือก",
        body: "เภสัชกรคนแรกตรวจสอบใบสั่งยาแต่ละรายการ หรือส่งคืนพร้อมหมายเหตุและทางเลือกให้ผู้สั่งยาพิจารณา ทางเลือกจะไม่ถูกเขียนลงในคำสั่งเอง",
        alt: "แบบฟอร์มส่งคืนผู้สั่งยา พร้อมทางเลือกให้ผู้สั่งยาพิจารณา",
      },
      dispense: {
        eyebrow: "เภสัชกรคนที่ 2",
        title: "จ่ายยาด้วยการตรวจสองคน",
        body: "เภสัชกรคนที่สองตรวจขั้นสุดท้ายหกข้อ เภสัชกรที่ตรวจสอบคำสั่งแล้วจะจ่ายยารายการนั้นเองไม่ได้",
        alt: "การตรวจขั้นสุดท้ายหกข้อของเภสัชกรคนที่สองก่อนจ่ายยา",
      },
      pickup: {
        eyebrow: "ผู้ป่วย",
        title: "เรียกไปที่ช่องรับยา",
        body: "เมื่อยาพร้อม โทรศัพท์ของผู้ป่วยแสดงหมายเลขช่องและรหัสของตน เภสัชกรบันทึกการรับยา",
        alt: "แอปผู้ป่วยแสดงช่องรับยาหมายเลข 2 และลำดับขั้นตอนการมาพบแพทย์",
      },
      ops: {
        eyebrow: "ผู้จัดการคลินิก",
        title: "ภาพรวมการดำเนินงาน",
        body: "คิวตามความเร่งด่วน อัตราการงดตอบ ขั้นตอนห้องยา และป้ายโมเดลที่ซื่อตรง อัปเดตทุกไม่กี่วินาที",
        alt: "ขั้นตอนห้องยาในแดชบอร์ดการดำเนินงาน: คำสั่งยารอตรวจสอบและรอจ่าย และผู้ป่วยที่ถูกเรียกไปที่ช่องรับยา",
      },
      trace: {
        eyebrow: "ทุกเคส",
        title: "เส้นทางของเคส",
        body: "กราฟที่บันทึกว่าเคสถูกจัดการอย่างไร ทั้งการตรวจกฎ การเรียกโมเดล ขั้นที่ข้าม และการตัดสินใจของคน พร้อมการตรวจซ้ำแบบกำหนดแน่นอน",
        alt: "กราฟเส้นทางเคส ตั้งแต่ข้อความของผู้ป่วย ผ่านการตรวจกฎและการเรียกโมเดล จนถึงการตรวจคำสั่งยา",
      },
      audit: {
        eyebrow: "ทุกการกระทำ",
        title: "บันทึกตรวจสอบแบบเพิ่มได้อย่างเดียว",
        body: "การทบทวน การแก้ไข คำสั่ง การจ่ายยา และการรับยา ถูกบันทึกว่าใครทำอะไร ไม่มีอะไรถือเป็นที่สิ้นสุดจนกว่าบุคลากรจะอนุมัติ",
        alt: "",
      },
    },
    redSample: "ตัวอย่างสังเคราะห์",
    redRule: "กฎที่ตรง",
    redZero: "ส่งต่อให้บุคลากรโดยไม่เรียกโมเดลเลย",
    auditCaption: "ประเภทเหตุการณ์จากเคสตัวอย่างสังเคราะห์",
    audit: {
      review: "อนุมัติข้อมูลซักประวัติ",
      vitals_recorded: "บันทึกสัญญาณชีพ",
      triage_confirmed: "ยืนยันระดับการคัดแยก",
      consult_note_signed: "ลงนามบันทึก",
      order_submitted: "ส่งคำสั่งยา",
      order_pharmacy_action: "เภสัชกรคนที่ 1 ตรวจแล้ว",
      order_dispensed: "เภสัชกรคนที่ 2 จ่ายยา",
      pickup_collected: "ผู้ป่วยรับยาแล้ว",
    },
  },
  safety: {
    eyebrow: "ความปลอดภัยตั้งแต่การออกแบบ",
    titleA: "Fin เตรียม",
    titleB: "คนตัดสินใจ",
    subtitle: "MedX เตรียมข้อมูล และบุคลากรเป็นผู้อนุมัติ กฎเหล่านี้คงอยู่ในทุกเวอร์ชัน และการทดสอบจะล้มเหลวหากกฎข้อใดถูกละเมิด",
    cards: [
      {
        title: "สัญญาณอันตรายคือโค้ด ไม่ใช่โมเดล",
        body: "กฎแบบกำหนดแน่นอน {rules} ข้อทำงานกับข้อความดิบก่อนเรียกโมเดลใดๆ การคัดกรองด้วยโมเดลทำได้เพียงเพิ่มสัญญาณพร้อมคำพูดที่ยืนยันแล้ว ไม่สามารถยกเลิกได้",
      },
      {
        title: "ไม่มีคำพูดอ้างอิง ไม่ถือเป็นข้อเท็จจริง",
        body: "ทุกช่องต้องมีคำพูดจากข้อความของผู้ป่วย ตรวจด้วยโค้ด หากไม่มี ช่องนั้นจะแสดงว่าต้องตรวจ และไม่ถูกแสดงเป็นข้อเท็จจริง",
      },
      {
        title: "งดตอบ ไม่เดา",
        body: "เมื่อผู้ให้บริการขัดข้อง รูปแบบข้อมูลผิด หรือความมั่นใจต่ำ ระบบจะแจ้งว่าต้องให้คนทบทวน ไม่เดาเด็ดขาด",
      },
      {
        title: "คนตัดสินใจ และมีบันทึกทุกครั้ง",
        body: "ระดับการคัดแยกเป็นเพียงข้อเสนอที่พยาบาลยืนยัน AI ไม่เสนอยาหรือขนาดยา การแจ้งเตือนระดับสูงต้องเขียนเหตุผล และทุกการกระทำเข้าสู่บันทึกตรวจสอบแบบเพิ่มได้อย่างเดียว",
      },
    ],
  },
  why: {
    eyebrow: "ทำไม",
    titleA: "ช่องว่างทางภาษา",
    titleB: "ก่อให้เกิดอันตราย",
    subtitle: "ตัวเลขจากงานวิจัยที่ตีพิมพ์ ไม่ใช่ผลของ MedX",
    stats: [
      {
        value: "49.1%",
        label: "ของเหตุการณ์ไม่พึงประสงค์ในผู้ป่วยที่สื่อสารภาษาอังกฤษได้จำกัดก่อให้เกิดอันตรายทางกาย เทียบกับ 29.5% ในผู้พูดภาษาอังกฤษ ในโรงพยาบาลหกแห่งในสหรัฐฯ",
        source: "Divi et al., Int J Qual Health Care 2007",
      },
      {
        value: "13 ถึง 59%",
        label: "ของผู้ป่วยมีความคลาดเคลื่อนโดยไม่ตั้งใจอย่างน้อยหนึ่งรายการในรายการยาเมื่อรับเข้าโรงพยาบาล จากหกการศึกษาที่เภสัชกรตรวจสอบ การตกหล่นพบบ่อยที่สุด",
        source: "หกการศึกษา ปี 2017 ถึง 2026 ในบันทึกวิจัยของ MedX",
      },
      {
        value: "49.2%",
        label: "ของวันทำงานในคลินิกของแพทย์ใช้ไปกับเวชระเบียนอิเล็กทรอนิกส์และงานเอกสาร เทียบกับ 27.0% ที่ได้พบผู้ป่วยโดยตรง",
        source: "Sinsky et al., Ann Intern Med 2016",
      },
    ],
    newTab: "เปิดในแท็บใหม่",
  },
  roles: {
    eyebrow: "บัญชีเดโม",
    titleA: "ลองใช้ใน",
    titleB: "บทบาทต่างๆ",
    subtitle: "หกคนสังเคราะห์ เส้นทางการรักษาสังเคราะห์หนึ่งเส้นทาง เลือกบทบาท แล้ว MedX จะเปิดเคสสังเคราะห์ใหม่ในขั้นตอนของคนนั้น พร้อมเข้าสู่ระบบในนามของเขา",
    more: "ทุกบทบาท ตัวเลขสด และ QR สำหรับผู้ป่วย",
  },
  phone: {
    eyebrow: "โทรศัพท์และเว็บ",
    titleA: "ข้อมูลชุดเดียว",
    titleB: "สองหน้าจอ",
    subtitle: "แอปผู้ป่วยใช้บนโทรศัพท์ บุคลากรทำงานบนเว็บ ทั้งสองอ่านและเขียนเคสสังเคราะห์เดียวกัน",
    points: [
      "ผู้ป่วยเห็นสถานะสด ทั้งส่งแล้ว ทบทวนแล้ว และพร้อมรับยา",
      "บุคลากรเห็นเคสเดียวกัน ทุกช่องลิงก์ไปยังคำพูดของผู้ป่วย",
      "แอปผู้ป่วยเป็นเวอร์ชันเว็บของแอป Expo จึงไม่ต้องติดตั้งเพื่อลองเดโม",
    ],
    qrLabel: "สแกนเพื่อเปิดแอปผู้ป่วย",
    open: "เปิดแอปผู้ป่วย",
    scanNote: "ใช้กล้องโทรศัพท์ส่องที่รหัส",
  },
  hood: {
    eyebrow: "เบื้องหลัง",
    titleA: "ซื่อตรง",
    titleB: "เป็นค่าเริ่มต้น",
    subtitle: "ป้ายโมเดลอ่านสดจากเซิร์ฟเวอร์ ส่วนป้ายด้านล่างบอกว่าเวอร์ชันนี้สร้างขึ้นอย่างไร",
    modelLabel: "โมเดล",
    modelLoading: "กำลังอ่านป้ายโมเดลสด",
    modelMock: "เดโมใช้โมเดลจำลอง Gemma บน AMD ยังรอดำเนินการ",
    modelLive: "{model} บน {hardware}",
    modelNotConfigured: "ยังไม่ได้ตั้งค่าผู้ให้บริการโมเดล ทุกคำขอจะส่งให้คนทบทวน",
    modelUnknown: "ไม่สามารถอ่านป้ายโมเดลได้ในขณะนี้",
    designed:
      "เป้าหมายที่ออกแบบไว้: Gemma ผ่าน AMD Token Factory ของงานแฮกกาธอน ใช้ API ที่เข้ากันได้กับ OpenAI ให้ผลลัพธ์ตาม JSON schema มีเวลาจำกัดต่อคำขอ และลองซ่อมหนึ่งครั้ง",
    chips: [
      "Next.js 15",
      "Expo SDK 58",
      "TypeScript แบบ strict",
      "ที่เก็บข้อมูลร่วม Neon Postgres บนเดโมสาธารณะ",
      "กฎสัญญาณอันตราย {rules} ข้อ",
      "ยา {drugs} รายการ ยาตีกัน {interactions} คู่",
      "บันทึกตรวจสอบแบบเพิ่มได้อย่างเดียว",
      "การตรวจซ้ำแบบกำหนดแน่นอน",
    ],
  },
  limits: {
    eyebrow: "ข้อจำกัด",
    titleA: "สิ่งที่ MedX",
    titleB: "ไม่ได้ทำ",
    items: [
      "ต้นแบบงานวิจัยที่สนับสนุนบุคลากรทางการแพทย์ ไม่วินิจฉัย ไม่รักษา ไม่สั่งยา และไม่ตัดสินความเร่งด่วน",
      "ใช้ข้อมูลสังเคราะห์เท่านั้น ยังไม่ผ่านการตรวจสอบทางคลินิก และไม่ใช่เครื่องมือแพทย์",
      "กฎสัญญาณอันตรายอาจพลาดเมื่อผู้ป่วยใช้ถ้อยคำต่างไป กฎคำสำคัญเพียงอย่างเดียวจับภาวะฉุกเฉินได้ 7 จาก 10 ในชุดทดสอบสังเคราะห์ 18 เคส",
      "ข้อพิจารณามาจากรายการอาการนำ 12 กลุ่มที่กำหนดไว้ ไม่ใช่การวินิจฉัยแยกโรคที่ครบถ้วน",
      "ข้อเสนอตาม NEWS2 ใช้กับผู้ใหญ่ ไม่ใช้กับการตั้งครรภ์ และพยาบาลเป็นผู้ยืนยัน",
      "การตรวจการสั่งยาใช้ชุดกฎขนาดเล็ก (ยา {drugs} รายการ ยาตีกัน {interactions} คู่ ขนาดยาสูงสุดสำหรับผู้ใหญ่ {doses} รายการ) และพลาดสิ่งที่ไม่มีในชุดกฎ",
      "เสียงพูดถูกส่งไปยังบริการแปลงเสียงบนคลาวด์ของเบราว์เซอร์หรือโทรศัพท์ การปิดบังข้อมูลส่วนบุคคลยังไม่สมบูรณ์ และตัวตนของผู้ทบทวนเป็นการระบุเอง",
      "ยังไม่ได้วัดความแม่นยำและความเร็วของ Gemma บน AMD",
      "เดโมสาธารณะรีเซ็ตทุกวันเวลา 03:00 น. (เวลาประเทศไทย) เคสเดโมและบันทึกตรวจสอบของเคสจะถูกล้าง",
    ],
  },
  cta: {
    titleA: "ลองการมาพบแพทย์",
    titleB: "ตั้งแต่ต้นจนจบ",
    body: "เริ่มในฐานะผู้ป่วย หรือเข้าไปเป็นพยาบาล แพทย์ หรือเภสัชกร ทุกเคสเป็นข้อมูลสังเคราะห์",
    demo: "ลองเดโม",
    video: "ดูใน 60 วินาที",
  },
  footer: {
    disclaimer:
      "ต้นแบบงานวิจัย MedX สนับสนุนบุคลากรทางการแพทย์ ไม่วินิจฉัย ไม่รักษา ไม่สั่งยา และไม่ตัดสินความเร่งด่วน ใช้ข้อมูลสังเคราะห์เท่านั้น ยังไม่ผ่านการตรวจสอบทางคลินิก และไม่ใช่เครื่องมือแพทย์",
    note: "สร้างสำหรับ AMD Developer Hackathon ACT III, Track 2 (สุขภาพและความเป็นอยู่ที่ดี)",
    navLabel: "ส่วนท้าย",
    homeLabel: "หน้าแรก MedX",
    product: "ผลิตภัณฑ์",
    demo: "เดโม",
    project: "โครงการ",
    patientApp: "แอปผู้ป่วย",
    allRoles: "ทุกบทบาท",
    staffHome: "หน้าหลักบุคลากร",
    video: "ดูวิดีโอ",
    hood: "เบื้องหลัง",
    limits: "ข้อจำกัด",
  },
};

const it: LandingCopy = {
  meta: {
    title: "MedX: ogni parola, capita",
    description:
      "Accoglienza multilingue prima della visita, a supporto dei clinici. I pazienti parlano in tailandese, italiano o inglese, ogni campo cita le loro parole, i segnali d'allarme sono codice e decidono i clinici. Prototipo di ricerca, solo dati sintetici.",
    locale: "it_IT",
  },
  hero: {
    eyebrow: "Accoglienza prima della visita per cliniche multilingue",
    titleA: "Ogni parola,",
    titleB: "capita.",
    subtitle:
      "I pazienti raccontano a Fin il motivo della visita, a voce o per iscritto, in tailandese, italiano o inglese. Fin ascolta e prepara la scheda, mentre infermieri, medici e farmacisti decidono. Ogni campo rimanda alle parole del paziente.",
    ctaDemo: "Provi la demo",
    ctaVideo: "Guardi in 60 secondi",
    trustLabel: "I principi di MedX",
    trust: ["Solo dati sintetici", "Tailandese, italiano, inglese", "Ogni campo cita il paziente", "I segnali d'allarme sono codice", "Approva un clinico"],
    cardsLabel: "Cosa vede il paziente",
    langMeta: "Lingua scelta",
    askMeta: "Letta ad alta voce",
    askTitle: "Da quanto tempo ce l'ha?",
    sentTitle: "Inviato. Un infermiere lo esaminerà.",
  },
  built: {
    label: "Realizzato con",
    caption:
      "Realizzato per AMD Developer Hackathon ACT III · Track 2. Solo nomi, nessuna partnership. Gemma su AMD è l'obiettivo progettato; l'etichetta dal vivo in Sotto il cofano indica cosa funziona oggi.",
  },
  video: {
    eyebrow: "Video",
    titleA: "MedX in",
    titleB: "60 secondi",
    subtitle: "Una visita sintetica, dal telefono del paziente al banco della farmacia.",
    name: "MedX in 60 secondi",
    playSound: "Riproduci con audio",
    play: "Riproduci",
    caption: "Solo casi sintetici. Il video parte senza audio finché non sceglie di attivarlo.",
    captions: "Sottotitoli in inglese",
    fallback: "Scarica il video",
    missingTitle: "Il video di 60 secondi è in arrivo",
    missingBody: "Nel frattempo, la demo dal vivo mostra lo stesso percorso con casi sintetici.",
    missingCta: "Provi la demo",
    walkthrough: "Guardi la demo completa del prodotto (2 min 15 s, con voce narrante in inglese)",
    walkthroughTitle: "Demo completa del prodotto",
    walkthroughNote: "La registrazione dello schermo di una visita sintetica, attraverso ogni ruolo, con voce narrante e sottotitoli in inglese.",
    close: "Chiudi",
  },
  how: {
    eyebrow: "Come funziona",
    titleA: "Dalle parole del paziente",
    titleB: "alla decisione di una persona",
    subtitle: "Tre passi per ogni visita. L'ultimo è sempre una persona.",
    steps: [
      {
        title: "Il paziente racconta",
        body: "A voce o per iscritto, in tailandese, italiano o inglese. Fin legge ogni domanda ad alta voce e il paziente controlla la trascrizione prima di inviarla.",
      },
      {
        title: "Prima le regole, poi Fin prepara",
        body: "Le regole sui segnali d'allarme girano come codice prima di qualsiasi modello. Poi si estraggono i campi, e ognuno deve citare il paziente, con verifica nel codice.",
      },
      {
        title: "Decide una persona",
        body: "L'infermiere conferma il triage, il medico firma e prescrive, i farmacisti verificano e dispensano. Nulla è definitivo finché un clinico non approva.",
      },
    ],
    human: "Decide una persona",
    trySaying: "Provi a dire",
    trySayingNote: "Esempi sintetici. Ognuno apre l'app del paziente con una nuova accoglienza.",
    sampleLang: { en: "Inglese", th: "Tailandese", it: "Italiano" },
  },
  features: {
    eyebrow: "Funzioni",
    titleA: "Una scheda,",
    titleB: "ogni ruolo",
    subtitle: "Ogni riquadro mostra una vera schermata di MedX da un caso sintetico.",
    cards: {
      voice: {
        eyebrow: "Paziente",
        title: "Accoglienza vocale in tre lingue",
        body: "Un agente vocale legge ogni domanda ad alta voce in tailandese, italiano o inglese. Il paziente controlla la trascrizione prima dell'invio e uno stato in tempo reale mostra quando un infermiere l'ha letta.",
        alt: "App del paziente che chiede il motivo della visita, con la trascrizione da controllare prima dell'invio",
      },
      redflag: {
        eyebrow: "Prima di ogni modello",
        title: "I segnali d'allarme sono codice",
        body: "{rules} regole deterministiche, basate su linee guida, leggono il testo originale prima di qualsiasi chiamata al modello. Una corrispondenza ferma l'accoglienza e interrompe la schermata del clinico. Nessun output del modello può annullarla.",
        alt: "",
      },
      consult: {
        eyebrow: "Infermiere",
        title: "Un assistente di consulto che cita",
        body: "Ascolto ambientale con suggerimenti su cosa chiedere e cosa escludere, e un riepilogo in tempo reale in cui ogni campo rimanda alla frase del paziente.",
        alt: "Riepilogo in tempo reale dell'assistente, ogni campo indicato come proveniente dalle parole del paziente",
      },
      news2: {
        eyebrow: "Infermiere",
        title: "Un suggerimento di triage che l'infermiere conferma",
        body: "I parametri vitali danno un suggerimento di triage basato su NEWS2 per adulti. L'infermiere lo conferma o registra un altro livello con una nota.",
        alt: "Livello di triage suggerito con i motivi NEWS2 e la conferma dell'infermiere",
      },
      considerations: {
        eyebrow: "Medico",
        title: "Considerazioni, poi una nota firmata",
        body: "Considerazioni solo per il medico da un elenco curato e fisso, indicate come non diagnosi, con link alle linee guida. La bozza della nota conserva le prove e il medico la firma.",
        alt: "Nota di visita firmata, di sola lettura, con la ricevuta di firma del medico e il motivo della visita dalle parole del paziente",
      },
      orders: {
        eyebrow: "Medico",
        title: "Prescrizioni con controlli deterministici",
        body: "Controlli su allergie, interazioni, duplicati, gravidanza e intervalli di dose da un insieme di regole su {drugs} farmaci. Un avviso alto richiede una motivazione scritta.",
        alt: "Modulo di prescrizione con dose, via, frequenza e durata, e il pulsante di controllo",
      },
      verify: {
        eyebrow: "Farmacista 1",
        title: "Verificare, o restituire con opzioni",
        body: "Il primo farmacista verifica ogni prescrizione oppure la restituisce con una nota e opzioni da valutare per il prescrittore. Un'opzione non viene mai scritta nella prescrizione.",
        alt: "Modulo di restituzione al prescrittore con opzioni da valutare",
      },
      dispense: {
        eyebrow: "Farmacista 2",
        title: "Dispensare con doppio controllo",
        body: "Un secondo farmacista completa un controllo finale in sei punti. Il farmacista che ha verificato una prescrizione non può dispensarla.",
        alt: "Controllo finale in sei punti del secondo farmacista prima della dispensazione",
      },
      pickup: {
        eyebrow: "Paziente",
        title: "Chiamata al banco",
        body: "Quando i farmaci sono pronti, il telefono del paziente mostra il banco e il suo codice. Il farmacista registra il ritiro.",
        alt: "App del paziente con il banco della farmacia 2 e la cronologia della visita",
      },
      ops: {
        eyebrow: "Responsabile della clinica",
        title: "Operatività a colpo d'occhio",
        body: "Coda per urgenza, tasso di astensione, flusso della farmacia e un'etichetta onesta del modello, aggiornati ogni pochi secondi.",
        alt: "Flusso della farmacia nella dashboard: ordini da verificare e da dispensare, e pazienti chiamati al banco",
      },
      trace: {
        eyebrow: "Ogni caso",
        title: "Traccia del caso",
        body: "Il grafo eseguito di come è stato gestito un caso: controlli delle regole, chiamate al modello, passi saltati e decisioni umane, con una verifica di riproduzione deterministica.",
        alt: "Grafo della traccia dal turno del paziente, attraverso controlli delle regole e chiamate al modello, fino ai controlli della prescrizione",
      },
      audit: {
        eyebrow: "Ogni azione",
        title: "Registro di audit solo in aggiunta",
        body: "Revisioni, modifiche, prescrizioni, dispensazione e ritiro vengono registrati con chi ha fatto cosa. Nulla è definitivo finché un clinico non approva.",
        alt: "",
      },
    },
    redSample: "Esempio sintetico",
    redRule: "Regola attivata",
    redZero: "Segnalato a un clinico con zero chiamate al modello",
    auditCaption: "Tipi di evento dal caso sintetico di riferimento",
    audit: {
      review: "Accoglienza approvata",
      vitals_recorded: "Parametri vitali registrati",
      triage_confirmed: "Triage confermato",
      consult_note_signed: "Nota firmata",
      order_submitted: "Prescrizione inviata",
      order_pharmacy_action: "Controllata dal farmacista 1",
      order_dispensed: "Dispensata dal farmacista 2",
      pickup_collected: "Farmaci ritirati",
    },
  },
  safety: {
    eyebrow: "Sicurezza fin dal progetto",
    titleA: "Fin prepara.",
    titleB: "Le persone decidono.",
    subtitle: "MedX prepara la scheda e un clinico la approva. Queste regole valgono in ogni versione, e i test falliscono se una viene violata.",
    cards: [
      {
        title: "I segnali d'allarme sono codice, non un modello",
        body: "{rules} regole deterministiche girano sul testo originale prima di qualsiasi chiamata al modello. Un controllo del modello solo in aggiunta può sollevare un segnale con una citazione verificata, mai annullarlo.",
      },
      {
        title: "Nessuna citazione, nessun fatto",
        body: "Ogni campo deve riportare una citazione dal testo del paziente, verificata dal codice. Senza, il campo mostra Da verificare e non viene mai presentato come un fatto.",
      },
      {
        title: "Astenersi, non indovinare",
        body: "Un errore del fornitore, un errore di schema o una bassa confidenza portano a revisione umana necessaria, mai a un'ipotesi.",
      },
      {
        title: "Decidono le persone, tutto registrato",
        body: "Il triage è un suggerimento che l'infermiere conferma. L'IA non propone mai farmaci o dosi. Gli avvisi alti richiedono una motivazione scritta e ogni azione entra in un registro di audit solo in aggiunta.",
      },
    ],
  },
  why: {
    eyebrow: "Perché",
    titleA: "Le barriere linguistiche",
    titleB: "causano danni",
    subtitle: "Ricerca pubblicata, non risultati di MedX.",
    stats: [
      {
        value: "49,1%",
        label: "degli eventi avversi nei pazienti con inglese limitato ha causato danni fisici, contro il 29,5% per chi parla inglese, in sei ospedali statunitensi.",
        source: "Divi et al., Int J Qual Health Care 2007",
      },
      {
        value: "Dal 13 al 59%",
        label: "dei pazienti aveva almeno un errore non intenzionale nell'elenco dei farmaci al ricovero, in sei studi verificati da farmacisti. L'omissione era il più comune.",
        source: "Sei studi, dal 2017 al 2026, nelle note di ricerca di MedX",
      },
      {
        value: "49,2%",
        label: "della giornata in ambulatorio dei medici è andata a cartella elettronica e lavoro d'ufficio, contro il 27,0% di tempo diretto con i pazienti.",
        source: "Sinsky et al., Ann Intern Med 2016",
      },
    ],
    newTab: "si apre in una nuova scheda",
  },
  roles: {
    eyebrow: "Account demo",
    titleA: "Provi un",
    titleB: "ruolo",
    subtitle: "Sei persone sintetiche, un unico percorso sintetico. Scelga un ruolo e MedX apre un nuovo caso sintetico al passo di quella persona, con il suo accesso.",
    more: "Tutti i ruoli, i conteggi dal vivo e il QR del paziente",
  },
  phone: {
    eyebrow: "Telefono e web",
    titleA: "Una scheda,",
    titleB: "due schermi",
    subtitle: "L'app del paziente gira sul telefono; il personale lavora sul web. Entrambi leggono e scrivono lo stesso caso sintetico.",
    points: [
      "Il paziente vede uno stato in tempo reale: inviato, esaminato, pronto per il ritiro.",
      "Il personale vede lo stesso caso, con ogni campo collegato alle parole del paziente.",
      "L'app del paziente è la versione web dell'app Expo, quindi per la demo non serve installare nulla.",
    ],
    qrLabel: "Scansioni per aprire l'app del paziente",
    open: "Apri l'app del paziente",
    scanNote: "Inquadri il codice con la fotocamera del telefono.",
  },
  hood: {
    eyebrow: "Sotto il cofano",
    titleA: "Onesto",
    titleB: "per impostazione",
    subtitle: "L'etichetta del modello è letta in tempo reale dal server. Le etichette sotto descrivono come è fatta questa versione.",
    modelLabel: "Modello",
    modelLoading: "Lettura dell'etichetta del modello",
    modelMock: "La demo usa un modello simulato; Gemma su AMD in attesa",
    modelLive: "{model} su {hardware}",
    modelNotConfigured: "Fornitore del modello non configurato; ogni chiamata passa alla revisione umana",
    modelUnknown: "Etichetta del modello non disponibile al momento",
    designed:
      "Obiettivo progettato: Gemma tramite l'AMD Token Factory dell'hackathon, con API compatibile OpenAI, output secondo JSON schema, un tempo limite per chiamata e un tentativo di correzione.",
    chips: [
      "Next.js 15",
      "Expo SDK 58",
      "TypeScript in modalità strict",
      "Archivio condiviso Neon Postgres nella demo pubblica",
      "{rules} regole sui segnali d'allarme",
      "{drugs} farmaci, {interactions} interazioni",
      "Registro di audit solo in aggiunta",
      "Verifica di riproduzione deterministica",
    ],
  },
  limits: {
    eyebrow: "Limiti",
    titleA: "Cosa MedX",
    titleB: "non fa",
    items: [
      "Prototipo di ricerca a supporto dei clinici. Non diagnostica, non cura, non prescrive e non decide l'urgenza.",
      "Solo dati sintetici. Non validato clinicamente, non è un dispositivo medico.",
      "Le regole sui segnali d'allarme non colgono le parafrasi: le sole regole a parole chiave hanno colto 7 emergenze su 10 in un set sintetico di 18 casi.",
      "Le considerazioni provengono da un elenco fisso di 12 quadri clinici, non da una diagnosi differenziale completa.",
      "Il suggerimento NEWS2 vale per adulti, non in gravidanza, e lo conferma l'infermiere.",
      "I controlli di prescrizione usano un piccolo insieme di regole ({drugs} farmaci, {interactions} interazioni, dosi massime per adulti per {doses}) e non colgono ciò che manca.",
      "La voce passa al servizio vocale cloud del browser o del telefono. L'oscuramento dei dati è imperfetto e l'identità del revisore è autodichiarata.",
      "Accuratezza e latenza di Gemma su AMD non sono ancora misurate.",
      "La demo pubblica si azzera ogni giorno alle 03:00 ICT: i casi demo e il loro registro di audit vengono cancellati.",
    ],
  },
  cta: {
    titleA: "Percorra una visita",
    titleB: "dall'inizio alla fine",
    body: "Inizi come paziente, oppure entri come infermiere, medico o farmacista. Ogni caso è sintetico.",
    demo: "Provi la demo",
    video: "Guardi in 60 secondi",
  },
  footer: {
    disclaimer:
      "Prototipo di ricerca. MedX supporta i clinici; non diagnostica, non cura, non prescrive e non decide l'urgenza. Solo dati sintetici. Non validato clinicamente, non è un dispositivo medico.",
    note: "Realizzato per AMD Developer Hackathon ACT III, Track 2 (Salute e benessere).",
    navLabel: "Piè di pagina",
    homeLabel: "Home di MedX",
    product: "Prodotto",
    demo: "Demo",
    project: "Progetto",
    patientApp: "App del paziente",
    allRoles: "Tutti i ruoli",
    staffHome: "Home del personale",
    video: "Guardi il video",
    hood: "Sotto il cofano",
    limits: "Limiti",
  },
};

export const LANDING_COPY: Record<Lang, LandingCopy> = { en, th, it };
