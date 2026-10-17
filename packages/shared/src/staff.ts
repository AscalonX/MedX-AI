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

/** localStorage keys shared by all web surfaces so role + identity persist across pages. */
export const ROLE_STORAGE_KEY = "medx.role";
export const reviewerStorageKey = (role: StaffRole) => `medx.reviewer.${role}`;
