import type { TraceEdge, TraceNode } from "@medx/shared";

export const NODE_W = 160;
export const NODE_H = 72;
const GAP_X = 36;
const GAP_Y = 18;
const PAD = 16;

export interface Placed { node: TraceNode; x: number; y: number; layer: number; row: number }
export interface Curve { from: string; to: string; label?: string; d: string; lx: number; ly: number }
export interface Layout { placed: Placed[]; curves: Curve[]; width: number; height: number }

/** Simple layered left-to-right layout: layer = longest path from a root. Unknown edge ends and cycles are ignored. */
export function layoutTrace(nodes: TraceNode[], edges: TraceEdge[]): Layout {
  const ids = new Set(nodes.map((n) => n.id));
  const es = edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
  const layer = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  // Bellman-Ford style relaxation, bounded by node count so a cycle cannot loop forever.
  for (let i = 0; i < nodes.length; i++) {
    let changed = false;
    for (const e of es) {
      const next = (layer.get(e.from) ?? 0) + 1;
      if (next > (layer.get(e.to) ?? 0) && next < nodes.length) { layer.set(e.to, next); changed = true; }
    }
    if (!changed) break;
  }
  const byLayer = new Map<number, TraceNode[]>();
  for (const n of [...nodes].sort((a, b) => a.at.localeCompare(b.at))) {
    const l = layer.get(n.id) ?? 0;
    byLayer.set(l, [...(byLayer.get(l) ?? []), n]);
  }
  const maxRows = Math.max(1, ...[...byLayer.values()].map((v) => v.length));
  const height = PAD * 2 + maxRows * NODE_H + (maxRows - 1) * GAP_Y;
  const placed: Placed[] = [];
  for (const [l, list] of [...byLayer.entries()].sort((a, b) => a[0] - b[0])) {
    const colH = list.length * NODE_H + (list.length - 1) * GAP_Y;
    list.forEach((node, row) => placed.push({ node, layer: l, row, x: PAD + l * (NODE_W + GAP_X), y: PAD + (height - PAD * 2 - colH) / 2 + row * (NODE_H + GAP_Y) }));
  }
  const at = new Map(placed.map((p) => [p.node.id, p]));
  const out = new Map<string, number>();
  for (const e of es) out.set(e.from, (out.get(e.from) ?? 0) + 1);
  const curves = es.map((e) => {
    const a = at.get(e.from)!, b = at.get(e.to)!;
    const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2;
    const dx = Math.max(24, Math.abs(x2 - x1) / 2);
    return { from: e.from, to: e.to, label: (out.get(e.from) ?? 0) === 1 ? e.label : undefined, d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, lx: (x1 + x2) / 2, ly: (y1 + y2) / 2 - 4 };
  });
  const maxLayer = Math.max(0, ...placed.map((p) => p.layer));
  return { placed, curves, width: PAD * 2 + (maxLayer + 1) * NODE_W + maxLayer * GAP_X, height };
}

/** Summary counts for the strip. Steps are numbered in time order (1-based). */
export function summarize(nodes: TraceNode[]) {
  const ordered = [...nodes].sort((a, b) => a.at.localeCompare(b.at));
  const esc = ordered.findIndex((n) => n.status === "escalated");
  return {
    steps: nodes.length,
    rules: nodes.filter((n) => n.actor === "rule" && n.status !== "skipped").length,
    models: nodes.filter((n) => n.actor === "model" && n.status !== "skipped").length,
    skipped: nodes.filter((n) => n.status === "skipped").length,
    humans: nodes.filter((n) => n.actor === "human").length,
    escalatedAt: esc < 0 ? null : esc + 1,
    stepOf: (id: string) => ordered.findIndex((n) => n.id === id) + 1,
  };
}
