"use client";
import { useEffect, useRef } from "react";

/** What polling needs from the browser. Injected so the logic is testable without a DOM. */
export interface PollEnv {
  isHidden: () => boolean;
  /** Subscribe to visibility changes; returns the unsubscribe function. */
  onVisibilityChange: (cb: () => void) => () => void;
  setInterval: (cb: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
}

export function browserPollEnv(): PollEnv {
  return {
    isHidden: () => typeof document !== "undefined" && document.visibilityState === "hidden",
    onVisibilityChange: (cb) => {
      if (typeof document === "undefined") return () => {};
      document.addEventListener("visibilitychange", cb);
      return () => document.removeEventListener("visibilitychange", cb);
    },
    setInterval: (cb, ms) => window.setInterval(cb, ms),
    clearInterval: (h) => window.clearInterval(h as number),
  };
}

/**
 * Calls `fn` now and then every `ms` while the tab is visible (C-03).
 * While the tab is hidden nothing is called and no timer runs. When the tab becomes visible again, `fn` runs at once
 * and the interval restarts. A tab opened in the background makes its first call only when it is shown.
 * Returns a stop function.
 */
export function startVisiblePolling(fn: () => void, ms: number, env: PollEnv = browserPollEnv()): () => void {
  let timer: unknown = null;
  let stopped = false;
  const arm = () => { if (timer === null) timer = env.setInterval(fn, ms); };
  const disarm = () => { if (timer !== null) { env.clearInterval(timer); timer = null; } };
  const onChange = () => {
    if (stopped) return;
    if (env.isHidden()) disarm();
    else { disarm(); fn(); arm(); }
  };
  const off = env.onVisibilityChange(onChange);
  if (!env.isHidden()) { fn(); arm(); }
  return () => { stopped = true; off(); disarm(); };
}

/**
 * React wrapper: polls `fn` every `ms` while the tab is visible. `fn` may change between renders; the latest one runs.
 * Restarts when `key` changes (for example the case id). `enabled = false` stops polling.
 */
export function useVisiblePolling(fn: () => void, ms: number, key: unknown = null, enabled = true) {
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => {
    if (!enabled) return;
    return startVisiblePolling(() => latest.current(), ms);
  }, [ms, key, enabled]);
}
