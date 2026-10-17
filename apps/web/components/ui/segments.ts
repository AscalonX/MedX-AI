import type { Evidence } from "@medx/shared";

export type Mark = Pick<Evidence, "start" | "end" | "quote"> & { active: boolean };
export type Segment = { text: string; mark?: { active: boolean; order: number } };

/**
 * Split turn text into plain and marked runs.
 * Safety: a mark whose offsets do not reproduce its quote exactly is dropped, never guessed.
 * Overlapping marks merge (active if either is). `order` counts active marks left to right for the sweep stagger.
 */
export function segments(text: string, marks: Mark[]): Segment[] {
  const valid = marks
    .filter((m) => m.start >= 0 && m.end <= text.length && m.start < m.end && text.slice(m.start, m.end) === m.quote)
    .sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number; active: boolean }[] = [];
  for (const m of valid) {
    const last = merged[merged.length - 1];
    if (last && m.start < last.end) {
      last.end = Math.max(last.end, m.end);
      last.active ||= m.active;
    } else merged.push({ start: m.start, end: m.end, active: m.active });
  }
  const out: Segment[] = [];
  let at = 0;
  let order = 0;
  for (const m of merged) {
    if (m.start > at) out.push({ text: text.slice(at, m.start) });
    out.push({ text: text.slice(m.start, m.end), mark: { active: m.active, order: m.active ? order++ : -1 } });
    at = m.end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}
