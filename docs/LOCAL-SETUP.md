# Local MedX setup

The checked-out app lives at `/Users/saltywan/KMUTT/SeniorProj/MedX-AI`.
Setup base: main commit `e049be6`, with local review fixes recorded in
`docs/reports/2026-10-18-local-codex.md`.

## Start

```bash
cd /Users/saltywan/KMUTT/SeniorProj/MedX-AI
./scripts/start-local.sh
```

Open http://127.0.0.1:3000 for staff and
http://127.0.0.1:3000/patient/ for the patient app. The patient web export is
already included; native Expo and microphone services are separate.

Node 22 and the locked web dependencies are installed. The ignored
`apps/web/.env.local` selects `MODEL_PROVIDER=mock`, enables automatic synthetic
fixtures, and contains a randomly generated reset token. It is readable only by
the current user. Do not commit it or paste its token into a report.

State persists in `apps/web/.data/store.json`, also ignored by Git. Stop the
server with Ctrl-C. Starting it again retains the cases, decisions and audit
events. Keep one server process per store file.

After application code changes, stop the server and rebuild:

```bash
npm --prefix apps/web run build
./scripts/start-local.sh
```

For hot reload during development, use:

```bash
npm --prefix apps/web run dev -- --hostname 127.0.0.1 --port 3000
```

## Connect AMD when credentials arrive

Edit `apps/web/.env.local`: set `MODEL_PROVIDER=amd`, `AMD_BASE_URL`,
`AMD_API_KEY` and `AMD_MODEL` from the Token Factory manual/catalogue. Restart
the server. Keep the key server-side.

`/api/health` reports configuration only. Verify a new, non-escalated synthetic
intake and inspect successful `amd-tokenfactory` calls in its Case Trace before
claiming AMD execution. Historical mock cases remain mock evidence.

## Review data

The browser review added B-012 (Italian intake, approved) and B-013 (Thai urgent
case, acknowledged and taken over). B-003 has a signed synthetic consult note
and confirmed synthetic vitals. B-009 has a synthetic medication order returned
by the pharmacist. These are local QA records, not real patient data.

No cloud deployment, GitHub push, live AMD inference, native-device test or
microphone permission was performed by this setup.
