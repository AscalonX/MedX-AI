import { patientView } from '../../../lib/pipeline/patientView';
import { checkRateLimit } from '../../../lib/pipeline/rateLimit';
import { getSession, syncStore } from '../../../lib/pipeline/store';
import { cors } from '../_http';
export { OPTIONS } from '../_http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Read-aloud for the patient app (AMD-hosted OmniVoice). SAFETY: it only speaks text the system itself produced
 * for the patient, resolved server-side: the fixed opening question, the session's current next question, or the
 * session's red-flag patient message (all through patientView). There is no free-text input, so it cannot be used
 * as a general text-to-speech proxy. Text and audio are never logged. Any failure is a JSON error: the client
 * then falls back to the device voice.
 */
const LANGS = ['th', 'it', 'en'] as const;
type Lang = (typeof LANGS)[number];
/** Fixed opening question; keep identical to STR[lang].q1 in apps/mobile/src/i18n.ts. */
const Q1: Record<Lang, string> = { en: 'What brings you in today?', it: 'Che cosa la porta qui oggi?', th: 'วันนี้คุณมาด้วยเรื่องอะไร' };
const MAX_CHARS = 300;

const fail = (status: number, error: string, request: Request, extra: Record<string, string> = {}) =>
  Response.json({ error }, { status, headers: { ...cors(request), 'Cache-Control': 'no-store', ...extra } });

export async function POST(request: Request) {
  if (request.headers.get('x-medx-client') !== 'patient') return fail(403, 'Patient client only', request);
  if (process.env.MODEL_PROVIDER === 'mock' || !process.env.AMD_BASE_URL || !process.env.AMD_API_KEY) return fail(503, 'Voice unavailable', request);
  const limit = await checkRateLimit(request);
  if (limit.limited) return fail(429, 'Too many requests; retry in a minute', request, { 'Retry-After': String(limit.retryAfter) });

  let b: { kind?: unknown; lang?: unknown; sessionId?: unknown };
  try { b = await request.json(); } catch { return fail(400, 'Bad request', request); }
  const lang = b.lang as Lang;
  if (!LANGS.includes(lang)) return fail(400, 'Bad request', request);

  let input = '';
  if (b.kind === 'first_question') input = Q1[lang];
  else if ((b.kind === 'next_question' || b.kind === 'red_flag') && typeof b.sessionId === 'string' && b.sessionId.length <= 80) {
    try { await syncStore(); } catch { return fail(503, 'Voice unavailable', request); }
    const session = getSession(b.sessionId);
    const summary = session ? patientView(session).summary : null;
    input = (b.kind === 'next_question' ? summary?.nextQuestion?.text[lang] : summary?.redFlags[0]?.patientMessage[lang]) ?? '';
  } else return fail(400, 'Bad request', request);
  input = input.trim();
  if (!input) return fail(404, 'Nothing to read', request);
  if (input.length > MAX_CHARS) return fail(422, 'Text too long', request);

  try {
    const r = await fetch(`${process.env.AMD_BASE_URL.replace(/\/$/, '')}/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AMD_API_KEY}` },
      body: JSON.stringify({ model: process.env['AMD_MODEL_TTS'] || 'OmniVoice', input, voice: 'female', response_format: 'mp3' }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return fail(502, 'Voice unavailable', request);
    const audio = await r.arrayBuffer();
    if (!audio.byteLength) return fail(502, 'Voice unavailable', request);
    return new Response(audio, { headers: { ...cors(request), 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=300' } });
  } catch { return fail(502, 'Voice unavailable', request); }
}
