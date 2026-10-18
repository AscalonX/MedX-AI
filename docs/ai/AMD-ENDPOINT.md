# AMD developer API — endpoint notes (probed 18 Oct 2026, ~12:10 ICT)

Base URL: `https://developer.amd.com.cn/radeon/api/v1` (OpenAI-compatible). Key: env `AMD_API_KEY` only — never commit it.
Local dev: `apps/web/.env.development.local` (gitignored; overrides `.env.local` in `next dev`). For scripts: `set -a; . apps/web/.env.development.local; set +a`.

| Use in MedX | Model id | What we saw |
|---|---|---|
| Extraction, translation, red-flag screen, next question (primary) | `Gemma-4-31B-IT` | `json_output: true`; live Italian turn: screen 1.7 s, extraction 15.3 s, next question 3.6 s |
| Fallback (`AMD_MODEL_FALLBACK`) | `Qwen3.8-27B` | Reasoning model; returns `reasoning` + `content` (content may start with newlines). ~8 s for a tiny prompt |
| Second add-only red-flag screen | `DeepSeek-V4.1-Flash` | `json_output: true`; ~0.5 s for a tiny prompt |
| Medicine-pack photo | `MiniCPM-V-4.7-35B-A3B` (also `MiniCPM-V-4.7-1B`) | `image_url` data-URL content works; synthetic label read correctly in 49 s (slow). Gemma vision returned a provider 500 in one try |
| Read-aloud | `OmniVoice` via `POST /audio/speech` | `{model, input, voice, response_format:"mp3"}` → `audio/mpeg`, 24 kHz mono; EN 4.1 s, TH 2.2 s. Voices: auto, female, male, female-low, male-low, female-british, male-british, female-american, male-american |

`GET /models` lists 16 ids (also Clef, d3, d3-flash, DeepSeek-V4-Flash, DeepSeek-V4-Flash-Vision-Exp, GLM-5.3-Flash, MiMo-V2.6-Flash, MinerU2.5-Pro (OCR), MiniCPM5-2B, Qwen3.8-Flash-Next). All marked `stability: experimental`.

Claims: say "runs on AMD-hosted models through the AMD developer API". The API does not tell us the hardware; do not claim Instinct/ROCm or a specific GPU.
