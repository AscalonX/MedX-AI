"use client";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Lang, StaffRole } from "@medx/shared";
import { Avatar, Icon, buttonClasses } from "../../components/ui";
import { SWITCH_ROLE_HREF, at, guardedControl, guardedKey, isIdentityKey, staffChoices, storedIdentity, type NodeLike } from "./identity";

/**
 * Who is signed in for `role` on this page. `ready`: the role itself has been restored from storage (the clinician
 * frame restores nurse/doctor after mount), so the check never runs on a default. Tri-state per role: unknown until
 * checked (no sheet flash before storage is read), then signed in or not.
 * `confirm(role)` records an explicit choice in memory as well, so blocked storage (private mode) still works for the
 * page. A sign-out in another tab signs this tab out too; a sign-in elsewhere does not sign this tab in (the name
 * shown here would be stale), the person chooses here.
 */
export function useIdentityGate(role: StaffRole, ready = true) {
  const [state, setState] = useState<Partial<Record<StaffRole, boolean>>>({});
  useEffect(() => {
    if (!ready) return;
    setState((cur) => (cur[role] === true ? cur : { ...cur, [role]: storedIdentity(role) !== null }));
  }, [role, ready]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea && e.storageArea !== window.localStorage) return;
      if (!isIdentityKey(e.key)) return;
      setState((cur) => {
        let next = cur;
        for (const r of Object.keys(cur) as StaffRole[]) {
          if (cur[r] === true && storedIdentity(r) === null) next = { ...next, [r]: false };
        }
        return next;
      });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const confirm = useCallback((r: StaffRole) => setState((cur) => (cur[r] === true ? cur : { ...cur, [r]: true })), []);
  return { needed: ready && state[role] === false, signedIn: state[role] === true, confirm };
}

/**
 * Wraps page content (display: contents, so layout is untouched). While `blocked`, clicks on action controls, Enter
 * in text fields and form submits are stopped before any page handler runs, and `onBlocked` brings the sign-in
 * sheet forward. Reading stays possible: scrolling, links, tabs and segments, disclosure toggles, typing.
 * Red-flag interrupts are lifted above the sheet while it shows (they are never covered, never dimmed).
 */
export function IdentityGate({ blocked, onBlocked, children }: { blocked: boolean; onBlocked: (control: HTMLElement | null) => void; children: ReactNode }) {
  return (
    <div
      className="mx-gate contents"
      data-blocked={blocked ? "" : undefined}
      onClickCapture={blocked ? (e) => {
        const c = guardedControl(e.target as unknown as NodeLike);
        if (!c) return;
        e.preventDefault();
        e.stopPropagation();
        onBlocked(c as unknown as HTMLElement);
      } : undefined}
      onKeyDownCapture={blocked ? (e) => {
        if (!guardedKey(e)) return;
        e.preventDefault();
        e.stopPropagation();
        onBlocked(e.target as HTMLElement);
      } : undefined}
      onSubmitCapture={blocked ? (e) => {
        e.preventDefault();
        e.stopPropagation();
        onBlocked(null);
      } : undefined}
    >
      {children}
    </div>
  );
}

// Enter: rise + fade (320 ms). Nudge after a blocked action: a short lift (two names so it restarts each time).
// Transform and opacity only; nothing at all under reduced motion. Red-flag interrupts sit above the sheet (z 41 > 40).
const SHEET_CSS =
  ".mx-gate[data-blocked] .mx-interrupt{position:relative;z-index:41}" +
  "@media (prefers-reduced-motion:no-preference){" +
  "@keyframes mx-signin-in{from{opacity:0;transform:translateY(18px)}}" +
  "@keyframes mx-signin-nudge-a{35%{transform:translateY(-6px)}70%{transform:translateY(1px)}}" +
  "@keyframes mx-signin-nudge-b{35%{transform:translateY(-6px)}70%{transform:translateY(1px)}}" +
  ".mx-signin{animation:mx-signin-in 320ms var(--ease-pen) both}" +
  '.mx-signin[data-nudge="1"]{animation:mx-signin-nudge-a 360ms var(--ease-pen)}' +
  '.mx-signin[data-nudge="2"]{animation:mx-signin-nudge-b 360ms var(--ease-pen)}}';

/**
 * "Who's signing in?" (w20): shown when a staff page opens with no stored identity for its role. A bottom sheet,
 * not a modal: no backdrop, the page stays readable above it, and urgent alerts are never covered by a dim layer.
 * Choosing a name calls `onChoose`, which must set the identity exactly like the "Signed in as" select.
 * `nudge` increments on every blocked action: the sheet reopens if hidden, lifts once and takes focus.
 * `roleSwitch`: optional control for surfaces with more than one role (clinician: nurse or doctor).
 */
export function SignInSheet({ open, lang, role, roleLabel, onChoose, nudge = 0, roleSwitch }: {
  open: boolean;
  lang: Lang;
  role: StaffRole;
  roleLabel: string;
  onChoose: (name: string) => void;
  nudge?: number;
  roleSwitch?: ReactNode;
}) {
  const [hidden, setHidden] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  const pill = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<"first" | "pill" | null>(null);
  const titleId = useId();
  const bodyId = useId();

  // A blocked action brings the sheet back and moves focus to the first name.
  useEffect(() => {
    if (nudge <= 0) return;
    focusNext.current = "first";
    setHidden(false);
    first.current?.focus();
  }, [nudge]);
  useEffect(() => { if (!open) setHidden(false); }, [open]); // a later sign-out shows the full sheet again
  useEffect(() => {
    if (focusNext.current === "first") first.current?.focus();
    else if (focusNext.current === "pill") pill.current?.focus();
    focusNext.current = null;
  }, [hidden]);

  if (!open) return null;
  const staff = staffChoices(role);
  const hide = () => { focusNext.current = "pill"; setHidden(true); };
  const reveal = () => { focusNext.current = "first"; setHidden(false); };

  return (
    <>
      <style>{SHEET_CSS}</style>
      {/* Room at the end of the page so everything can scroll clear of the sheet. */}
      <div aria-hidden="true" className="h-80 sm:h-64" />
      <div className={`pointer-events-none fixed inset-x-3 bottom-3 z-40 flex lg:left-[calc(248px+1.5rem)] lg:right-6 ${hidden ? "justify-end" : "justify-center"}`}>
        {hidden ? (
          <button
            ref={pill}
            type="button"
            onClick={reveal}
            className="mx-signin pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full bg-primary-gradient px-5 text-body font-semibold text-on-primary shadow-button transition-transform duration-quick ease-pen hover:-translate-y-px active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean"
          >
            <Icon name="user-check" size={18} />
            {at("sheetTitle", lang)}
          </button>
        ) : (
          <section
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            lang={lang}
            data-signin-sheet={role}
            data-nudge={nudge > 0 ? (nudge % 2 ? "1" : "2") : undefined}
            onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); hide(); } }}
            className="mx-signin pointer-events-auto max-h-[min(72dvh,34rem)] w-full max-w-[680px] overflow-y-auto rounded-hero border border-rule/70 bg-sheet p-5 shadow-float"
          >
            <div className="flex flex-wrap items-start gap-3">
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-gradient text-on-primary shadow-button">
                <Icon name="user-check" size={20} />
              </span>
              <div className="min-w-0 flex-1 basis-52">
                <h2 id={titleId} className="text-lead font-extrabold text-ink">{at("sheetTitle", lang)}</h2>
                <p id={bodyId} className="text-small text-ink-soft">{at("sheetBody", lang)}</p>
              </div>
              <div className="flex items-center gap-2">
                {roleSwitch}
                <button
                  type="button"
                  onClick={hide}
                  aria-label={at("minimize", lang)}
                  title={at("minimize", lang)}
                  className="grid size-9 place-items-center rounded-full text-ink-soft transition-colors duration-quick ease-pen hover:bg-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean"
                >
                  <Icon name="chevron-down" size={18} />
                </button>
              </div>
            </div>
            <p role="status" className={nudge > 0 ? "mt-3 rounded-full bg-ocean-tint px-3 py-1.5 text-small font-semibold text-ocean" : "sr-only"}>
              {nudge > 0 ? at("sheetBlocked", lang) : ""}
            </p>
            <ul aria-label={roleLabel} className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {staff.map((m, i) => (
                <li key={m.id}>
                  <button
                    ref={i === 0 ? first : undefined}
                    type="button"
                    data-staff={m.id}
                    onClick={() => onChoose(m.name)}
                    className="group flex w-full items-center gap-3 rounded-card border border-rule/70 bg-sheet px-3 py-2.5 text-left shadow-hairline transition-[translate,border-color,box-shadow] duration-quick ease-pen hover:-translate-y-px hover:border-ocean hover:shadow-sheet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean"
                  >
                    <Avatar name={m.name} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold text-ink">{m.name}</span>
                      <span className="block truncate text-micro text-ink-soft">{m.hint?.[lang] ?? roleLabel}</span>
                    </span>
                    <Icon name="arrow-right" size={16} className="shrink-0 text-ocean transition-[translate] duration-quick ease-pen group-hover:translate-x-0.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-micro text-graphite">
                <Icon name="lock" size={13} />
                {at("sheetNote", lang)}
              </p>
              <Link href={SWITCH_ROLE_HREF} className={buttonClasses({ variant: "quiet", size: "sm" })}>
                <Icon name="users" size={14} />
                {at("otherRole", lang)}
              </Link>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
