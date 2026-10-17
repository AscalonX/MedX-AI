/** Redaction is the only entry point for patient text. Never retains the original. */
export function redact(input: string): { text: string; replaced: { type: string; count: number }[] } {
  let text = input.normalize('NFC');
  const counts = new Map<string, number>();
  const replace = (type: string, re: RegExp) => {
    text = text.replace(re, () => `[${type}_${counts.set(type, (counts.get(type) || 0) + 1).get(type)}]`);
  };
  replace('EMAIL', /[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu);
  replace('ID', /(?<!\d)(?:\d{13}|\d-\d{4}-\d{5}-\d{2}-\d)(?!\d)/g);
  replace('ID', /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/gi);
  replace('DOB', /(?:date\s+of\s+birth|dob|born\s+on|data\s+di\s+nascita|nat[oa]\s+il|วันเกิด|เกิดวันที่|เกิดเมื่อ)\s*[:：]?\s*(?:\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4}|\d{1,2}\s+[\p{L}.]+\s+\d{2,4})/giu);
  replace('PHONE', /(?<![\d_])(?:\+\d{1,3}[\s().-]*(?:\d[\s().-]*){7,12}\d|0\d{1,2}[\s.-]*\d{3}[\s.-]*\d{4}|3\d{2}[\s.-]*\d{3}[\s.-]*\d{4})(?!\d)/gu);
  replace('PHONE', /\b(?:phone|telephone|telefono)\s*[:：]?\s*\d{3}[ .-]\d{4}\b/giu);
  replace('ID', /\b(?:passport|passaporto)\s*[:：]?\s*(?=[A-Z0-9]*\d)[A-Z0-9]{6,12}\b/giu);
  // Match triggers without case sensitivity, then names WITH case sensitivity.
  // In particular, the verb "sono" and "I'm" must not eat clinical prose.
  const capitalised = String.raw`(?=\p{Script=Latin})\p{Lu}[\p{Script=Latin}\p{M}'’-]*`;
  const latinName = new RegExp(`^${capitalised}(?:\\s+${capitalised}){0,2}`, 'u');
  const explicitName = new RegExp(String.raw`^(?=\p{Script=Latin})[\p{L}][\p{Script=Latin}\p{M}'’-]*(?:\s+${capitalised}){0,2}`, 'u');
  const triggers = /\b(?:my\s+name\s+is|i['’]m\s+called|i\s+am\s+called|mi\s+chiamo|sono|i['’]m)\s+/giu;
  const spans = [...text.matchAll(triggers)].flatMap(m => {
    const end = m.index! + m[0].length;
    const name = (/^(?:sono|i['’]m)\s+$/iu.test(m[0]) ? latinName : explicitName).exec(text.slice(end));
    return name ? [{ start: m.index!, end: end + name[0].length }] : [];
  });
  for (const span of spans.reverse()) {
    const n = counts.set('NAME', (counts.get('NAME') || 0) + 1).get('NAME');
    text = text.slice(0, span.start) + `[NAME_${n}]` + text.slice(span.end);
  }
  replace('NAME', /(?:ดิฉันชื่อ|ฉันชื่อ|ผมชื่อ|ชื่อ)\s*[\p{Script=Thai}]+(?:\s+[\p{Script=Thai}]+)?/giu);
  return { text, replaced: [...counts].map(([type, count]) => ({ type, count })) };
}
