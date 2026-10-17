# Red-flag matcher test cases (v1.0)

For: AI engineer (unit tests for the red-flag engine). Source rules: `packages/shared/src/redflags.json`.
Run the reference check: `node docs/clinical/check-redflags.mjs` (exit 0 = all rows pass).

## Matcher semantics these cases assume (please implement exactly)

1. Normalise patient text: Unicode NFC → lower-case → curly quotes `’ ‘` → `'` → collapse whitespace → **prefix one space** (so Latin cues like `" no "` match at the start of the text).
2. A term matches as a plain substring (Thai has no word spaces).
3. An occurrence is **negated** if any `negationCue` appears inside the `negationWindowChars` (14) characters immediately before it.
4. A term counts if **at least one** of its occurrences is not negated. A group passes if any term counts. A rule fires if **every** group passes.
5. `requires` is not used by any v1.0 rule (on purpose: extracted fields come from the model, and the model must never be able to stop a rule).
6. Evidence for a hit = the matched term occurrence (turnId, quote, offsets) in the original, un-normalised turn text.

`expect` = `fire` (rule must fire) or `no` (rule must NOT fire). A `no` row only asserts about the named rule.

## Cases

| rule | lang | expect | text |
|---|---|---|---|
| RF-CHEST-01 | en | fire | I have chest pain and I'm sweating a lot |
| RF-CHEST-01 | en | fire | Crushing pressure in my chest going down my arm |
| RF-CHEST-01 | en | no | Chest pain when I cough, no sweating, no breathlessness |
| RF-CHEST-01 | it | fire | Ho un dolore al petto e sono tutto sudato |
| RF-CHEST-01 | it | fire | Sento un peso sul petto che va al braccio sinistro |
| RF-CHEST-01 | it | no | Ho dolore al petto ma non sono sudato |
| RF-CHEST-01 | th | fire | แน่นหน้าอก เหงื่อออกเยอะมาก |
| RF-CHEST-01 | th | fire | เจ็บหน้าอกร้าวไปแขนซ้าย |
| RF-CHEST-01 | th | no | เจ็บหน้าอกเวลาไอ ไม่มีอาการเหงื่อออก |
| RF-CHEST-02 | en | fire | My chest hurts since this morning |
| RF-CHEST-02 | en | fire | Tight chest when I climb stairs |
| RF-CHEST-02 | en | no | No chest pain, just a cough |
| RF-CHEST-02 | it | fire | Ho male al petto da ieri |
| RF-CHEST-02 | it | fire | Ho una fitta al petto |
| RF-CHEST-02 | it | no | Non ho dolore al petto, solo tosse |
| RF-CHEST-02 | th | fire | เจ็บหน้าอกมาสองวัน |
| RF-CHEST-02 | th | fire | รู้สึกจุกอกหลังกินข้าว |
| RF-CHEST-02 | th | no | แน่นอนค่ะ ไอมาสามวัน |
| RF-STROKE-01 | en | fire | My face is drooping on the left side |
| RF-STROKE-01 | en | fire | Since an hour my speech is slurred and my right arm is weak |
| RF-STROKE-01 | en | no | I can't speak Thai, I have a cough |
| RF-STROKE-01 | it | fire | Mio padre ha la bocca storta da stamattina |
| RF-STROKE-01 | it | fire | Ho il braccio debole e la parola impastata |
| RF-STROKE-01 | it | no | Parlo male il thai, ho mal di gola |
| RF-STROKE-01 | th | fire | แม่ปากเบี้ยว พูดไม่ชัด |
| RF-STROKE-01 | th | fire | แขนขวาอ่อนแรง ยกแขนไม่ขึ้นตั้งแต่เช้า |
| RF-STROKE-01 | th | no | ปวดหัวข้างเดียว ไม่มีอาการปากเบี้ยว |
| RF-BREATH-01 | en | fire | I can’t breathe properly |
| RF-BREATH-01 | en | fire | His lips are blue |
| RF-BREATH-01 | en | no | I can breathe fine, just a sore throat |
| RF-BREATH-01 | it | fire | Non riesco a respirare |
| RF-BREATH-01 | it | fire | Mi manca l’aria |
| RF-BREATH-01 | it | no | Respiro bene, ho solo il naso chiuso |
| RF-BREATH-01 | th | fire | หายใจไม่ออก |
| RF-BREATH-01 | th | fire | หายใจไม่ทันเลยค่ะ ปากเขียว |
| RF-BREATH-01 | th | no | หายใจได้ปกติ ไอนิดหน่อย |
| RF-BREATH-02 | en | fire | I've been short of breath for two days |
| RF-BREATH-02 | en | fire | There is wheezing at night |
| RF-BREATH-02 | en | no | No shortness of breath |
| RF-BREATH-02 | it | fire | Ho il fiato corto quando cammino |
| RF-BREATH-02 | it | fire | Ho affanno da ieri |
| RF-BREATH-02 | it | no | Non ho affanno |
| RF-BREATH-02 | th | fire | หายใจเหนื่อยเวลาเดิน |
| RF-BREATH-02 | th | fire | หอบเหนื่อยตอนกลางคืน |
| RF-BREATH-02 | th | no | ไม่มีอาการหอบเหนื่อย |
| RF-ANAPH-01 | en | fire | After eating shrimp my lips are swollen and I feel dizzy |
| RF-ANAPH-01 | en | fire | Got stung by a wasp, now hives everywhere and trouble breathing |
| RF-ANAPH-01 | en | no | My eyes are swollen from crying, nothing else |
| RF-ANAPH-01 | it | fire | Ho mangiato gamberi e ho le labbra gonfie |
| RF-ANAPH-01 | it | fire | Dopo una puntura di vespa ho l'orticaria e respiro male |
| RF-ANAPH-01 | it | no | Ho l'orticaria da una settimana, senza altri sintomi |
| RF-ANAPH-01 | th | fire | กินกุ้งแล้วปากบวม หายใจลำบาก |
| RF-ANAPH-01 | th | fire | โดนผึ้งต่อย ลมพิษขึ้นทั้งตัว |
| RF-ANAPH-01 | th | no | ตาบวมเพราะนอนน้อย |
| RF-SUICIDE-01 | en | fire | Sometimes I want to kill myself |
| RF-SUICIDE-01 | en | fire | I took all my pills last night |
| RF-SUICIDE-01 | en | no | I'm worried about my blood pressure |
| RF-SUICIDE-01 | it | fire | Voglio farla finita |
| RF-SUICIDE-01 | it | fire | Penso di togliermi la vita |
| RF-SUICIDE-01 | it | no | Ho paura di morire per questo dolore |
| RF-SUICIDE-01 | th | fire | ไม่อยากมีชีวิตอยู่แล้ว |
| RF-SUICIDE-01 | th | fire | อยากฆ่าตัวตาย |
| RF-SUICIDE-01 | th | no | กลัวตายค่ะ ใจสั่น |
| RF-BLEED-01 | en | fire | I've been vomiting blood this morning |
| RF-BLEED-01 | en | fire | Coughing up blood since yesterday |
| RF-BLEED-01 | en | no | No blood in stool |
| RF-BLEED-01 | it | fire | Ho vomitato sangue |
| RF-BLEED-01 | it | fire | Feci nere da due giorni |
| RF-BLEED-01 | it | no | Niente sangue nelle feci |
| RF-BLEED-01 | th | fire | อาเจียนเป็นเลือด |
| RF-BLEED-01 | th | fire | ถ่ายดำมาสองวัน |
| RF-BLEED-01 | th | no | ไม่มีอาการถ่ายเป็นเลือด |
| RF-PREG-01 | en | fire | I'm 8 weeks pregnant and have stomach pain |
| RF-PREG-01 | en | fire | Missed my period and now some spotting |
| RF-PREG-01 | en | no | I'm not pregnant, I have stomach pain |
| RF-PREG-01 | it | fire | Sono incinta e ho perdite di sangue |
| RF-PREG-01 | it | fire | Ciclo in ritardo e mal di pancia forte |
| RF-PREG-01 | it | no | Non sono incinta, ho mal di pancia |
| RF-PREG-01 | th | fire | ตั้งครรภ์ 2 เดือน ปวดท้องน้อยมาก |
| RF-PREG-01 | th | fire | ประจำเดือนไม่มา มีเลือดออกทางช่องคลอด |
| RF-PREG-01 | th | no | ปวดท้องได้ 2 วันแล้ว ท้องเสีย |
| RF-HEAD-01 | en | fire | Worst headache of my life, came on suddenly |
| RF-HEAD-01 | en | fire | Sudden headache like being hit on the head |
| RF-HEAD-01 | en | no | Mild headache for a week, not sudden |
| RF-HEAD-01 | it | fire | Il peggior mal di testa della mia vita |
| RF-HEAD-01 | it | fire | Non ho mai avuto un mal di testa così |
| RF-HEAD-01 | it | no | Mal di testa leggero da tre giorni |
| RF-HEAD-01 | th | fire | ปวดหัวมากที่สุดในชีวิต |
| RF-HEAD-01 | th | fire | จู่ๆ ก็ปวดหัวเหมือนจะระเบิด |
| RF-HEAD-01 | th | no | ปวดหัวตุบๆ เป็นประจำ |
| RF-SEIZ-01 | en | fire | My son had a seizure this morning |
| RF-SEIZ-01 | en | fire | She was convulsing for two minutes |
| RF-SEIZ-01 | en | no | No seizures ever |
| RF-SEIZ-01 | it | fire | Ha avuto una crisi epilettica |
| RF-SEIZ-01 | it | fire | Convulsioni ieri sera |
| RF-SEIZ-01 | it | no | Nessuna convulsione |
| RF-SEIZ-01 | th | fire | ลูกชักเกร็งเมื่อเช้า |
| RF-SEIZ-01 | th | fire | มีอาการชักแล้วหมดสติ |
| RF-SEIZ-01 | th | no | ปวดหัว อาการชักจะแย่ลง |
| RF-MENING-01 | en | fire | High fever and a stiff neck |
| RF-MENING-01 | en | fire | Fever with purple spots that don't fade |
| RF-MENING-01 | en | no | Fever and sore throat, neck is fine |
| RF-MENING-01 | it | fire | Febbre alta e collo rigido |
| RF-MENING-01 | it | fire | Ho la febbre e macchie viola sulle gambe |
| RF-MENING-01 | it | no | Collo rigido ma senza febbre |
| RF-MENING-01 | th | fire | ไข้สูง คอแข็ง ก้มคอไม่ได้ |
| RF-MENING-01 | th | fire | ตัวร้อนมีจ้ำเลือดตามตัว |
| RF-MENING-01 | th | no | ไข้ ไอ เจ็บคอ |
| RF-CONSC-01 | en | fire | My father is confused and not making sense |
| RF-CONSC-01 | en | fire | She is hard to wake up |
| RF-CONSC-01 | en | no | I'm alert and feel fine, just a rash |
| RF-CONSC-01 | it | fire | Mia madre è confusa |
| RF-CONSC-01 | it | fire | Non risponde quando lo chiamo |
| RF-CONSC-01 | it | no | Sono lucido, ho solo tosse |
| RF-CONSC-01 | th | fire | พ่อซึมลง เรียกไม่ค่อยตื่น |
| RF-CONSC-01 | th | fire | แม่พูดจาสับสน |
| RF-CONSC-01 | th | no | รู้สึกตัวดี ไอนิดหน่อย |
| RF-SYNC-01 | en | fire | I fainted at work |
| RF-SYNC-01 | en | fire | I passed out in the shower |
| RF-SYNC-01 | en | no | I never fainted, just tired |
| RF-SYNC-01 | it | fire | Sono svenuta stamattina |
| RF-SYNC-01 | it | fire | Ho perso i sensi per un attimo |
| RF-SYNC-01 | it | no | Non sono mai svenuto |
| RF-SYNC-01 | th | fire | เป็นลมหมดสติไปเมื่อเช้า |
| RF-SYNC-01 | th | fire | วูบไปตอนยืน |
| RF-SYNC-01 | th | no | ไม่เคยมีอาการหมดสติ |
| RF-ABD-01 | en | fire | Severe stomach pain since last night |
| RF-ABD-01 | en | fire | Belly pain 9/10, I can't stand up |
| RF-ABD-01 | en | no | Mild stomach ache after dinner |
| RF-ABD-01 | it | fire | Dolore alla pancia fortissimo |
| RF-ABD-01 | it | fire | Mal di stomaco insopportabile |
| RF-ABD-01 | it | no | Un po' di mal di pancia, niente di grave |
| RF-ABD-01 | th | fire | ปวดท้องมากจนเดินไม่ไหว |
| RF-ABD-01 | th | fire | ปวดท้องรุนแรงตั้งแต่เมื่อคืน |
| RF-ABD-01 | th | no | ปวดท้องนิดหน่อยหลังกินข้าว |
| RF-FEVER-INF-01 | en | fire | My baby has a fever |
| RF-FEVER-INF-01 | en | fire | My 6 weeks old daughter has a high temperature |
| RF-FEVER-INF-01 | en | no | My baby has a rash, no fever |
| RF-FEVER-INF-01 | it | fire | Il mio bimbo di 2 mesi ha la febbre |
| RF-FEVER-INF-01 | it | fire | Neonato con febbre a 38 |
| RF-FEVER-INF-01 | it | no | Il neonato sta bene, senza febbre |
| RF-FEVER-INF-01 | th | fire | ลูกอายุ 2 เดือน มีไข้ |
| RF-FEVER-INF-01 | th | fire | ทารกตัวร้อนมาก |
| RF-FEVER-INF-01 | th | no | ไข้มาสองวัน |

## Known false positives (accepted on purpose: they fail safe)

These fire today and the test asserts that, so nobody "fixes" them by accident without a clinical decision.
A false alarm costs the nurse ~5 s (the evidence quote is shown); a missed red flag can cost a life.

| rule | lang | expect | text |
|---|---|---|---|
| RF-CHEST-02 | th | fire | ไม่เจ็บหน้าอก |
| RF-BREATH-01 | th | fire | คัดจมูกหายใจไม่ออก |
| RF-PREG-01 | th | fire | ไม่ได้ตั้งครรภ์ แต่ปวดท้อง |
| RF-SUICIDE-01 | en | fire | I don't want to die, I'm scared |

Why: bare Thai `ไม่` / `ไม่ได้` are deliberately **not** negation cues. They are too common inside red-flag phrases
(`หายใจไม่ได้ เจ็บหน้าอก` would otherwise negate the chest pain; `ไม่มีแรง แน่นหน้าอก` likewise). Thai negation is
only recognised in the explicit form `ไม่มีอาการ… / ไม่เคยมีอาการ… / ไม่ได้มีอาการ…`.

## Multi-rule expectations (for the engine, not single-rule rows)

- `แน่นหน้าอก เหงื่อออก` fires RF-CHEST-01 (emergency) **and** RF-CHEST-02 (urgent). Show highest severity first; list both.
- `หายใจไม่ได้ เจ็บหน้าอก` fires RF-BREATH-01 and RF-CHEST-02 (and RF-CHEST-01 if a G2 term is also present).
- A rule hit in turn 1 stays active after later turns; red flags are never cleared by a later turn or by the model.
