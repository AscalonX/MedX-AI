"use client";
import { useEffect, useState } from "react";
import type { Lang } from "@medx/shared";
import { Icon } from "../../components/ui";
import { at, signedOutRequested, stripSignedOut } from "./identity";

const NOTICE_CSS =
  "@media (prefers-reduced-motion:no-preference){@keyframes mx-notice-in{from{opacity:0;transform:translateY(-8px)}}" +
  ".mx-notice{animation:mx-notice-in 260ms var(--ease-pen) both}}";

/**
 * The small "Signed out" notice for the page sign-out lands on (/demo?signedOut=1). Mount it once anywhere on that
 * page: it is fixed under the top nav, reads the flag after mount (no useSearchParams, so static pages need no
 * Suspense), then drops the flag from the URL so a reload or a shared link does not show it again.
 * The live region is always present, so the message is announced when it appears.
 */
export function SignedOutNotice({ lang }: { lang: Lang }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!signedOutRequested(window.location.search)) return;
    setShow(true);
    try {
      window.history.replaceState(window.history.state, "", stripSignedOut(window.location.pathname + window.location.search + window.location.hash));
    } catch {
      /* history blocked: the flag simply stays in the URL */
    }
  }, []);

  return (
    <div role="status" aria-live="polite" lang={lang} className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center px-4">
      {show && (
        <div data-signed-out-notice="" className="mx-notice pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-rule/70 bg-sheet py-2 pl-2 pr-2 text-small text-ink shadow-sheet-lifted">
          <style>{NOTICE_CSS}</style>
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-teal-tint text-teal">
            <Icon name="circle-check" size={16} />
          </span>
          <span className="min-w-0">
            <span className="font-bold">{at("signedOut", lang)}</span> {at("signedOutBody", lang)}
          </span>
          <button
            type="button"
            onClick={() => setShow(false)}
            aria-label={at("dismiss", lang)}
            className="grid size-8 shrink-0 place-items-center rounded-full text-ink-soft transition-colors duration-quick ease-pen hover:bg-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
