"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SessionListItem } from "@medx/shared";
import { onCaseChanged } from "../../_shared/caseEvents";
import { useVisiblePolling } from "../../_shared/visiblePolling";
import { ClinicianFrame, useFrame } from "../_frame";
import { fetchQueue, sortQueue, unreviewed } from "./_lib";

interface Q {
  sorted: SessionListItem[] | null;
  error: string | null;
  refreshQueue: () => void;
  /** Cases that just escalated (red slide-in until opened). */
  fresh: Set<string>;
  /** Non-escalated cases that just arrived (one ocean ring and a "New" chip, for a few seconds). */
  arrived: Set<string>;
  markOpened: (id: string) => void;
}
const QC = createContext<Q | null>(null);

/** Clinician state (language, reviewer, clock) plus the polled queue. */
export const useClinician = () => {
  const f = useFrame();
  const q = useContext(QC);
  if (!q) throw new Error("useClinician outside Shell");
  return { ...f, ...q };
};

const ARRIVED_MS = 6000;

export function Shell({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<SessionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sorted = useMemo(() => (queue ? sortQueue(queue) : null), [queue]);
  // Emergency badge fires on the TRANSITION into escalated (new case, or an existing case that just escalated).
  const prevStatus = useRef<Map<string, string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [arrived, setArrived] = useState<Set<string>>(new Set());
  const timers = useRef<number[]>([]);
  const markOpened = useCallback((id: string) => {
    setFresh((f) => { if (!f.has(id)) return f; const n = new Set(f); n.delete(id); return n; });
    setArrived((a) => { if (!a.has(id)) return a; const n = new Set(a); n.delete(id); return n; });
  }, []);
  const reqId = useRef(0);
  const inflight = useRef(false);
  const refreshQueue = useCallback(() => {
    if (inflight.current) return; // single flight: a slow request is never overtaken by a second one
    inflight.current = true;
    const mine = ++reqId.current;
    fetchQueue()
      .then((q) => {
        if (mine !== reqId.current) return; // older than the latest issued request, or unmounted
        setQueue(q);
        setError(null);
        const prev = prevStatus.current;
        prevStatus.current = new Map(q.map((s) => [s.id, s.status]));
        if (!prev) return;
        const esc = q.filter((s) => s.status === "escalated" && prev.get(s.id) !== "escalated").map((s) => s.id);
        if (esc.length) setFresh((f) => new Set([...f, ...esc]));
        // A new non-escalated case gets the soft arrival highlight once (C-04); escalations keep the red slide-in.
        const news = q.filter((s) => !prev.has(s.id) && s.status !== "escalated").map((s) => s.id);
        if (news.length) {
          setArrived((a) => new Set([...a, ...news]));
          timers.current.push(window.setTimeout(() => setArrived((a) => { const n = new Set(a); news.forEach((id) => n.delete(id)); return n; }), ARRIVED_MS));
        }
      })
      .catch((e: Error) => { if (mine === reqId.current) setError(e.message); })
      .finally(() => { if (mine === reqId.current) inflight.current = false; });
  }, []);
  useEffect(() => {
    const unacked = sorted?.filter((s) => fresh.has(s.id) && (s.summary?.redFlags ?? []).some((h) => !h.review)).length ?? 0;
    document.title = unacked ? `(${unacked}) New emergency · MedX` : "Clinician review | MedX";
  });
  // Every 5 s while the tab is visible; nothing while it is hidden; at once when it comes back (C-03).
  useVisiblePolling(refreshQueue, 5000);
  useEffect(() => onCaseChanged(() => refreshQueue()), [refreshQueue]);
  useEffect(() => {
    const t = timers.current;
    // Unmount (or a Strict Mode remount) drops in-flight results and frees the single-flight slot, so a remounted
    // effect can load at once: the request's own finally() no longer clears it once the counter has moved on.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the counter itself is bumped on purpose: results of in-flight requests are dropped
    return () => { reqId.current++; inflight.current = false; t.forEach((h) => window.clearTimeout(h)); };
  }, []);
  const urgent = sorted?.filter((s) => s.status === "escalated" && unreviewed(s.summary?.redFlags ?? []).length > 0).length;

  return (
    <QC.Provider value={{ sorted, error, refreshQueue, fresh, arrived, markOpened }}>
      <ClinicianFrame active="review" urgent={urgent} rows={sorted}>{children}</ClinicianFrame>
    </QC.Provider>
  );
}
