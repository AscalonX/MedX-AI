"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { IntakeSession } from "@medx/shared";
import { ClinicianFrame, useFrame } from "../_frame";
import { fetchQueue, sortQueue, unreviewed } from "./_lib";

interface Q { sorted: IntakeSession[] | null; error: string | null; refreshQueue: () => void; fresh: Set<string>; markOpened: (id: string) => void }
const QC = createContext<Q | null>(null);

/** Clinician state (language, reviewer, clock) plus the polled queue. */
export const useClinician = () => {
  const f = useFrame();
  const q = useContext(QC);
  if (!q) throw new Error("useClinician outside Shell");
  return { ...f, ...q };
};

export function Shell({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<IntakeSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sorted = useMemo(() => (queue ? sortQueue(queue) : null), [queue]);
  // Emergency badge fires on the TRANSITION into escalated (new case, or an existing case that just escalated).
  const prevStatus = useRef<Map<string, string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const markOpened = useCallback((id: string) => setFresh((f) => { if (!f.has(id)) return f; const n = new Set(f); n.delete(id); return n; }), []);
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
      })
      .catch((e: Error) => { if (mine === reqId.current) setError(e.message); })
      .finally(() => { if (mine === reqId.current) inflight.current = false; });
  }, []);
  useEffect(() => {
    const unacked = sorted?.filter((s) => fresh.has(s.id) && (s.summary?.redFlags ?? []).some((h) => !h.review)).length ?? 0;
    document.title = unacked ? `(${unacked}) New emergency · MedX` : "Clinician review | MedX";
  });
  useEffect(() => {
    refreshQueue();
    const t = setInterval(refreshQueue, 5000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { clearInterval(t); reqId.current++; inflight.current = false; }; // a remounted effect can load immediately
  }, [refreshQueue]);
  const urgent = sorted?.filter((s) => s.status === "escalated" && unreviewed(s.summary?.redFlags ?? []).length > 0).length;

  return (
    <QC.Provider value={{ sorted, error, refreshQueue, fresh, markOpened }}>
      <ClinicianFrame active="review" urgent={urgent}>{children}</ClinicianFrame>
    </QC.Provider>
  );
}
