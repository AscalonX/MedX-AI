"use client";

import { useEffect, useState } from "react";
import type { ListSessionsRes, MetricsRes } from "@medx/shared/src/api";
import { isMetrics, isSessions } from "../ops-data";

export interface OpsSnapshot { sessions: ListSessionsRes; metrics: MetricsRes; fetchedAt: number }

export function useOpsSnapshot() {
  const [snapshot, setSnapshot] = useState<OpsSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    let running = false;
    let controller: AbortController | undefined;
    const load = async () => {
      if (running) return;
      running = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 8000);
      setRefreshing(true);
      try {
        const [sessionsResponse, metricsResponse] = await Promise.all([
          fetch("/api/sessions", { cache: "no-store", signal: controller.signal }),
          fetch("/api/metrics", { cache: "no-store", signal: controller.signal }),
        ]);
        if (!sessionsResponse.ok || !metricsResponse.ok) throw new Error("HTTP error");
        const [sessions, metrics]: [unknown, unknown] = await Promise.all([sessionsResponse.json(), metricsResponse.json()]);
        if (!isSessions(sessions) || !isMetrics(metrics)) throw new Error("Invalid response");
        if (!disposed) {
          setSnapshot({ sessions, metrics, fetchedAt: Date.now() });
          setError(false);
        }
      } catch {
        controller.abort();
        if (!disposed) setError(true);
      } finally {
        window.clearTimeout(timeout);
        running = false;
        if (!disposed) setRefreshing(false);
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 5000);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(interval);
    };
  }, [attempt]);

  return { snapshot, error, refreshing, retry: () => setAttempt(n => n + 1) };
}
