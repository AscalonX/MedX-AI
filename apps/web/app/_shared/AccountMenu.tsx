"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { Lang } from "@medx/shared";
import { Avatar, Icon } from "../../components/ui";
import { cx } from "../../components/ui/cx";
import { SWITCH_ROLE_HREF, at } from "./identity";

// Popover enter: opacity + transform only, 180 ms, and none at all under reduced motion.
const MENU_CSS =
  "@media (prefers-reduced-motion:no-preference){@keyframes mx-acct-pop{from{opacity:0;transform:translateY(-4px) scale(.97)}}" +
  ".mx-acct-pop{transform-origin:top right;animation:mx-acct-pop 180ms var(--ease-pen) both}}";

const itemClass =
  "flex h-11 w-full items-center gap-3 rounded-control px-3 text-left text-body font-semibold text-ink outline-none transition-colors duration-quick ease-pen hover:bg-muted focus-visible:bg-ocean-tint focus-visible:text-ocean";

/** Sign-out glyph in the Icon set's stroke style (the shared set has no "log-out"). */
function SignOutGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

const menuItems = (root: HTMLElement | null) => Array.from(root?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
/** Focus item i, wrapping both ways (-1 is the last item). */
const focusAt = (list: HTMLElement[], i: number) => {
  if (list.length) list[((i % list.length) + list.length) % list.length]!.focus();
};

function Face({ name, signedIn, size }: { name: string; signedIn: boolean; size: number }) {
  if (signedIn) return <Avatar name={name} size={size} />;
  return (
    <span aria-hidden="true" className="grid shrink-0 place-items-center rounded-full bg-muted text-ink-soft ring-2 ring-sheet" style={{ width: size, height: size }}>
      <Icon name="user" size={Math.round(size * 0.46)} />
    </span>
  );
}

/**
 * Staff account menu (w20): the avatar opens a popover with who is signed in and their role, "Switch role" (the
 * persona hub) and "Sign out". Demo identities only; there is no real authentication in this prototype.
 * Menu-button pattern: aria-haspopup/aria-expanded on the button, role="menu" with menuitems, arrow keys / Home / End
 * move, Escape closes and returns focus to the button, Tab or a click outside closes. No router here: the parent
 * owns navigation (`onSignOut`), so the menu also renders in static tests.
 */
export function AccountMenu({ name, roleLabel, signedIn, lang, onSignOut, onSignIn, switchHref = SWITCH_ROLE_HREF, size = 40 }: {
  name: string;
  roleLabel: string;
  /** false while nobody has chosen an identity for this role (the sign-in sheet is showing). */
  signedIn: boolean;
  lang: Lang;
  onSignOut: () => void;
  /** Shown while not signed in: brings the "Who's signing in?" sheet forward. */
  onSignIn?: () => void;
  switchHref?: string;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<"first" | "last">("first");
  const uid = useId();
  const btnId = `${uid}-account`;
  const menuId = `${uid}-menu`;

  const items = () => menuItems(pop.current);
  const focusItem = (i: number) => focusAt(menuItems(pop.current), i);

  useEffect(() => {
    if (!open) return;
    focusAt(menuItems(pop.current), focusOnOpen.current === "last" ? -1 : 0);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const show = (where: "first" | "last") => {
    focusOnOpen.current = where;
    if (open) focusItem(where === "last" ? -1 : 0);
    else setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      show(e.key === "ArrowUp" ? "last" : "first");
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    }
  };
  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = items().indexOf(document.activeElement as HTMLElement);
    const move: Record<string, number | undefined> = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: -1 };
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // page-level Escape handlers (clear highlight, close drawer) stay out of it
      close(true);
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (move[e.key] !== undefined) {
      e.preventDefault();
      focusItem(move[e.key]!);
    }
  };

  const shown = signedIn ? name : at("notSignedIn", lang);

  return (
    <div className="relative">
      <style>{MENU_CSS}</style>
      <button
        ref={btn}
        id={btnId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={at("menuFor", lang, { name: shown })}
        data-account-menu=""
        onClick={() => (open ? close(false) : show("first"))}
        onKeyDown={onButtonKey}
        className="flex items-center gap-1 rounded-full p-0.5 text-ink-soft transition-transform duration-quick ease-pen hover:scale-[1.03] hover:text-ink active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean"
      >
        <Face name={name} signedIn={signedIn} size={size} />
        <Icon name="chevron-down" size={14} className={cx("transition-transform duration-base ease-pen", open && "rotate-180")} />
      </button>
      {open && (
        <div
          ref={pop}
          lang={lang}
          onKeyDown={onMenuKey}
          className="mx-acct-pop absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 max-w-[calc(100vw-2rem)] rounded-card border border-rule/70 bg-sheet p-2 shadow-sheet-lifted"
        >
          <div className="flex items-center gap-3 px-2 pb-2 pt-1.5">
            <Face name={name} signedIn={signedIn} size={44} />
            <div className="min-w-0">
              <p className="text-micro font-semibold text-ink-soft">{at(signedIn ? "signedInAs" : "notSignedIn", lang)}</p>
              {signedIn && <p className="truncate text-body font-bold text-ink">{name}</p>}
              <p className="text-small font-semibold text-teal">{roleLabel}</p>
            </div>
          </div>
          <p className="mx-2 mb-2 flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-micro text-ink-soft">
            <Icon name="lock" size={12} />
            {at("demoIdentity", lang)}
          </p>
          <div aria-hidden="true" className="mx-2 mb-1 h-px bg-rule/70" />
          <div id={menuId} role="menu" aria-labelledby={btnId} className="flex flex-col">
            {!signedIn && onSignIn && (
              <button type="button" role="menuitem" tabIndex={-1} className={itemClass} onClick={() => { setOpen(false); onSignIn(); }}>
                <Icon name="user-check" size={18} />
                {at("chooseIdentity", lang)}
              </button>
            )}
            <Link href={switchHref} role="menuitem" tabIndex={-1} className={itemClass} onClick={() => setOpen(false)}>
              <Icon name="users" size={18} />
              {at("switchRole", lang)}
            </Link>
            <button type="button" role="menuitem" tabIndex={-1} data-sign-out="" className={itemClass} onClick={() => { setOpen(false); onSignOut(); }}>
              <SignOutGlyph />
              {at("signOut", lang)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
