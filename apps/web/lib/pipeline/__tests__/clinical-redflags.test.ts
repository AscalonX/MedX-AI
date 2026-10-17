import { describe, expect, it } from 'vitest';
import rules from '@medx/shared/src/redflags.json';
import { checkRedFlags } from '../redflags';
import type { RedFlagRuleFile } from '@medx/shared';
import { readText } from './fixtures/text';

// Keep the exact row selector used by docs/clinical/check-redflags.mjs.
// readText strips a BOM and CRLF so the `$`-anchored selector matches on Windows checkouts too.
const markdown = readText(new URL('../../../../../docs/clinical/REDFLAG-TESTS.md', import.meta.url));
const rows = markdown.split('\n').flatMap(line => {
  const m = line.match(/^\| (RF-[A-Z0-9-]+) \| (en|it|th) \| (fire|no) \| (.+) \|$/);
  return m ? [{ id: m[1], lang: m[2], expected: m[3], text: m[4] }] : [];
});

describe(`clinical red-flag table (${rows.length} rows)`, () => {
  it('loads every rule and every clinical case row', () => {
    expect(rules.rules).toHaveLength(18);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows).toHaveLength(markdown.split('\n').filter(line => /^\| RF-/.test(line)).length);
    expect(new Set(rows.map(r => r.id))).toEqual(new Set(rules.rules.map(r => r.id)));
  });
  it.each(rows)('$id $lang $expected: $text', ({ id, expected, text }) => {
    const hits = checkRedFlags(text);
    expect(hits.some(hit => hit.ruleId === id)).toBe(expected === 'fire');
    for (const hit of hits) for (const e of hit.evidence) expect(text.slice(e.start, e.end)).toBe(e.quote);
  });
  it('maps decomposed Unicode, curly apostrophes and collapsed spaces to the original turn', () => {
    const text = '  Non so perche\u0301, I can’t   lift my left arm  ';
    const hit = checkRedFlags(text).find(h => h.ruleId === 'RF-STROKE-03');
    expect(hit).toBeDefined();
    expect(hit!.evidence.some(e => e.quote.includes('can’t   lift'))).toBe(true);
    for (const e of hit!.evidence) expect(text.slice(e.start, e.end)).toBe(e.quote);
  });
  it.each([
    ['  perche\u0301  ', 'perché', 'perche\u0301'],
    ['  ΟΣ  ', 'ος', 'ΟΣ'],
    ['\t\tCHEST  \n PAIN  ', 'chest pain', 'CHEST  \n PAIN'],
  ])('keeps exact evidence for Unicode normalization in %s', (text, term, quote) => {
    const file = { ...rules, rules: [{ ...rules.rules[0], match: [[term]] }] } as RedFlagRuleFile;
    const hits = checkRedFlags(text, undefined, file);
    expect(hits).toHaveLength(1); expect(hits[0].evidence[0].quote).toBe(quote);
    const e = hits[0].evidence[0]; expect(text.slice(e.start, e.end)).toBe(quote);
  });
});
