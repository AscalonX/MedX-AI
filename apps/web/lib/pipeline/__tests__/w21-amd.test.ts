import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModelCall } from '@medx/shared';
import { createSession } from '../pipeline';
import { extract } from '../extract';
import { mockJSON } from '../mock';
import { providerInfo } from '../config';
import type { ChatRequest, ChatResult, ModelClient } from '../llm';

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

const session = () => {
  const s = createSession('en', { persist: false } as never);
  s.turns.push({ id: 't1', role: 'patient', lang: 'en', text: 'I have had a sore throat for two days.', at: new Date().toISOString() } as never);
  return s;
};
const call = (req: ChatRequest, ok: boolean, error?: string): ModelCall => ({ step: req.step, provider: 'amd-tokenfactory', model: req.model || process.env.AMD_MODEL || 'unconfigured', latencyMs: 1, ok, ...(error ? { error } : {}) });

describe('w21: AMD extraction model and shared-key 429s', () => {
  it('routes the extraction to AMD_EXTRACT_MODEL and retries 429s on the same model inside the deadline', async () => {
    vi.stubEnv('MODEL_PROVIDER', 'amd'); vi.stubEnv('AMD_MODEL', 'Gemma-4-31B-IT'); vi.stubEnv('AMD_EXTRACT_MODEL', 'DeepSeek-V4-Flash');
    const seen: string[] = [];
    let n = 0;
    const client: ModelClient = async req => {
      seen.push(req.model || 'default');
      n++;
      if (n <= 2) return { data: null, call: call(req, false, 'HTTP 429'), failure: 'provider_error', retryAfterMs: 5 } satisfies ChatResult;
      return { data: mockJSON(req), call: call(req, true) };
    };
    const modelCalls: ModelCall[] = [];
    const out = await extract(session(), { client, deadline: Date.now() + 30000, modelCalls, log: () => undefined } as never);
    expect(seen).toEqual(['DeepSeek-V4-Flash', 'DeepSeek-V4-Flash', 'DeepSeek-V4-Flash']);
    expect((out as { reason?: string }).reason).toBeUndefined();
    expect(modelCalls.filter(c => c.ok).map(c => c.model)).toEqual(['DeepSeek-V4-Flash']);
  });

  it('a non-429 failure gets one retry only, and none when little time is left', async () => {
    vi.stubEnv('MODEL_PROVIDER', 'amd'); vi.stubEnv('AMD_MODEL', 'Gemma-4-31B-IT');
    let calls = 0;
    const fail: ModelClient = async req => { calls++; return { data: null, call: call(req, false, 'Provider timeout or turn deadline'), failure: 'provider_error' }; };
    const a = await extract(session(), { client: fail, deadline: Date.now() + 30000, modelCalls: [], log: () => undefined } as never);
    expect(calls).toBe(2); expect((a as { reason?: string }).reason).toBe('provider_error');
    calls = 0;
    const b = await extract(session(), { client: fail, deadline: Date.now() + 5000, modelCalls: [], log: () => undefined } as never);
    expect(calls).toBe(1); expect((b as { reason?: string }).reason).toBe('provider_error');
  });

  it('health exposes the extraction model only when it is configured and the provider is AMD', () => {
    vi.stubEnv('MODEL_PROVIDER', 'amd'); vi.stubEnv('AMD_MODEL', 'Gemma-4-31B-IT');
    expect(providerInfo()).not.toHaveProperty('extractModel');
    vi.stubEnv('AMD_EXTRACT_MODEL', 'DeepSeek-V4-Flash');
    expect(providerInfo()).toMatchObject({ model: 'Gemma-4-31B-IT', extractModel: 'DeepSeek-V4-Flash' });
    vi.stubEnv('MODEL_PROVIDER', 'mock');
    expect(providerInfo()).not.toHaveProperty('extractModel');
  });
});
