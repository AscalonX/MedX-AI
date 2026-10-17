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
function boundaryCheck(text: string, lang: Lang) {
  const segments = words(text, lang);
  // ICU splits these Thai drug transliterations into apparent words (including ไอ).
  // Treat the complete medication name as one segment so it cannot evidence cough.
  const compounds = [...text.matchAll(/ไอบู(?:โพร|โปร)เฟน/gu)].map(m => [m.index, m.index + m[0].length]);
  return (start: number, end: number) => !segments.some(s =>
    (s.index < start && start < s.index + s.segment.length) ||
    (s.index < end && end < s.index + s.segment.length)) &&
    !compounds.some(([a, b]) => (a < start && start < b) || (a < end && end < b));
}
export interface Verified { evidence: Evidence; matchFactor: number; correctedTurn: boolean }
export function verifyDetailed(quote: string, turns: Turn[], turnId?: string, allowNumericAnswer = false): Verified | null {
  const q = norm(quote).t;
  const singleDigit = q.length === 1 && /^[0-9]$/.test(q) && allowNumericAnswer;
  if ((q.length < 2 && !singleDigit) || /^\s*(\[[A-Z]+_\d+\]\s*)+$/u.test(quote)) return null;
  const patients = turns.filter(t => t.role === 'patient');
  const ordered = [...patients.filter(t => t.id === turnId), ...patients.filter(t => t.id !== turnId)];
  for (const turn of ordered) {
    // A one-digit severity quote is valid only as an exact complete answer,
    // immediately after a question. It cannot match a digit within other prose.
    if (singleDigit && (turn.id !== turnId || turn.text.trim() !== quote.trim() || turns[turns.indexOf(turn) - 1]?.role !== 'assistant')) continue;
    const bounded = boundaryCheck(turn.text, turn.lang);
    const result = (start: number, end: number, matchFactor: number): Verified => ({ evidence: { turnId: turn.id, quote: turn.text.slice(start, end), start, end }, matchFactor, correctedTurn: !!turnId && turn.id !== turnId });
    // Check all occurrences: an embedded first occurrence must not hide a later word.
    for (let at = turn.text.indexOf(quote); at >= 0; at = turn.text.indexOf(quote, at + 1)) {
      if (bounded(at, at + quote.length)) return result(at, at + quote.length, 1);
    }
    if (singleDigit) continue;
    const n = norm(turn.text);
    for (let at = n.t.indexOf(q); at >= 0; at = n.t.indexOf(q, at + 1)) {
      const start = n.map[at]; const end = n.ends[at + q.length - 1];
      if (bounded(start, end)) return result(start, end, 0.95);
    }
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
        const last = tt[i + size - 1];
        const candidate: [number, number] = [tt[i].index, last.index + last.segment.length];
        if (overlap > best && bounded(n.map[candidate[0]], n.ends[candidate[1] - 1])) { best = overlap; span = candidate; }
      }
    }
    if (best >= 0.8 && span) return result(n.map[span[0]], n.ends[span[1] - 1], 0.8);
  }
  return null;
}
export function verifyEvidence(quote: string, turns: Turn[]): Evidence | null { return verifyDetailed(quote, turns)?.evidence || null; }
