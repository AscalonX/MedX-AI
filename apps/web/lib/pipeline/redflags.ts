import rules from '@medx/shared/src/redflags.json';
import type { ExtractedField, RedFlagHit, RedFlagRuleFile, Turn } from '@medx/shared';
import { isPresent } from './config';

// Segmenters are stateless between segment() calls; building one per call dominated turn latency.
const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });
function normalise(text: string, compactThai = false) {
  // Same text as the clinical reference's norm(), with UTF-16 source offsets.
  let t = ' '; const map: number[] = [0]; const ends: number[] = [0]; let offset = 0;
  const lower = text.normalize('NFKC').toLowerCase(); let normalisedOffset = 0;
  for (const segment of graphemes.segment(text)) {
    const cp = segment.segment;
    const length = cp.normalize('NFKC').toLowerCase().length;
    // Lower-case the whole text first, including context-sensitive Unicode casing.
    for (const c of lower.slice(normalisedOffset, normalisedOffset + length).replace(/[’‘]/g, "'").replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[\p{Dash_Punctuation}\u2212]/gu, ' ')) {
      if (/\s/u.test(c)) {
        if (t.endsWith(' ')) { ends[ends.length - 1] = offset + cp.length; continue; }
        t += ' '; map.push(offset); ends.push(offset + cp.length);
      }
      else { t += c; for (let i = 0; i < c.length; i++) { map.push(offset); ends.push(offset + cp.length); } }
    }
    normalisedOffset += length;
    offset += cp.length;
  }
  if (t.length > 1 && t.endsWith(' ')) { t = t.slice(0, -1); map.pop(); ends.pop(); }
  if (compactThai) {
    // Thai and normalized punctuation are BMP; iterate UTF-16 indices so
    // supplementary characters before a match do not shift evidence offsets.
    const removed = new Set([...t.matchAll(/(?<=\p{Script=Thai}) (?=\p{Script=Thai})/gu)].map(m => m.index!));
    const indices = Array.from({ length: t.length }, (_, i) => i).filter(i => !removed.has(i));
    return { t: indices.map(i => t[i]).join(''), map: indices.map(i => map[i]), ends: indices.map(i => ends[i]) };
  }
  return { t, map, ends };
}
// Rule terms come only from rule files, never patient text, and a needle is a pure function of
// (term, compactThai), so memoising it cannot change a match. Bounded in case of many custom rule files.
const needles = new Map<string, string>();
function needleFor(term: string, compactThai: boolean) {
  const key = `${compactThai ? 'T' : 'F'}${term}`;
  let needle = needles.get(key);
  if (needle === undefined) {
    if (needles.size >= 20000) needles.clear();
    needle = normalise(term, compactThai).t.slice(1); needles.set(key, needle);
  }
  return needle;
}
export function clause(before: string) {
  let cut = 0;
  for (const p of [',', '.', ';', ':', '!', '?', '\n']) cut = Math.max(cut, before.lastIndexOf(p) + 1);
  for (const word of [' but ', ' ma ', ' però ', ' pero ', 'แต่']) {
    const i = before.toLowerCase().lastIndexOf(word);
    if (i !== -1) cut = Math.max(cut, i + word.length - (word.endsWith(' ') ? 1 : 0));
  }
  return before.slice(cut);
}
/** Shared clinical window and clause boundaries for pharmacy mention actions. */
export function negatedBefore(before: string, extraCues: string[] = []) {
  const text = normalise(before, true).t + (/\s$/u.test(before) ? ' ' : '');
  const preceding = clause(text.slice(-rules.negationWindowChars));
  return [...rules.negationCues, ...extraCues].some(cue => preceding.includes(cue));
}
export function checkRedFlags(input: string | Turn[], fields?: ExtractedField[], ruleFile: RedFlagRuleFile = rules as RedFlagRuleFile): RedFlagHit[] {
  const turns = typeof input === 'string' ? [{ id: 'T1', text: input, role: 'patient' as const, lang: 'en' as const, at: '' }] : input.filter(t => t.role === 'patient');
  // Concatenation permits an AND group to be satisfied in a later patient turn.
  const segments: { turn: Turn; base: number }[] = []; let joined = '';
  for (const turn of turns) { if (joined) joined += '.\n'; segments.push({ turn, base: joined.length }); joined += turn.text; }
  const domains = [{ text: joined, segments }, ...turns.map(turn => ({ text: turn.text, segments: [{ turn, base: 0 }] }))].flatMap(d => [false, true].map(compactThai => ({ ...d, compactThai, n: normalise(d.text, compactThai) })));
  return ruleFile.rules.flatMap(rule => {
    if (fields && rule.requires && !Object.entries(rule.requires).every(([key, value]) => fields.some(f => f.key === key && isPresent(f) && Object.values(f.value || {}).some(v => v.normalize('NFC').toLowerCase() === value?.normalize('NFC').toLowerCase())))) return [];
    if (!rule.match.length || rule.match.some(g => !g.length)) return [];
    for (const domain of domains) {
      const n = domain.n; const evidence = []; let all = true;
      for (const group of rule.match) {
      let found: { start: number; end: number } | undefined;
      for (const term of group) {
        const needle = needleFor(term, domain.compactThai); if (!needle) continue;
        let from = 0;
        while (from <= n.t.length) {
          const at = n.t.indexOf(needle, from); if (at < 0) break;
          const fromChar = Math.max(0, at - ruleFile.negationWindowChars);
          const preceding = clause(n.t.slice(fromChar, at));
          // Leading/trailing cue spaces are intentional word boundaries in the rule file.
          const negated = ruleFile.negationCues.some(cue => preceding.includes(cue));
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
