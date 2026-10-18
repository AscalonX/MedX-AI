"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { motionOff } from "./motion";
import { cx } from "./cx";

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * Subtle pointer parallax for marketing hero art (DIRECTION.md 5 and 12). Sets `--mx-px` / `--mx-py` (-1 to 1, from
 * the pointer's offset to the stage centre) on its root; children with `mx-depth` (and `--mx-depth` in px) drift on
 * the `translate` property. Desktop mouse only (hover + fine pointer, 1024px and up), only while the stage is on
 * screen, rAF-throttled, and off under reduced motion. Never put clinical or urgent content inside.
 */
export function PointerParallax({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || motionOff() || typeof IntersectionObserver === "undefined") return;
    const desk = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1024px)");
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      el.style.setProperty("--mx-px", x.toFixed(3));
      el.style.setProperty("--mx-py", y.toFixed(3));
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !desk.matches) return;
      const r = el.getBoundingClientRect();
      x = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2));
      y = clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2));
      queue();
    };
    const reset = () => {
      x = 0;
      y = 0;
      queue();
    };
    let listening = false;
    const listen = (on: boolean) => {
      if (on === listening) return;
      listening = on;
      if (on) {
        window.addEventListener("pointermove", onMove, { passive: true });
        document.documentElement.addEventListener("pointerleave", reset);
      } else {
        window.removeEventListener("pointermove", onMove);
        document.documentElement.removeEventListener("pointerleave", reset);
        reset();
      }
    };
    const io = new IntersectionObserver(([entry]) => listen(!!entry?.isIntersecting));
    io.observe(el);
    return () => {
      io.disconnect();
      listen(false);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className={cx("mx-parallax", className)}>
      {children}
    </div>
  );
}
