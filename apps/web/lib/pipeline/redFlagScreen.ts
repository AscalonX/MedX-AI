import rules from '@medx/shared/src/redflags.json';
import type { IntakeSession, RedFlagHit } from '@medx/shared';
import { invoke, type EngineContext } from './extract';
import type { ChatRequest } from './llm';
import { aliases, SCREEN_SYSTEM, screenPrompt } from './prompts';
import { type ScreenCategory, validateScreen } from './schema';
import { verifyDetailed } from './verify';

// DESIGN §8.3: copy the clinical wording and severity, never trust model grading.
const CATEGORY_RULE: Record<ScreenCategory, string> = {
  CHEST: 'RF-CHEST-01', STROKE: 'RF-STROKE-01', BREATH: 'RF-BREATH-01',
  ANAPH: 'RF-ANAPH-01', SUICIDE: 'RF-SUICIDE-01', BLEED: 'RF-BLEED-01',
  PREG: 'RF-PREG-01', HEAD: 'RF-HEAD-01', SEIZ: 'RF-SEIZ-01', MENING: 'RF-MENING-01',
  CONSC: 'RF-CONSC-01', SYNC: 'RF-SYNC-01', ABD: 'RF-ABD-01', 'FEVER-INF': 'RF-FEVER-INF-01',
};
/** Second, independent, add-only screen (env AMD_MODEL_SCREEN2): same prompt, validation and quote verification, short timeout, no repair retry. */
export const SCREEN2_TIMEOUT_MS = 6000;
/** Model hit with optional attribution; `models` is set only when the second screen is on (shared RedFlagHit type unchanged; contract change requested in report). */
export type ScreenedHit = RedFlagHit & { models?: string[] };
export async function redFlagScreen2(session: IntakeSession, ctx: EngineContext, model: string): Promise<ScreenedHit[]> {
  try { return await redFlagScreen(session, ctx, { model, timeoutMs: SCREEN2_TIMEOUT_MS }); } catch { return []; }
}
export async function redFlagScreen(session: IntakeSession, ctx: EngineContext, second?: { model: string; timeoutMs: number }): Promise<RedFlagHit[]> {
  if (second) { const log = ctx.log; ctx = { ...ctx, log: log && ((event, detail) => log(event, { ...detail, screen: 'second', model: second.model })) }; }
  const request: ChatRequest = { step: 'red_flags', system: SCREEN_SYSTEM, user: screenPrompt(session), schemaName: 'red_flag_screen', timeoutMs: second?.timeoutMs ?? 12000, ...(second ? { model: second.model } : {}) };
  let result = await invoke(request, ctx);
  const unavailable = () => { ctx.log?.('screen_unavailable', { modelCalls: ctx.modelCalls.filter(c => c.step === 'red_flags') }); return []; };
  if (!result.call.ok && result.failure !== 'schema_error') return unavailable();
  let validation = validateScreen(result.data);
  if (!validation) {
    result.call.ok = false; result.call.error = 'Screen schema validation failed';
    if (second || ctx.deadline - Date.now() < 4000) return unavailable();
    result = await invoke({ ...request, repair: { raw: result.raw ?? result.data, errors: ['Expected only flags array, at most 3 items'] } }, ctx);
    if (!result.call.ok && result.failure !== 'schema_error') return unavailable();
    validation = validateScreen(result.data);
  }
  if (!validation) { result.call.ok = false; result.call.error = 'Screen schema validation failed after repair'; return unavailable(); }
  const discarded: string[] = [];
  const log = (event: string, detail: Record<string, unknown>) => { discarded.push(event); ctx.log?.(event, detail); };
  for (const index of validation.invalid) log('screen_invalid_item', { index });
  const hits: RedFlagHit[] = [];
  for (const flag of validation.flags) {
    if (flag.certainty === 'low') { log('screen_low_certainty', { category: flag.category }); continue; }
    const id = aliases(session).find(t => t.alias === flag.turn)?.id || flag.turn;
    const verified = verifyDetailed(flag.quote, session.turns, id);
    if (!verified) { log('screen_unverified', { category: flag.category, quoteLength: flag.quote.length }); continue; }
    if (verified.correctedTurn) ctx.log?.('screen_corrected_turn', { category: flag.category, from: flag.turn, to: verified.evidence.turnId });
    const rule = rules.rules.find(r => r.id === CATEGORY_RULE[flag.category])!;
    if (!hits.some(h => h.ruleId === `MODEL-${flag.category}`)) hits.push({ ruleId: `MODEL-${flag.category}`, source: 'model', severity: rule.severity as RedFlagHit['severity'], label: rule.label, action: rule.action, patientMessage: rule.patientMessage, evidence: [verified.evidence], ...(second ? { models: [second.model] } : {}) });
  }
  // A valid screen with discarded suggestions is available; record reasons without raw quotes.
  if (discarded.length) result.call.error = [...new Set(discarded)].join(', ');
  ctx.log?.('screen_completed', { ruleIds: hits.map(h => h.ruleId), modelCalls: ctx.modelCalls.filter(c => c.step === 'red_flags') });
  return hits;
}
