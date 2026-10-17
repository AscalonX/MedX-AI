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
  // Escalated cases that appeared after the first load and are not opened yet: they slide in and badge the tab title.
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const markOpened = useCallback((id: string) => setFresh((f) => { if (!f.has(id)) return f; const n = new Set(f); n.delete(id); return n; }), []);
  const refreshQueue = useCallback(() => {
    fetchQueue()
      .then((q) => {
        setQueue(q);
        setError(null);
        if (!known.current) { known.current = new Set(q.map((s) => s.id)); return; }
        const added = q.filter((s) => !known.current!.has(s.id));
        added.forEach((s) => known.current!.add(s.id));
        const esc = added.filter((s) => s.status === "escalated").map((s) => s.id);
        if (esc.length) setFresh((f) => new Set([...f, ...esc]));
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    const unacked = sorted?.filter((s) => fresh.has(s.id) && (s.summary?.redFlags ?? []).some((h) => !h.review)).length ?? 0;
    document.title = unacked ? `(${unacked}) New emergency · MedX Bridge` : "Clinician review | MedX Bridge";
  });
  useEffect(() => {
    refreshQueue();
    const t = setInterval(refreshQueue, 5000);
    return () => clearInterval(t);
  }, [refreshQueue]);
  const urgent = sorted?.filter((s) => s.status === "escalated" && unreviewed(s.summary?.redFlags ?? []).length > 0).length;

  return (
    <QC.Provider value={{ sorted, error, refreshQueue, fresh, markOpened }}>
      <ClinicianFrame active="review" urgent={urgent}>{children}</ClinicianFrame>
    </QC.Provider>
  );
}
