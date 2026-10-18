// Staff sign-in / sign-out for the demo (w20). There is no real authentication in this prototype by design: the
// "accounts" are the synthetic demo identities in packages/shared/src/staff.ts, kept in localStorage so every write is
// attributed to the person on screen. Pure helpers (unit tested); the components only wire them to the browser.
import { ROLE_STORAGE_KEY, reviewerStorageKey, staffFor, type Lang, type Localized, type StaffRole } from "@medx/shared";
import { DEMO_CASE_KEY, DEMO_PERSONA_KEY } from "./demoPersona";
import { CLINICIAN_ROLE_KEY } from "./useStaffRole";

export const STAFF_ROLES: readonly StaffRole[] = ["nurse", "doctor", "pharmacist", "ops"];

/** "Switch role" opens the persona hub; sign-out lands there too, with a small notice. */
export const SWITCH_ROLE_HREF = "/demo";
export const SIGNED_OUT_PARAM = "signedOut";
export const SIGNED_OUT_HREF = `${SWITCH_ROLE_HREF}?${SIGNED_OUT_PARAM}=1`;

/**
 * Every localStorage key that says who this browser is signed in as: the shared role, the last nurse/doctor role,
 * the per-role reviewer name, and the demo persona and case written by the persona flow. The UI language
 * (medx.lang) and per-viewer conveniences (medx.pharmacy.tab) are preferences, not identity, and are kept.
 */
export const IDENTITY_KEYS: readonly string[] = [
  ROLE_STORAGE_KEY,
  CLINICIAN_ROLE_KEY,
  ...STAFF_ROLES.map(reviewerStorageKey),
  DEMO_PERSONA_KEY,
  DEMO_CASE_KEY,
];
/** Any other key under these prefixes is identity too (a reviewer key for a role added later, a new demo key). */
export const IDENTITY_PREFIXES: readonly string[] = ["medx.reviewer.", "medx.demo."];
/**
 * sessionStorage: clinical context the signed-in person confirmed in this tab (the consult's "patient agreed to
 * recording" switch, per case). The next person to sign in must confirm it again.
 */
const SESSION_CONTEXT_PREFIXES = ["medx.consult.consent."];

type Removable = Pick<Storage, "removeItem"> & Partial<Pick<Storage, "key" | "length">>;
type Readable = Pick<Storage, "getItem">;

const browserStore = (kind: "localStorage" | "sessionStorage"): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window[kind];
  } catch {
    return null; // storage blocked (private mode, sandboxed preview)
  }
};

export const isIdentityKey = (key: string | null): boolean =>
  key === null /* storage.clear() */ || IDENTITY_KEYS.includes(key) || IDENTITY_PREFIXES.some((p) => key.startsWith(p));

function keysWithPrefix(storage: Removable, prefixes: readonly string[]): string[] {
  const out: string[] = [];
  try {
    const n = typeof storage.length === "number" ? storage.length : 0;
    for (let i = 0; i < n; i++) {
      const k = storage.key?.(i);
      if (k && prefixes.some((p) => k.startsWith(p))) out.push(k);
    }
  } catch {
    /* enumeration blocked: the fixed keys are still removed */
  }
  return out;
}

function removeAll(storage: Removable, keys: string[]): string[] {
  for (const k of keys) {
    try {
      storage.removeItem(k);
    } catch {
      /* storage blocked: nothing was persisted there */
    }
  }
  return keys;
}

/** Removes every MedX identity key (fixed list plus any key under an identity prefix). Returns the keys removed. */
export function clearIdentity(storage: Removable | null = browserStore("localStorage")): string[] {
  if (!storage) return [];
  return removeAll(storage, [...new Set([...IDENTITY_KEYS, ...keysWithPrefix(storage, IDENTITY_PREFIXES)])]);
}

/** Removes the tab's confirmed clinical context (sessionStorage). Returns the keys removed. */
export function clearSessionContext(storage: Removable | null = browserStore("sessionStorage")): string[] {
  if (!storage) return [];
  return removeAll(storage, keysWithPrefix(storage, SESSION_CONTEXT_PREFIXES));
}

/**
 * Sign out: forget who this browser is (localStorage identity keys) and the tab's confirmed clinical context
 * (sessionStorage), then go to `href` (the persona hub with the "Signed out" notice). Nothing is sent to the server:
 * demo identities have no server session, and the audit log already holds every write with its actor.
 */
export function signOut(stores: { local?: Removable | null; session?: Removable | null } = {}): { href: string; cleared: string[] } {
  const local = "local" in stores ? stores.local ?? null : browserStore("localStorage");
  const session = "session" in stores ? stores.session ?? null : browserStore("sessionStorage");
  return { href: SIGNED_OUT_HREF, cleared: [...clearIdentity(local), ...clearSessionContext(session)] };
}

/** The stored identity for a role: a STAFF name of that role, else null (missing, another role's name, a typo). */
export function storedIdentity(role: StaffRole, storage: Readable | null = browserStore("localStorage")): string | null {
  try {
    const v = storage?.getItem(reviewerStorageKey(role));
    return v && staffFor(role).some((m) => m.name === v) ? v : null;
  } catch {
    return null;
  }
}

/** Remember an explicit choice, exactly like the "Signed in as" select: the per-role reviewer key. */
export function rememberIdentity(role: StaffRole, name: string, storage: Pick<Storage, "setItem"> | null = browserStore("localStorage")): boolean {
  if (!staffFor(role).some((m) => m.name === name)) return false;
  try {
    storage?.setItem(reviewerStorageKey(role), name);
    return !!storage;
  } catch {
    return false; // blocked: the choice holds in memory for this page
  }
}

/** True when the URL asks for the "Signed out" notice. */
export const signedOutRequested = (search: string): boolean => new URLSearchParams(search).get(SIGNED_OUT_PARAM) === "1";

/** The same path, query (minus the notice flag) and hash, for history.replaceState after the notice shows. */
export function stripSignedOut(href: string): string {
  const u = new URL(href, "http://medx.local");
  u.searchParams.delete(SIGNED_OUT_PARAM);
  return `${u.pathname}${u.search}${u.hash}`;
}

// ---- Write gate: before anyone has signed in, actions are blocked; reading (scroll, links, tabs) is not.

/** The parts of a DOM element the gate looks at (plain objects in tests). */
export interface NodeLike {
  tagName?: string;
  getAttribute?(name: string): string | null;
  parentElement?: NodeLike | null;
}
const ACTION_ROLES = new Set(["button", "menuitem", "checkbox", "switch"]);
const READ_ROLES = new Set(["link", "tab", "radio", "option"]);
const INTERACTIVE_TAGS = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"]);
const ACTION_INPUTS = new Set(["submit", "button", "image", "reset"]);

/**
 * The control a click would activate, when that control is an action (a write, or the start of one); null when the
 * click reads (a link, a tab or segment, a disclosure or drawer toggle, a text field or a select) or hits no control.
 * Conservative on purpose: any other button is treated as a write until someone has signed in.
 */
export function guardedControl(target: NodeLike | null | undefined): NodeLike | null {
  for (let el: NodeLike | null | undefined = target; el; el = el.parentElement) {
    const tag = el.tagName?.toUpperCase() ?? "";
    const role = el.getAttribute?.("role") ?? null;
    if (!INTERACTIVE_TAGS.has(tag) && !(role && (ACTION_ROLES.has(role) || READ_ROLES.has(role)))) continue;
    const has = (n: string) => el!.getAttribute?.(n) != null;
    if ((tag === "A" && has("href")) || (role && READ_ROLES.has(role))) return null;
    if (has("aria-expanded") || has("aria-controls") || has("aria-haspopup") || has("data-gate-allow")) return null;
    if (tag === "SUMMARY" || tag === "SELECT" || tag === "TEXTAREA") return null;
    if (tag === "INPUT") return ACTION_INPUTS.has((el.getAttribute?.("type") ?? "text").toLowerCase()) ? el : null;
    if (tag === "A") return role === "button" || role === "menuitem" ? el : null; // an anchor without href acting as a button
    return el; // <button>, role=button/menuitem/checkbox/switch
  }
  return null;
}

/** Enter in a text field submits or runs a handler (place an order, add a line): blocked before sign-in. */
export function guardedKey(e: { key: string; shiftKey?: boolean; target?: unknown }): boolean {
  if (e.key !== "Enter" || e.shiftKey) return false;
  const tag = (e.target as NodeLike | null | undefined)?.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA";
}

// ---- Copy (Thai and Italian need native-speaker review, like the rest of the staff chrome).

const L = (en: string, th: string, it: string): Localized => ({ en, th, it });

export const ACCOUNT_COPY = {
  menuFor: L("Account menu, {name}", "เมนูบัญชี {name}", "Menu account, {name}"),
  signedInAs: L("Signed in as", "ลงชื่อเข้าใช้เป็น", "Accesso come"),
  notSignedIn: L("Not signed in", "ยังไม่ได้ลงชื่อเข้าใช้", "Accesso non effettuato"),
  demoIdentity: L("Demo identity · synthetic staff", "ตัวตนสำหรับการสาธิต · บุคลากรสมมุติ", "Identità demo · personale sintetico"),
  chooseIdentity: L("Choose who is signing in", "เลือกผู้ที่ลงชื่อเข้าใช้", "Scelga chi accede"),
  choosePlaceholder: L("Choose…", "เลือก…", "Scelga…"),
  switchRole: L("Switch role", "เปลี่ยนบทบาท", "Cambia ruolo"),
  signOut: L("Sign out", "ออกจากระบบ", "Esci"),
  signedOut: L("Signed out.", "ออกจากระบบแล้ว", "Disconnesso."),
  signedOutBody: L(
    "Your demo identity was cleared from this browser. Pick a role to continue.",
    "ล้างตัวตนสำหรับการสาธิตออกจากเบราว์เซอร์นี้แล้ว เลือกบทบาทเพื่อทำต่อ",
    "La sua identità demo è stata rimossa da questo browser. Scelga un ruolo per continuare.",
  ),
  dismiss: L("Dismiss", "ปิด", "Chiudi"),
  sheetTitle: L("Who's signing in?", "ใครกำลังลงชื่อเข้าใช้", "Chi sta accedendo?"),
  sheetBody: L(
    "Choose your demo identity. Every change on this screen is recorded under this name in the audit log.",
    "เลือกตัวตนสำหรับการสาธิต ทุกการเปลี่ยนแปลงบนหน้านี้จะบันทึกในบันทึกการตรวจสอบด้วยชื่อนี้",
    "Scelga la sua identità demo. Ogni modifica in questa schermata viene registrata a questo nome nel registro di audit.",
  ),
  sheetNote: L(
    "Synthetic staff only. This prototype has no real accounts or passwords.",
    "บุคลากรสมมุติเท่านั้น ต้นแบบนี้ไม่มีบัญชีหรือรหัสผ่านจริง",
    "Solo personale sintetico. Questo prototipo non ha account né password reali.",
  ),
  sheetBlocked: L("Choose who is signing in before making changes.", "กรุณาเลือกผู้ที่ลงชื่อเข้าใช้ก่อนทำการเปลี่ยนแปลง", "Scelga chi accede prima di apportare modifiche."),
  minimize: L("Hide for now", "ซ่อนไว้ก่อน", "Nascondi per ora"),
  otherRole: L("Another role", "บทบาทอื่น", "Un altro ruolo"),
} satisfies Record<string, Localized>;
export type AccountKey = keyof typeof ACCOUNT_COPY;
export const at = (k: AccountKey, lang: Lang, v: Record<string, string | number> = {}) =>
  ACCOUNT_COPY[k][lang].replace(/\{(\w+)\}/g, (_, x: string) => String(v[x] ?? ""));

/** Second line under a name in the sheet, where one role has two jobs in the demo. */
const STAFF_HINT: Partial<Record<string, Localized>> = {
  "pharm-conti": L("Pharmacist 1 · verify or return", "เภสัชกรคนที่ 1 · ยืนยันหรือส่งคืน", "Farmacista 1 · verifica o restituzione"),
  "pharm-wong": L("Pharmacist 2 · final check and dispense", "เภสัชกรคนที่ 2 · ตรวจซ้ำขั้นสุดท้ายและจ่ายยา", "Farmacista 2 · controllo finale e dispensazione"),
};

/** The people who can sign in for a role (STAFF order), with an optional localized hint. */
export function staffChoices(role: StaffRole): { id: string; name: string; hint?: Localized }[] {
  return staffFor(role).map((m) => ({ id: m.id, name: m.name, ...(STAFF_HINT[m.id] ? { hint: STAFF_HINT[m.id] } : {}) }));
}
