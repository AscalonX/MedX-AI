"use client";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { URGENT_SELECTOR, countText, easeGlide, motionOff } from "./motion";

// Layout effect in the browser (decides before paint, so an urgent count never shows a stale number); plain effect on
// the server, where neither runs.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const noSubscribe = () => () => {};

/** True for the first render of a component mounted on the client; false while hydrating server HTML. */
function useClientMount(): boolean {
  const client = useSyncExternalStore(noSubscribe, () => true, () => false);
  return useRef(client).current;
}

function inView(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
}

/** Urgent numbers (inside a signal-coloured or alert element) never count: they show the real value at once. */
function isUrgent(el: Element): boolean {
  return el.closest(URGENT_SELECTOR) !== null;
}

/**
 * Drives a 0..1 progress for one count. Starts at 1 (the real value) so server HTML and no-JS show the truth.
 * On a client mount it restarts from 0 before paint and eases up on `glide`; with `startOnView` it waits until the
 * element is on screen. Instant under reduced motion, inside urgent content, or when hydrating something already
 * visible (no flash back to zero).
 */
function useCount(ref: RefObject<HTMLElement | null>, key: string, durationMs: number, startOnView: boolean, onFrame: (p: number) => void) {
  const clientMount = useClientMount();
  const first = useRef(true);
  const frameCb = useRef(onFrame);
  frameCb.current = onFrame;

  useIsoLayoutEffect(() => {
    const el = ref.current;
    const isFirst = first.current;
    first.current = false;
    const set = (p: number) => frameCb.current(p);
    if (!el || durationMs <= 0 || motionOff() || isUrgent(el)) {
      set(1);
      return;
    }
    if (isFirst && !clientMount && inView(el)) {
      set(1); // hydrated and already visible: keep the server number
      return;
    }
    let raf = 0;
    let io: IntersectionObserver | null = null;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        set(easeGlide(t));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    set(0);
    if (startOnView && !inView(el) && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(([entry]) => {
        if (!entry?.isIntersecting) return;
        io?.disconnect();
        run();
      });
      io.observe(el);
    } else run();
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
    // `key` stands for the value: a new value restarts the count.
  }, [key, durationMs, startOnView]);
}

/**
 * Number that counts to `value` (DIRECTION.md 6g): from 0 when it first appears, then from the previous value on each
 * change, on the `glide` curve. Instant under reduced motion and inside urgent content (a red count shows the real
 * number from the first frame). Screen readers get only the final value. Digits are tabular, in a box as wide as the
 * final number, so nothing beside it moves.
 */
export function CountUp({
  value,
  durationMs = 900,
  format = (n) => Math.round(n).toLocaleString(),
  startOnView = false,
  className,
}: {
  value: number;
  durationMs?: number;
  format?: (n: number) => string;
  /** Wait until the number is on screen (marketing pages). */
  startOnView?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const base = useRef(0); // where the current count started
  const counted = useRef(false);
  useCount(ref, String(value), durationMs, startOnView, (p) => {
    if (p === 0) base.current = counted.current ? shownRef.current : 0; // first count from 0, later from the number shown
    counted.current = true;
    const v = p >= 1 ? value : base.current + (value - base.current) * p;
    shownRef.current = v;
    setShown(v);
  });

  const final = format(value);
  // Box as wide as the final number: tabular digits are 1ch each, separators and signs about 0.32em. The number
  // follows the surrounding alignment (left in tiles, right in right-aligned cells), so nothing beside it moves.
  const digits = final.replace(/\D/g, "").length;
  const minWidth = `calc(${digits}ch + ${((final.length - digits) * 0.32).toFixed(2)}em)`;
  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true" className="inline-block tabular-nums" style={{ minWidth }}>
        {format(shown)}
      </span>
      <span className="sr-only">{final}</span>
    </span>
  );
}

/**
 * A written figure that counts up, e.g. "49.1%" or "13 to 59%": every number in the string counts from 0, the words
 * stay. Waits until it is on screen by default. Width is kept with figure spaces, so the line never reflows. The
 * server HTML (and no-JS, and reduced motion) shows the text as written.
 */
export function CountUpText({ text, durationMs = 900, startOnView = true, className }: { text: string; durationMs?: number; startOnView?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [p, setP] = useState(1);
  useCount(ref, text, durationMs, startOnView, setP);
  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true" className="tabular-nums">
        {countText(text, p)}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
