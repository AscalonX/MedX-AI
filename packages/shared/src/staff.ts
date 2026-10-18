// Demo staff directory (synthetic). One source of truth for every reviewer selector.
// Staff identities are never patient data: the pipeline must not redact these strings.
export type StaffRole = "nurse" | "doctor" | "pharmacist" | "ops";

export interface StaffMember { id: string; role: StaffRole; name: string }

export const STAFF: StaffMember[] = [
  { id: "nurse-rossi", role: "nurse", name: "Nurse Anna Rossi" },
  { id: "nurse-kanya", role: "nurse", name: "Nurse Kanya Srisuk" },
  { id: "doctor-bianchi", role: "doctor", name: "Dr. Marco Bianchi" },
  { id: "doctor-chaiyo", role: "doctor", name: "Dr. Somchai Chaiyo" },
  { id: "pharm-conti", role: "pharmacist", name: "Pharmacist Laura Conti" },
  { id: "pharm-wong", role: "pharmacist", name: "Pharmacist Nattaya Wong" },
  { id: "ops-head", role: "ops", name: "Head Nurse Elena Greco" },
];

export const staffFor = (role: StaffRole) => STAFF.filter(s => s.role === role);
export const isStaffName = (value: string) => STAFF.some(s => s.name === value);

const staffKey = (value: string) => value.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
/**
 * The demo staff member an actor string names: matched by display name or id, ignoring case and extra spaces
 * ("Pharmacist Laura Conti", "pharm-conti"). undefined for anyone not in STAFF (synthetic test reviewers, typos).
 */
export function staffMemberOf(actor: unknown): StaffMember | undefined {
  if (typeof actor !== "string" || !actor.trim()) return undefined;
  const key = staffKey(actor);
  return STAFF.find(s => staffKey(s.name) === key || staffKey(s.id) === key);
}
/** Role of a STAFF member named by display name or id; undefined for unknown actors. */
export const roleOf = (actor: unknown): StaffRole | undefined => staffMemberOf(actor)?.role;

/**
 * Who may perform each clinical write; the server enforces it (403), the UI may use it to disable controls.
 * vitals + triage confirm: nurse. Orders (medication, investigation, submit, cancel) and consult note sign: doctor.
 * Pharmacy verify/return, dispense, pickup and medicine reconciliation: pharmacist.
 */
export const WRITE_ROLES = {
  vitals: ["nurse"],
  triage: ["nurse"],
  orders: ["doctor"],
  sign: ["doctor"],
  pharmacy: ["pharmacist"],
} as const satisfies Record<string, readonly StaffRole[]>;

/** localStorage keys shared by all web surfaces so role + identity persist across pages. */
export const ROLE_STORAGE_KEY = "medx.role";
export const reviewerStorageKey = (role: StaffRole) => `medx.reviewer.${role}`;
