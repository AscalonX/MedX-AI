/**
 * Find a case by its patient code (C-04), shared by the clinician and pharmacy queues.
 * "B-012", "b012", "012" and "12" all find B-012 and only B-012: a numeric query matches the code's number exactly,
 * so "12" never also lists B-112 or B-120. Any other text matches as a substring of the code. Empty matches all.
 */
export function matchesCode(code: string, query: string): boolean {
  const q = query.normalize("NFKC").trim().toUpperCase().replace(/\s+/g, "");
  if (!q) return true;
  const digits = q.replace(/^B-?/, "");
  if (/^\d+$/.test(digits)) {
    const n = code.match(/(\d+)\s*$/)?.[1];
    return n !== undefined && Number(n) === Number(digits);
  }
  return code.toUpperCase().includes(q);
}
