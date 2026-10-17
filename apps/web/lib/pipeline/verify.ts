import type { Evidence, Lang, Turn } from '@medx/shared';

/** UTF-16 offset map, including expansion (ligatures) and removed punctuation. */
export function norm(s: string): { t: string; map: number[]; ends: number[] } {
  const chars: { c: string; start: number; end: number }[] = [];
  let offset = 0;
  for (const cp of s) {
    for (let c of cp.normalize('NFKC').toLowerCase()) {
      if (/[\u200b-\u200d\u2060\ufeff\u00ad]/u.test(c)) continue;
      if (/\p{Script=Latin}/u.test(c)) c = c.normalize('NFD').replace(/\p{M}/gu, '');
      if (c === '‹') c = '<';
      if (/[\p{P}\p{S}\s]/u.test(c)) c = ' ';
      for (const part of c) chars.push({ c: part, start: offset, end: offset + cp.length });
    }
    offset += cp.length;
  }
  const collapsed = chars.filter((x, i) => x.c !== ' ' || (i > 0 && chars[i - 1].c !== ' '));
  while (collapsed[0]?.c === ' ') collapsed.shift();
  while (collapsed.at(-1)?.c === ' ') collapsed.pop();
  const kept = collapsed.filter((x, i) => !(x.c === ' ' && /\p{Script=Thai}/u.test(collapsed[i - 1]?.c || '') && /\p{Script=Thai}/u.test(collapsed[i + 1]?.c || '')));
  let t = ''; const map: number[] = []; const ends: number[] = [];
  for (const x of kept) { t += x.c; for (let i = 0; i < x.c.length; i++) { map.push(x.start); ends.push(x.end); } }
  return { t, map, ends };
}
export function words(s: string, lang: Lang = 'en') {
  return [...new Intl.Segmenter(lang, { granularity: 'word' }).segment(s)].filter(x => x.isWordLike);
}
export interface Verified { evidence: Evidence; matchFactor: number; correctedTurn: boolean }
export function verifyDetailed(quote: string, turns: Turn[], turnId?: string): Verified | null {
  const q = norm(quote).t;
  if (q.length < 2 || /^\s*(\[[A-Z]+_\d+\]\s*)+$/u.test(quote)) return null;
  const patients = turns.filter(t => t.role === 'patient');
  const ordered = [...patients.filter(t => t.id === turnId), ...patients.filter(t => t.id !== turnId)];
  for (const turn of ordered) {
    const result = (start: number, end: number, matchFactor: number): Verified => ({ evidence: { turnId: turn.id, quote: turn.text.slice(start, end), start, end }, matchFactor, correctedTurn: !!turnId && turn.id !== turnId });
    const exact = turn.text.indexOf(quote);
    if (exact >= 0) return result(exact, exact + quote.length, 1);
    const n = norm(turn.text); const at = n.t.indexOf(q);
    if (at >= 0) return result(n.map[at], n.ends[at + q.length - 1], 0.95);
    const qt = words(q, turn.lang).map(x => x.segment);
    if (qt.length < 3) continue;
    const tt = words(n.t, turn.lang); let best = 0; let span: [number, number] | undefined;
    for (let size = qt.length; size <= qt.length + 2; size++) {
      for (let i = 0; i + size <= tt.length; i++) {
        const counts = new Map<string, number>();
        for (const w of qt) counts.set(w, (counts.get(w) || 0) + 1);
        let matches = 0;
        for (const w of tt.slice(i, i + size)) { const count = counts.get(w.segment) || 0; if (count) { matches++; counts.set(w.segment, count - 1); } }
        const overlap = matches / qt.length;
        if (overlap > best) { best = overlap; const last = tt[i + size - 1]; span = [tt[i].index, last.index + last.segment.length]; }
      }
    }
    if (best >= 0.8 && span) return result(n.map[span[0]], n.ends[span[1] - 1], 0.8);
  }
  return null;
}
export function verifyEvidence(quote: string, turns: Turn[]): Evidence | null { return verifyDetailed(quote, turns)?.evidence || null; }
