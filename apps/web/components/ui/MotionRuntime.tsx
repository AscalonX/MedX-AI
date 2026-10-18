"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { REVEAL_SELECTOR, URGENT_SELECTOR, motionOff } from "./motion";

/** Holds urgent content (or is urgent itself): it must appear at once (DIRECTION.md 5, "Urgent stays still"). */
function holdsUrgent(el: Element): boolean {
  return el.matches(URGENT_SELECTOR) || el.querySelector(URGENT_SELECTOR) !== null;
}

/**
 * The page's motion runtime (DIRECTION.md 5). Mounted once in app/layout.tsx; renders nothing.
 * - Reveal on scroll: every `.mx-reveal` that is below the fold when it first appears is marked `data-reveal="wait"`
 *   (hidden by CSS) and fades up when it enters the viewport; anything already on screen, above it, or holding urgent
 *   content is marked `in` at once. Content is therefore visible without JS, and nothing on screen ever blinks.
 * - Page enter on client navigations: the app's `#main-content` fades up 8px (Web Animations). The CSS covers the
 *   first load. Skipped, or cut to the end in the same frame, when the page holds urgent content or a fixed layer.
 * - Off under prefers-reduced-motion and with `?motion=off` (for capture tools); then `data-motion="off"` on <html>
 *   also stops the CSS entrances.
 */
export function MotionRuntime() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (motionOff()) {
      root.dataset.motion = "off";
      return;
    }
    if (typeof IntersectionObserver === "undefined" || typeof MutationObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entries) => {
        let batch = 0;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          io.unobserve(el);
          // Elements arriving in the same frame stagger (capped, so a long row never waits long).
          el.style.setProperty("--mx-batch", String(Math.min(batch++, 5)));
          el.dataset.reveal = "in";
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0 },
    );

    const scan = () => {
      const fold = window.innerHeight * 0.92;
      for (const el of document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)) {
        if (el.dataset.reveal === "in") continue;
        if (el.dataset.reveal === "wait") {
          io.observe(el); // marked by an earlier run (React strict mode remounts effects in development)
          continue;
        }
        const r = el.getBoundingClientRect();
        const below = r.top >= fold && r.height > 0;
        if (!below || holdsUrgent(el)) {
          el.dataset.reveal = "in";
          continue;
        }
        el.dataset.reveal = "wait";
        io.observe(el);
      }
    };
    scan();
    root.dataset.motion = "on";

    // New reveal nodes (client navigation, client-rendered sections) are sorted before they paint: mutation
    // callbacks run as microtasks, ahead of the next frame.
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMedia = () => {
      if (!media.matches) return;
      for (const el of document.querySelectorAll<HTMLElement>('[data-reveal="wait"]')) el.dataset.reveal = "in";
      root.dataset.motion = "off";
      io.disconnect();
      mo.disconnect();
    };
    media.addEventListener("change", onMedia);
    return () => {
      media.removeEventListener("change", onMedia);
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  useEffect(() => {
    const previous = lastPath.current;
    lastPath.current = pathname;
    if (previous === null || previous === pathname) return; // the first load is the CSS entrance
    if (motionOff()) return;
    const main = document.getElementById("main-content");
    if (!main || main.dataset.pageMotion === "off" || typeof main.animate !== "function") return;
    // A remounted <main> already plays the CSS entrance: do not stack a second one.
    if (main.getAnimations().some((a) => a.playState === "running")) return;
    const blocked = () => holdsUrgent(main) || main.querySelector(".fixed") !== null;
    if (blocked()) return;
    const anim = main.animate([{ opacity: 0, transform: "translate3d(0, 8px, 0)" }, { opacity: 1, transform: "none" }], {
      duration: 360,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    });
    // Urgent content arriving during the fade (a red flag after the case loads) ends it in the same frame.
    const watch = new MutationObserver(() => {
      if (blocked()) anim.cancel();
    });
    watch.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "role", "data-urgent"] });
    const stop = () => watch.disconnect();
    anim.addEventListener("finish", stop);
    anim.addEventListener("cancel", stop);
    return stop;
  }, [pathname]);

  return null;
}
