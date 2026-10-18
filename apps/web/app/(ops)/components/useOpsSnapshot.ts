"use client";

import { useEffect, useState } from "react";
import type { ListSessionsRes, MetricsRes } from "@medx/shared/src/api";
import { startVisiblePolling } from "../../_shared/visiblePolling";
import { isHealth, isMetrics, isSessions, type OpsHealth } from "../ops-data";

export interface OpsSnapshot { sessions: ListSessionsRes; metrics: MetricsRes; health: OpsHealth; fetchedAt: number }

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
        const [sessionsResponse, metricsResponse, healthResponse] = await Promise.all([
          fetch("/api/sessions", { cache: "no-store", signal: controller.signal }),
          fetch("/api/metrics", { cache: "no-store", signal: controller.signal }),
          fetch("/api/health", { cache: "no-store", signal: controller.signal }),
        ]);
        if (!sessionsResponse.ok || !metricsResponse.ok || !healthResponse.ok) throw new Error("HTTP error");
        const [sessions, metrics, health]: [unknown, unknown, unknown] = await Promise.all([sessionsResponse.json(), metricsResponse.json(), healthResponse.json()]);
        if (!isSessions(sessions) || !isMetrics(metrics) || !isHealth(health)) throw new Error("Invalid response");
        if (!disposed) {
          setSnapshot({ sessions, metrics, health, fetchedAt: Date.now() });
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
    // Every 5 s while the tab is visible; a hidden tab sends nothing to /api/sessions or /api/metrics (C-03) and
    // refreshes at once when it is shown again.
    const stop = startVisiblePolling(() => void load(), 5000);
    return () => {
      disposed = true;
      controller?.abort();
      stop();
    };
  }, [attempt]);

  return { snapshot, error, refreshing, retry: () => setAttempt(n => n + 1) };
}
