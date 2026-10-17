import rules from '@medx/shared/src/redflags.json';
import type { ExtractedField, RedFlagHit, RedFlagRuleFile, Turn } from '@medx/shared';
import { isPresent } from './config';

function normalise(text: string) {
  let t = ''; const map: number[] = []; const ends: number[] = []; let offset = 0;
  for (const segment of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)) {
    const cp = segment.segment;
    for (const c of cp.normalize('NFC').toLowerCase()) {
      if (/\s/u.test(c)) { if (!t || t.endsWith(' ')) continue; t += ' '; map.push(offset); ends.push(offset + cp.length); }
      else { t += c; for (let i = 0; i < c.length; i++) { map.push(offset); ends.push(offset + cp.length); } }
    }
    offset += cp.length;
  }
  return { t, map, ends };
}
export function checkRedFlags(input: string | Turn[], fields?: ExtractedField[], ruleFile: RedFlagRuleFile = rules as RedFlagRuleFile): RedFlagHit[] {
  const turns = typeof input === 'string' ? [{ id: 'T1', text: input, role: 'patient' as const, lang: 'en' as const, at: '' }] : input.filter(t => t.role === 'patient');
  // Concatenation permits an AND group to be satisfied in a later patient turn.
  const segments: { turn: Turn; base: number }[] = []; let joined = '';
  for (const turn of turns) { if (joined) joined += '\n'; segments.push({ turn, base: joined.length }); joined += turn.text; }
  return ruleFile.rules.flatMap(rule => {
    if (fields && rule.requires && !Object.entries(rule.requires).every(([key, value]) => fields.some(f => f.key === key && isPresent(f) && Object.values(f.value || {}).some(v => v.normalize('NFC').toLowerCase() === value?.normalize('NFC').toLowerCase())))) return [];
    if (!rule.match.length || rule.match.some(g => !g.length)) return [];
    const domains = [{ text: joined, segments }, ...turns.map(turn => ({ text: turn.text, segments: [{ turn, base: 0 }] }))];
    for (const domain of domains) {
      const n = normalise(domain.text); const evidence = []; let all = true;
      for (const group of rule.match) {
      let found: { start: number; end: number } | undefined;
      for (const term of group) {
        const needle = normalise(term).t.trim(); if (!needle) continue;
        let from = 0;
        while (from <= n.t.length) {
          const at = n.t.indexOf(needle, from); if (at < 0) break;
          const fromChar = Math.max(0, at - ruleFile.negationWindowChars);
          const preceding = (fromChar === 0 ? ' ' : '') + n.t.slice(fromChar, at);
          // Leading/trailing cue spaces are intentional word boundaries in the rule file.
          const negated = ruleFile.negationCues.some(cue => { const c = cue.normalize('NFC').toLowerCase().replace(/\s+/gu, ' '); return c.trim() && preceding.includes(c); });
          if (!negated) { found = { start: n.map[at], end: n.ends[at + needle.length - 1] }; break; }
          from = at + 1;
        }
        if (found) break;
      }
      if (!found) { all = false; break; }
      // Spans across a turn boundary are split; offsets always refer to one original turn.
      for (const { turn, base } of domain.segments) {
        const start = Math.max(0, found.start - base); const end = Math.min(turn.text.length, found.end - base);
        if (end > start) evidence.push({ turnId: turn.id, quote: turn.text.slice(start, end), start, end });
      }
      }
      if (all) return [{ ruleId: rule.id, label: rule.label, severity: rule.severity, action: rule.action, patientMessage: rule.patientMessage, evidence }];
    }
    return [];
  });
}
