import type { Evidence } from "@medx/shared";

export type Mark = Pick<Evidence, "start" | "end" | "quote"> & { active: boolean };
export type Segment = { text: string; mark?: { active: boolean; order: number } };

/**
 * Split turn text into plain and marked runs.
 * Safety: a mark whose offsets do not reproduce its quote exactly is dropped, never guessed.
 * Overlaps are split at interval boundaries: a character is active only if an active mark covers it,
 * so a passive quote that contains the selected quote stays passive outside the selected range.
 * Adjacent pieces with the same state join. `order` counts active runs left to right for the sweep stagger.
 */
export function segments(text: string, marks: Mark[]): Segment[] {
  const valid = marks.filter(
    (m) => m.start >= 0 && m.end <= text.length && m.start < m.end && text.slice(m.start, m.end) === m.quote,
  );
  const cuts = [...new Set([0, text.length, ...valid.flatMap((m) => [m.start, m.end])])].sort((a, b) => a - b);

  // state per elementary interval: 0 plain, 1 passive mark, 2 active mark
  const runs: { start: number; end: number; state: 0 | 1 | 2 }[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [a, b] = [cuts[i]!, cuts[i + 1]!];
    const cover = valid.filter((m) => m.start <= a && m.end >= b);
    const state = cover.length === 0 ? 0 : cover.some((m) => m.active) ? 2 : 1;
    const last = runs[runs.length - 1];
    if (last && last.state === state) last.end = b;
    else runs.push({ start: a, end: b, state });
  }

  let order = 0;
  return runs.map((r) => {
    const t = text.slice(r.start, r.end);
    return r.state === 0 ? { text: t } : { text: t, mark: { active: r.state === 2, order: r.state === 2 ? order++ : -1 } };
  });
}
