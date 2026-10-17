"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { IntakeSession } from "@medx/shared";
import { ClinicianFrame, useFrame } from "../_frame";
import { fetchQueue, sortQueue, unreviewed } from "./_lib";

interface Q { sorted: IntakeSession[] | null; error: string | null; refreshQueue: () => void }
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
  const refreshQueue = useCallback(() => {
    fetchQueue().then((q) => { setQueue(q); setError(null); }).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    refreshQueue();
    const t = setInterval(refreshQueue, 5000);
    return () => clearInterval(t);
  }, [refreshQueue]);
  const sorted = useMemo(() => (queue ? sortQueue(queue) : null), [queue]);
  const urgent = sorted?.filter((s) => s.status === "escalated" && unreviewed(s.summary?.redFlags ?? []).length > 0).length;

  return (
    <QC.Provider value={{ sorted, error, refreshQueue }}>
      <ClinicianFrame active="review" urgent={urgent}>{children}</ClinicianFrame>
    </QC.Provider>
  );
}
