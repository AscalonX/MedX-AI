/** In-page signal that a case was written (review, vitals, triage, orders), so other views refresh at once instead of on their next poll. */
export const CASE_CHANGED = "medx:case-changed";

export function notifyCaseChanged(id: string) {
  try { window.dispatchEvent(new CustomEvent(CASE_CHANGED, { detail: { id } })); } catch { /* no window (tests, SSR) */ }
}

export function onCaseChanged(cb: (id: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const h = (e: Event) => { const id = (e as CustomEvent<{ id?: unknown }>).detail?.id; if (typeof id === "string") cb(id); };
  window.addEventListener(CASE_CHANGED, h);
  return () => window.removeEventListener(CASE_CHANGED, h);
}
