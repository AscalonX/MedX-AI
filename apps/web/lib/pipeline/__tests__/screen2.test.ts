import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createSession, runTurn } from '../pipeline';
import { mockJSON } from '../mock';
import { deriveTrace } from '../trace';
import type { ScreenedHit } from '../redFlagScreen';
import type { ChatRequest, ModelClient } from '../llm';
const M2 = 'DeepSeek-V4.1-Flash';
const TEXT = 'I have a headache. It feels like an elephant sitting on my chest.';
const log: string[] = [];
const call = (r: ChatRequest, ok = true) => ({ step: r.step, provider: 'mock' as const, model: r.model || 'primary', latencyMs: 1, ok, ...(ok ? {} : { error: 'Synthetic failure' }) });
/** Primary calls use the normal mock; second-screen calls (req.model set) go to `fn`. */
const base = (fn?: (r: ChatRequest) => Promise<unknown> | unknown): ModelClient => async r => {
  log.push(`${r.step}:${r.model || 'primary'}`);
  if (r.model && fn) { try { const data = await fn(r); return { data, call: call(r) }; } catch { return { data: null, call: call(r, false), failure: 'provider_error' }; } }
  return { data: mockJSON(r), call: call(r) };
};
let dir = '';
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'medx-s2-')); vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock'); log.length = 0; });
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });
describe('second red-flag screen', () => {
  it('env unset: no second call, identical steps', async () => {
    const s = await runTurn(createSession('en', { persist: false }), TEXT, { client: base() });
    expect(s.status).not.toBe('escalated');
    expect(s.summary!.modelCalls.map(c => c.step)).toEqual(['extract', 'red_flags', 'next_question']);
    expect(log.some(l => l.endsWith(`:${M2}`))).toBe(false);
  });
  it('union adds a verified hit with attribution; calls both screens', async () => {
    vi.stubEnv('AMD_MODEL_SCREEN2', M2);
    const s = await runTurn(createSession('en', { persist: false }), TEXT, { client: base(mockJSON) });
    expect(s.status).toBe('escalated');
    const hit = (s.summary!.redFlags as ScreenedHit[]).find(f => f.ruleId === 'MODEL-CHEST')!;
    expect(hit.source).toBe('model'); expect(hit.models).toEqual([M2]);
    expect(s.turns[0].text.slice(hit.evidence[0].start, hit.evidence[0].end)).toBe(hit.evidence[0].quote);
    expect(log).toContain(`red_flags:${M2}`); expect(log).toContain('red_flags:primary');
  });
  it('rules run first: rule hit makes zero model calls', async () => {
    vi.stubEnv('AMD_MODEL_SCREEN2', M2);
    const s = await runTurn(createSession('en', { persist: false }), 'I have chest pain and cannot breathe', { client: base(() => ({ flags: [] })) });
    expect(s.status).toBe('escalated'); expect(log).toEqual([]); expect(s.summary!.redFlags.some(f => f.source !== 'model')).toBe(true);
  });
  it('cannot remove: second screen returning no flags leaves the primary hit', async () => {
    vi.stubEnv('AMD_MODEL_SCREEN2', M2);
    const client: ModelClient = async r => r.step === 'red_flags' && !r.model ? { data: { flags: [{ category: 'BREATH', turn: 'T1', quote: 'cannot catch my breath', certainty: 'high' }] }, call: call(r) } : base(() => ({ flags: [] }))(r);
    const s = await runTurn(createSession('en', { persist: false }), 'I cannot catch my breath today.', { client });
    expect(s.summary!.redFlags.map(f => f.ruleId)).toContain('MODEL-BREATH');
  });
  it('same category from both screens merges attribution', async () => {
    vi.stubEnv('AMD_MODEL_SCREEN2', M2);
    const client: ModelClient = async r => r.step === 'red_flags' && !r.model ? { data: { flags: [{ category: 'CHEST', turn: 'T1', quote: 'elephant sitting on my chest', certainty: 'high' }] }, call: call(r) } : base(mockJSON)(r);
    const s = await runTurn(createSession('en', { persist: false }), TEXT, { client });
    const hits = (s.summary!.redFlags as ScreenedHit[]).filter(f => f.ruleId === 'MODEL-CHEST');
    expect(hits).toHaveLength(1); expect(hits[0].models).toEqual([M2]);
  });
  it('unverifiable quote from second screen is dropped', async () => {
    vi.stubEnv('AMD_MODEL_SCREEN2', M2);
    const s = await runTurn(createSession('en', { persist: false }), 'I have a headache.', { client: base(() => ({ flags: [{ category: 'CHEST', turn: 'T1', quote: 'crushing chest pain', certainty: 'high' }] })) });
    expect(s.status).not.toBe('escalated');
  });
  it.each([['error', () => { throw new Error('boom'); }], ['timeout', () => new Promise(() => {})]])('%s: skipped, failed call recorded, turn continues', async (_n, fn) => {
    vi.stubEnv('AMD_MODEL_SCREEN2', M2);
    const s = await runTurn(createSession('en', { persist: false }), 'I have a headache since yesterday. It is 4/10.', { client: base(fn as () => unknown) });
    expect(s.status).not.toBe('escalated'); expect(s.summary!.redFlags).toEqual([]);
    expect(s.summary!.modelCalls.filter(c => !c.ok).map(c => c.step)).toEqual(['red_flags']);
    expect(s.summary!.modelCalls.some(c => c.step === 'extract' && c.ok)).toBe(true);
    expect(s.summary!.abstained).toBe(false);
  }, 15000);
  it('trace tolerates the second call and names it', async () => {
    vi.stubEnv('LLM_TIMEOUT_MS', '2000');
    const { addTurn } = await import('../pipeline'); const { getAudit, getSession } = await import('../store');
    const id = createSession('en').id;
    await addTurn(id, 'I have a headache.');
    const audit = getAudit(id).map(e => e.type !== 'summary_generated' || !e.payload.modelCalls ? e : { ...e, payload: { ...e.payload, modelCalls: [{ step: 'red_flags', ok: true, latencyMs: 5, model: 'gemma' }, { step: 'red_flags', ok: false, latencyMs: 6000, model: M2 }] } });
    const node = deriveTrace(getSession(id)!, audit).nodes.find(n => n.kind === 'model_screen')!;
    expect(node.detail.en).toBe(`2 call(s), 1 failed; second screen: ${M2}`); expect(node.status).toBe('failed');
  });
});
