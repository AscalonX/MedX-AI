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
  // Latin names stop at sentence delimiters and lower-case clinical prose.
  replace('NAME', /(?:[Mm][Yy]\s+[Nn][Aa][Mm][Ee]\s+[Ii][Ss]|I['’][Mm]\s+[Cc][Aa][Ll][Ll][Ee][Dd]|[Mm][Ii]\s+[Cc][Hh][Ii][Aa][Mm][Oo])\s+[\p{L}][\p{L}'’-]*(?:\s+[\p{Lu}][\p{L}'’-]*){0,3}/gu);
  replace('NAME', /\bsono\s+[\p{Lu}][\p{L}'’-]*(?:\s+[\p{Lu}][\p{L}'’-]*){0,3}/gu);
  replace('NAME', /(?:ดิฉันชื่อ|ฉันชื่อ|ผมชื่อ|ชื่อ)\s*[\p{Script=Thai}]+(?:\s+[\p{Script=Thai}]+)?/gu);
  return { text, replaced: [...counts].map(([type, count]) => ({ type, count })) };
}
