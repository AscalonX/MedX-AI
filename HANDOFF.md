# MedX — handoff (สำหรับเพื่อนในทีม)

อัปเดต: เสาร์ 17 ต.ค. 2026 ~22:00 ICT · ส่งงาน: **อาทิตย์ 18 ต.ค. 17:00 ICT** (lablab, AMD Developer Hackathon ACT III, Track 2 Health & Wellbeing)

## 1. MedX คืออะไร (30 วินาที)
ผู้ช่วยการคัดกรองหลายภาษา (ไทย / อิตาลี / อังกฤษ) ตลอดเส้นทางคนไข้:
**คนไข้** เล่าอาการในแอป (พิมพ์หรือพูด) → **พยาบาล** ซักประวัติด้วย consult assistant (ฟังแล้วเด้งคำถาม) + สัญญาณชีพ / NEWS2 → **หมอ** consult, ดู "considerations" (หมอเท่านั้น), เซ็นใบสรุป, สั่งตรวจ / สั่งยา (มีระบบตรวจแพ้ยา ยาตีกัน ขนาดยา) → **เภสัช** ตรวจรายการยา, ยืนยันหรือส่งคืนใบสั่งยา → **Ops** ภาพรวม
ทุกช่องข้อมูลชี้กลับไปที่ "คำพูดจริงของคนไข้" · red flag ใช้กฎตายตัว รันก่อนโมเดลเสมอ · **AI ไม่วินิจฉัย ไม่สั่งยา ไม่ตัดสิน triage** คนเป็นคนกดยืนยันทุกครั้ง · ข้อมูลสังเคราะห์เท่านั้น
มาสคอต: **Fin** (โลมา)

## 2. รันในเครื่อง (5 นาที)
```bash
git clone https://github.com/KingPhuripol/MedX-AI.git && cd MedX-AI
npm --prefix apps/web install
cd apps/web && MODEL_PROVIDER=mock DEMO_SEED=1 DEMO_AUTOSEED=1 DEMO_TOKEN=pick-a-secret npm run dev
# เปิด http://localhost:3000  (ข้อมูลเดโม 11 เคสจะ seed อัตโนมัติ)
# ล้างข้อมูลเดโม:  curl -X POST -H "x-demo-token: pick-a-secret" localhost:3000/api/demo/reset
```
หน้าหลัก: `/` · `/review` (พยาบาล/หมอ) · `/review/<id>/consult?mode=nurse|doctor` · `/review/<id>/vitals` · `/review/<id>/orders` · `/pharmacy` · `/ops` · `/patient/` (แอปผู้ป่วยเวอร์ชันเว็บ)
แอปผู้ป่วย native: `cd apps/mobile && npm install && npx expo start` (ดู `docs/DEMO.md`)
Docker: `docker build -f apps/web/Dockerfile -t medx . && docker run -p 3000:3000 -e MODEL_PROVIDER=mock -e DEMO_SEED=1 -e DEMO_AUTOSEED=1 medx`
เทสต์: `npm --prefix apps/web test` (1,863 tests) · กฎทางคลินิก: `node docs/clinical/check-redflags.mjs` (และ check-medrules / check-consultrules)

## 3. สิ่งที่ยังต้องทำก่อนส่ง (เรียงตามความสำคัญ)
| # | งาน | ใคร | วิธี |
|---|---|---|---|
| 1 | **AMD key (บังคับตามกติกา)** | เจ้าของทีมบน lablab | สร้างทีมบน lablab ให้เสร็จ → https://notebooks.amd.com/tokenfactory → เอา base URL, API key, model id ของ Gemma → ใส่ใน `apps/web/.env.local`: `MODEL_PROVIDER=amd`, `AMD_BASE_URL=`, `AMD_API_KEY=`, `AMD_MODEL=` (ห้าม commit) → รีสตาร์ท → `curl localhost:3000/api/health` ต้องขึ้น `amd-tokenfactory` |
| 2 | รันวัดผลบน AMD | ใครก็ได้ | `cd apps/web && npx vite-node ../../eval/run.ts -- --split dev` แล้ว `--split test` (ดู `eval/README.md`, `docs/ai/METRICS.md`) → เอาตัวเลขไปแทน "[pending AMD run]" ใน `pitch/deck/deck.html`, `pitch/SUBMISSION.md`, `README.md` → export PDF ใหม่ (Chrome headless, ดู `docs/reports/w9-pitch.md`) |
| 3 | ลิงก์เดโมออนไลน์ | เจ้าของ GitHub | https://render.com → login ด้วย GitHub → New → **Blueprint** → เลือก repo → Apply (ใช้ `render.yaml` ที่เตรียมไว้) · ถ้าได้ AMD key ให้ใส่ env AMD_* ใน Render dashboard ด้วย · (Vercel https://medx-bridge.vercel.app ขึ้นแล้วแต่ state แยกตาม instance — อย่าใช้เป็นลิงก์หลัก) |
| 4 | อัดวิดีโอ 3 นาที (อังกฤษ) | ทีม | สคริปต์ `pitch/VIDEO-SCRIPT.md` · ขั้นตอน + เคสที่ seed ไว้ `docs/DEMO.md` · ถ้า `/api/health` ยังเป็น mock **ห้ามพูดว่า "runs on AMD"** |
| 5 | กรอกฟอร์มส่งงานบน lablab | เจ้าของทีม | ใช้ข้อความใน `pitch/SUBMISSION.md` (short/long/tags/limitations), cover `pitch/cover/cover-v4.png`, สไลด์ `pitch/deck/MedX-deck.pdf`, GitHub repo, ลิงก์เดโม, วิดีโอ |
| 6 | (ถ้ามีเวลา) คนไทย/อิตาลีอ่านทวนข้อความในแอป | ใครก็ได้ | ข้อความ th/it เขียนโดย AI ยังไม่ผ่าน native speaker: `apps/mobile/src/i18n.ts`, `apps/web/app/**/_i18n.ts`, `packages/shared/src/redflags.json` (patientMessage) |

## 4. ไฟล์สำคัญ
- กติกาทีม / ข้อห้าม: `CLAUDE.md` · การตัดสินใจทั้งหมด: `docs/DECISIONS.md` · สถานะ: `docs/PROGRESS.md`
- ข้อมูลทางคลินิก (Doctor-owned): `packages/shared/src/{redflags,medrules,consultrules,vitalrules,investigations}.json`, `docs/clinical/*`
- AI / prompts / metrics: `docs/ai/DESIGN.md`, `docs/ai/METRICS.md`, `apps/web/lib/pipeline/`
- ดีไซน์: `docs/design/DIRECTION.md` (v2 + Fin §11), components `apps/web/components/ui/`
- รายงานทุกรอบ (review, QA, UX, safety): `docs/reports/`
- พิช: `pitch/` (deck, cover, video script, submission, safety)

## 5. ข้อจำกัดที่ต้องพูดตรง ๆ (อยู่ใน SUBMISSION/README แล้ว)
ข้อมูลสังเคราะห์ ไม่ได้ validate ทางคลินิก · กฎ red flag แบบคีย์เวิร์ดพลาดคำที่พูดอ้อม (holdout 7/10) · ยังไม่ได้วัดบน Gemma/AMD จริง (ถ้าไม่ได้ key) · เสียงพูดไปที่ speech service ของ Apple/Google/browser · ไม่มีระบบล็อกอินจริง (reviewer เลือกเอง) · การซ่อนข้อมูลส่วนตัวเป็นแบบ pattern · ฐานข้อมูลยา 59 ตัว 18 interactions · ฟอนต์ SCBXBeta2 เจ้าของตัดสินใจใช้แม้เมทาดาทาเป็น "All rights reserved"
