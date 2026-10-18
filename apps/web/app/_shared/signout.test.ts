import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEMO_PERSONAS, ROLE_STORAGE_KEY, STAFF, reviewerStorageKey, staffFor, type Lang } from "@medx/shared";
import { personaStorage } from "../_landing/demo";
import { AccountMenu } from "./AccountMenu";
import { SignInSheet } from "./SignIn";
import { SignedOutNotice } from "./SignedOutNotice";
import { DEMO_CASE_KEY, DEMO_PERSONA_KEY, applyDemoPersona, readDemoCase, readDemoPersona, writeDemoCase } from "./demoPersona";
import {
  ACCOUNT_COPY, IDENTITY_KEYS, IDENTITY_PREFIXES, SIGNED_OUT_HREF, STAFF_ROLES, clearIdentity, clearSessionContext, guardedControl, guardedKey,
  isIdentityKey, rememberIdentity, signOut, signedOutRequested, staffChoices, storedIdentity, stripSignedOut, type NodeLike,
} from "./identity";
import { CLINICIAN_ROLE_KEY } from "./useStaffRole";

// vitest.config.ts compiles TSX with the classic runtime (React.createElement): give the components a global React
// while they load. vi.hoisted runs before the imports above.
await vi.hoisted(async () => {
  (globalThis as { React?: unknown }).React = await import("react");
});

/** A Storage stand-in with key()/length, like the browser's. */
class MemoryStorage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}
const blocked = {
  get length(): number { throw new Error("SecurityError"); },
  key: () => { throw new Error("SecurityError"); },
  getItem: () => { throw new Error("SecurityError"); },
  setItem: () => { throw new Error("SecurityError"); },
  removeItem: () => { throw new Error("SecurityError"); },
};
const LANGS: Lang[] = ["en", "th", "it"];

/** Every key a persona card, the "Reset my demo case" button and the staff surfaces write. */
function signedInEverywhere() {
  const s = new MemoryStorage();
  for (const p of DEMO_PERSONAS) {
    for (const [k, v] of personaStorage(p)) s.setItem(k, v); // landing persona cards (/demo/<persona>)
    applyDemoPersona(p.id, s); // demo guide reset
  }
  writeDemoCase({ id: "s-1", code: "B-015", personaId: "nurse-rossi" }, s);
  for (const m of STAFF) s.setItem(reviewerStorageKey(m.role), m.name); // the "Signed in as" selects
  s.setItem(CLINICIAN_ROLE_KEY, "doctor");
  s.setItem(ROLE_STORAGE_KEY, "pharmacist");
  return s;
}

describe("sign-out helpers (w20)", () => {
  it("IDENTITY_KEYS names every identity key the persona flow and the staff surfaces write, and no preference", () => {
    for (const r of STAFF_ROLES) expect(IDENTITY_KEYS).toContain(reviewerStorageKey(r));
    expect(IDENTITY_KEYS).toEqual(expect.arrayContaining([ROLE_STORAGE_KEY, CLINICIAN_ROLE_KEY, DEMO_PERSONA_KEY, DEMO_CASE_KEY]));
    for (const p of DEMO_PERSONAS) for (const [k] of personaStorage(p)) expect(IDENTITY_KEYS, k).toContain(k);
    const s = new MemoryStorage();
    for (const p of DEMO_PERSONAS) applyDemoPersona(p.id, s);
    for (const k of s.data.keys()) expect(IDENTITY_KEYS, k).toContain(k);
    expect(STAFF_ROLES).toEqual(expect.arrayContaining([...new Set(STAFF.map((m) => m.role))]));
    for (const r of STAFF_ROLES) expect(IDENTITY_PREFIXES.some((p) => reviewerStorageKey(r).startsWith(p))).toBe(true);
    expect(IDENTITY_KEYS).not.toContain("medx.lang");
    expect(IDENTITY_KEYS).not.toContain("medx.pharmacy.tab");
  });

  it("signOut clears every identity key, keeps the language and per-viewer conveniences, and lands on /demo with the notice flag", () => {
    const local = signedInEverywhere();
    local.setItem("medx.lang", "th");
    local.setItem("medx.pharmacy.tab", "dispense");
    local.setItem("medx.reviewer.future-role", "Someone"); // a role added later is still identity
    local.setItem("medx.demo.extra", "1");
    local.setItem("unrelated.key", "keep");
    const session = new MemoryStorage();
    session.setItem("medx.consult.consent.s-1", "1");
    session.setItem("medx.consult.consent.s-2", "1");
    session.setItem("medx.other", "keep");

    const { href, cleared } = signOut({ local, session });

    expect(href).toBe("/demo?signedOut=1");
    expect(href).toBe(SIGNED_OUT_HREF);
    expect([...local.data.keys()].sort()).toEqual(["medx.lang", "medx.pharmacy.tab", "unrelated.key"]);
    expect([...session.data.keys()]).toEqual(["medx.other"]);
    expect(cleared).toEqual(expect.arrayContaining([...IDENTITY_KEYS, "medx.reviewer.future-role", "medx.demo.extra", "medx.consult.consent.s-1"]));
    expect(readDemoPersona(local)).toBeNull();
    expect(readDemoCase(local)).toBeNull();
    for (const r of STAFF_ROLES) expect(storedIdentity(r, local), r).toBeNull();
  });

  it("never throws on blocked, missing or minimal storage; the fixed keys still go without key()/length", () => {
    expect(() => signOut({ local: blocked, session: blocked })).not.toThrow();
    expect(signOut({ local: blocked, session: blocked }).href).toBe(SIGNED_OUT_HREF);
    expect(signOut({ local: null, session: null })).toEqual({ href: SIGNED_OUT_HREF, cleared: [] });
    expect(clearIdentity(null)).toEqual([]);
    expect(clearSessionContext(null)).toEqual([]);
    const removed: string[] = [];
    const minimal = { removeItem: (k: string) => { removed.push(k); } };
    expect(clearIdentity(minimal)).toEqual([...IDENTITY_KEYS]);
    expect(removed).toEqual([...IDENTITY_KEYS]);
    expect(clearSessionContext(minimal)).toEqual([]);
  });

  it("storedIdentity accepts only a STAFF name of that role; rememberIdentity writes it like the select does", () => {
    const s = new MemoryStorage();
    for (const r of STAFF_ROLES) expect(storedIdentity(r, s)).toBeNull();
    s.setItem(reviewerStorageKey("nurse"), "Nurse Kanya Srisuk");
    expect(storedIdentity("nurse", s)).toBe("Nurse Kanya Srisuk");
    s.setItem(reviewerStorageKey("doctor"), "Nurse Kanya Srisuk"); // another role's name
    expect(storedIdentity("doctor", s)).toBeNull();
    s.setItem(reviewerStorageKey("pharmacist"), "pharmacist laura conti"); // not the exact display name
    expect(storedIdentity("pharmacist", s)).toBeNull();
    expect(storedIdentity("nurse", blocked)).toBeNull();
    expect(storedIdentity("nurse", null)).toBeNull();

    expect(rememberIdentity("pharmacist", "Pharmacist Nattaya Wong", s)).toBe(true);
    expect(s.getItem(reviewerStorageKey("pharmacist"))).toBe("Pharmacist Nattaya Wong");
    expect(storedIdentity("pharmacist", s)).toBe("Pharmacist Nattaya Wong");
    expect(rememberIdentity("ops", "Dr. Marco Bianchi", s)).toBe(false); // not ops staff: nothing written
    expect(s.getItem(reviewerStorageKey("ops"))).toBeNull();
    expect(rememberIdentity("ops", "Head Nurse Elena Greco", blocked)).toBe(false);
  });

  it("isIdentityKey: storage.clear(), the identity keys and prefixes; not the language", () => {
    expect(isIdentityKey(null)).toBe(true);
    for (const k of IDENTITY_KEYS) expect(isIdentityKey(k), k).toBe(true);
    expect(isIdentityKey("medx.reviewer.anything")).toBe(true);
    expect(isIdentityKey("medx.lang")).toBe(false);
    expect(isIdentityKey("medx.pharmacy.tab")).toBe(false);
  });

  it("the signed-out flag is read from the query and stripped without touching the rest of the URL", () => {
    expect(signedOutRequested("?signedOut=1")).toBe(true);
    expect(signedOutRequested("?lang=th&signedOut=1")).toBe(true);
    expect(signedOutRequested("")).toBe(false);
    expect(signedOutRequested("?signedOut=0")).toBe(false);
    expect(stripSignedOut("/demo?signedOut=1")).toBe("/demo");
    expect(stripSignedOut("/demo?lang=th&signedOut=1#roles")).toBe("/demo?lang=th#roles");
    expect(stripSignedOut("/demo")).toBe("/demo");
  });
});

/** A DOM element stand-in: tag, attributes and parent. */
function el(tagName: string, attrs: Record<string, string> = {}, parentElement: NodeLike | null = null): NodeLike {
  return { tagName, getAttribute: (n) => (n in attrs ? attrs[n]! : null), parentElement };
}

describe("write gate before sign-in (w20)", () => {
  it("blocks action controls (buttons, role=button/checkbox/switch, submit inputs), including clicks on their icons", () => {
    const button = el("BUTTON");
    expect(guardedControl(button)).toBe(button);
    expect(guardedControl(el("svg", {}, el("span", {}, button)))).toBe(button);
    for (const role of ["button", "menuitem", "checkbox", "switch"]) {
      const d = el("DIV", { role });
      expect(guardedControl(d), role).toBe(d);
    }
    for (const type of ["submit", "button", "image", "reset", "SUBMIT"]) {
      const i = el("INPUT", { type });
      expect(guardedControl(i), type).toBe(i);
    }
    const fakeButton = el("A", { role: "button" });
    expect(guardedControl(fakeButton)).toBe(fakeButton);
  });

  it("lets reading through: links, tabs and segments, disclosure and drawer toggles, text fields, selects, plain content", () => {
    expect(guardedControl(el("A", { href: "/review/s-1" }))).toBeNull();
    expect(guardedControl(el("span", {}, el("A", { href: "/demo" })))).toBeNull();
    for (const role of ["tab", "radio", "option", "link"]) expect(guardedControl(el("BUTTON", { role })), role).toBeNull();
    for (const a of ["aria-expanded", "aria-controls", "aria-haspopup", "data-gate-allow"]) expect(guardedControl(el("BUTTON", { [a]: "false" })), a).toBeNull();
    for (const t of ["SELECT", "TEXTAREA", "SUMMARY"]) expect(guardedControl(el(t)), t).toBeNull();
    expect(guardedControl(el("INPUT"))).toBeNull();
    expect(guardedControl(el("INPUT", { type: "search" }))).toBeNull();
    expect(guardedControl(el("INPUT", { type: "checkbox" }))).toBeNull(); // local state until a button submits it
    expect(guardedControl(el("P", {}, el("SECTION", { role: "alert" })))).toBeNull(); // reading an alert
    expect(guardedControl(null)).toBeNull();
    expect(guardedControl(undefined)).toBeNull();
  });

  it("blocks Enter in text fields (implicit submit, Enter-to-place handlers), not Shift+Enter or other keys", () => {
    expect(guardedKey({ key: "Enter", target: el("INPUT") })).toBe(true);
    expect(guardedKey({ key: "Enter", target: el("TEXTAREA") })).toBe(true);
    expect(guardedKey({ key: "Enter", shiftKey: true, target: el("TEXTAREA") })).toBe(false);
    expect(guardedKey({ key: "Enter", target: el("BUTTON") })).toBe(false); // becomes a click: the click guard handles it
    expect(guardedKey({ key: "a", target: el("INPUT") })).toBe(false);
    expect(guardedKey({ key: "Escape", target: el("INPUT") })).toBe(false);
    expect(guardedKey({ key: "Enter" })).toBe(false);
  });
});

describe("account menu and sign-in sheet (w20)", () => {
  it("copy is complete in en, th and it, and has no emoji", () => {
    for (const [k, v] of Object.entries(ACCOUNT_COPY)) {
      for (const l of LANGS) {
        expect(v[l], `${k}.${l}`).toBeTruthy();
        expect(v[l], `${k}.${l}`).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    }
  });

  it("the avatar is a menu button (closed: aria-expanded false, no menu in the DOM) named for the person or 'Not signed in'", () => {
    const html = renderToStaticMarkup(h(AccountMenu, { name: "Nurse Anna Rossi", roleLabel: "Nurse", signedIn: true, lang: "en", onSignOut: () => {} }));
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Account menu, Nurse Anna Rossi"');
    expect(html).toContain('<button');
    expect(html).not.toContain('role="menu"');
    const out = renderToStaticMarkup(h(AccountMenu, { name: "Nurse Anna Rossi", roleLabel: "Nurse", signedIn: false, lang: "it", onSignOut: () => {} }));
    expect(out).toContain('aria-label="Menu account, Accesso non effettuato"');
    expect(out).not.toContain("Nurse Anna Rossi");
  });

  it("the sheet lists exactly the STAFF for the role, is a non-modal dialog, links to /demo, and uses no red", () => {
    for (const role of STAFF_ROLES) {
      const html = renderToStaticMarkup(h(SignInSheet, { open: true, lang: "en", role, roleLabel: role, onChoose: () => {} }));
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="false"');
      expect(html).toContain("Who&#x27;s signing in?");
      expect(html).toContain('href="/demo"');
      const ids = [...html.matchAll(/data-staff="([^"]+)"/g)].map((m) => m[1]);
      expect(ids, role).toEqual(staffFor(role).map((m) => m.id));
      expect(staffChoices(role).map((m) => m.name)).toEqual(staffFor(role).map((m) => m.name));
      expect(html).not.toMatch(/\b(bg|text|ring|border)-signal/); // red stays reserved for urgency
    }
    const ph = renderToStaticMarkup(h(SignInSheet, { open: true, lang: "en", role: "pharmacist", roleLabel: "Pharmacist", onChoose: () => {} }));
    expect(ph).toContain("Pharmacist 1 · verify or return");
    expect(ph).toContain("Pharmacist 2 · final check and dispense");
    expect(renderToStaticMarkup(h(SignInSheet, { open: false, lang: "en", role: "nurse", roleLabel: "Nurse", onChoose: () => {} }))).toBe("");
  });

  it("the sheet keeps red-flag interrupts above it and animates only without reduced motion", () => {
    const html = renderToStaticMarkup(h(SignInSheet, { open: true, lang: "en", role: "nurse", roleLabel: "Nurse", onChoose: () => {} }));
    const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
    const lift = Number(css.match(/\.mx-gate\[data-blocked\] \.mx-interrupt\{position:relative;z-index:(\d+)\}/)?.[1]);
    const sheetZ = Number(html.match(/fixed inset-x-3 bottom-3 z-(\d+)/)?.[1]);
    expect(lift).toBeGreaterThan(sheetZ);
    const [outside, motion] = css.split("@media (prefers-reduced-motion:no-preference)");
    expect(outside).not.toMatch(/animation|transition|@keyframes/);
    expect(motion).toMatch(/@keyframes mx-signin-in/);
    for (const d of motion!.matchAll(/(\d+)ms/g)) {
      expect(Number(d[1])).toBeGreaterThanOrEqual(150);
      expect(Number(d[1])).toBeLessThanOrEqual(450);
    }
    expect(motion).not.toMatch(/\b(width|height|top|left|margin|padding)\s*:/); // transform and opacity only
  });

  it("the signed-out notice keeps an empty live region until the flag is seen (no flag on the server render)", () => {
    const html = renderToStaticMarkup(h(SignedOutNotice, { lang: "en" }));
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Signed out.");
  });

  it("every staff shell wires the account menu, the sign-out helper and the sign-in sheet; writing shells gate their content", () => {
    const WEB = join(__dirname, "..", "..");
    const read = (p: string) => readFileSync(join(WEB, p), "utf8");
    const shells = { clinician: "app/(clinician)/_frame.tsx", pharmacy: "app/(pharmacy)/_shell.tsx", ops: "app/(ops)/components/OpsShell.tsx" };
    for (const [name, p] of Object.entries(shells)) {
      const src = read(p);
      expect(src, name).toMatch(/<AccountMenu\b/);
      expect(src, name).toMatch(/signOut\(\)\.href/);
      expect(src, name).toMatch(/<SignInSheet\b/);
      expect(src, name).toMatch(/useIdentityGate\(/);
    }
    for (const p of [shells.clinician, shells.pharmacy]) {
      const src = read(p);
      expect(src, p).toMatch(/<IdentityGate blocked=\{gate\.needed\}/);
      expect(src, p).toMatch(/<select\b[\s\S]*?onChange=\{\(e\) => setReviewer\(e\.target\.value\)\}/); // the "Signed in as" select stays
    }
    // Orders and trace pages render inside the clinician frame, so they get the same menu and gate.
    for (const p of ["app/(orders)/layout.tsx", "app/(trace)/layout.tsx"]) expect(read(p), p).toMatch(/<ClinicianFrame\b/);
    expect(read("components/ui/AppShell.tsx")).toMatch(/\{account \?\? <Avatar/);
  });

  it("the page sign-out lands on (/demo) mounts the signed-out notice once", () => {
    const WEB = join(__dirname, "..", "..");
    expect(SIGNED_OUT_HREF.split("?")[0]).toBe("/demo");
    expect(readFileSync(join(WEB, "app/demo/page.tsx"), "utf8")).toMatch(/<DemoHub\b/);
    const hub = readFileSync(join(WEB, "app/demo/DemoHub.tsx"), "utf8");
    expect(hub.match(/<SignedOutNotice lang=\{lang\} \/>/g)).toHaveLength(1);
  });
});
