/** Redaction is the only entry point for patient text. Never retains the original. */
export function redact(input: string) {
  let text = input.normalize('NFC');
  // Transient UTF-16 source map. Only text/counts are ever persisted.
  let positions = Array.from({ length: text.length }, (_, start) => ({ start, end: start + 1 }));
  const counts = new Map<string, number>();
  const replaceSpan = (start: number, end: number, type: string, number?: number) => {
    const token = `[${type}_${number ?? counts.set(type, (counts.get(type) || 0) + 1).get(type)}]`;
    const source = { start: positions[start].start, end: positions[end - 1].end };
    text = text.slice(0, start) + token + text.slice(end);
    positions = [...positions.slice(0, start), ...Array.from({ length: token.length }, () => source), ...positions.slice(end)];
  };
  const replace = (type: string, re: RegExp) => {
    const matches = [...text.matchAll(re)]; const base = counts.get(type) || 0;
    for (let i = matches.length - 1; i >= 0; i--) { const m = matches[i]; replaceSpan(m.index!, m.index! + m[0].length, type, base + i + 1); }
    if (matches.length) counts.set(type, base + matches.length);
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
  const explicitName = /^(?=\p{Script=Latin})[\p{L}][\p{Script=Latin}\p{M}'’-]*/u;
  const stop = /^(?:svenut[oa]|stanc[oa]|incinta|allergic[oa]?|malat[oa]|nato|nata|cadut[oa]|sudat[oa]|tired|sick|pregnant|allergic|having|have|ho|ha|e|and|with|con|da|since|chest|pain|headache|fever|dolore|febbre|tosse|molto|not|non|no)$/iu;
  const triggers = /\b(?:my\s+name\s+is|i['’]m\s+called|i\s+am\s+called|mi\s+chiamo|sono|i['’]m)\s+/giu;
  const spans = [...text.matchAll(triggers)].flatMap(m => {
    const end = m.index! + m[0].length;
    const implicit = /^(?:sono|i['’]m)\s+$/iu.test(m[0]);
    const name = (implicit ? latinName : explicitName).exec(text.slice(end));
    if (!name) return [];
    let length = 0;
    for (const token of name[0].matchAll(/\S+/gu)) { if (stop.test(token[0])) break; length = token.index! + token[0].length; }
    if (!length) return [];
    if (!implicit) {
      const second = /^\s+([\p{Script=Latin}][\p{Script=Latin}\p{M}'’-]*)/u.exec(text.slice(end + length));
      if (second && !stop.test(second[1])) length += second[0].length;
    }
    return [{ start: m.index!, end: end + length }];
  });
  for (const span of spans.reverse()) {
    replaceSpan(span.start, span.end, 'NAME');
  }
  replace('NAME', /(?:ดิฉันชื่อ|ฉันชื่อ|ผมชื่อ|สวัสดี(?:ค่ะ|ครับ)\s+ชื่อ)\s*(?:(?!(?:เจ็บ|ปวด|หายใจ|เหงื่อ|แพ้|ไข้|ไอ|แน่น|เวียน|หมดสติ|ไม่|กินยา|ตั้งครรภ์))[\p{Script=Thai}]){1,20}/gu);
  return { text, positions, replaced: [...counts].map(([type, count]) => ({ type, count })) };
}
