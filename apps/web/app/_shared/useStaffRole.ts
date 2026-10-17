"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ROLE_STORAGE_KEY } from "@medx/shared/src/staff";

/**
 * One place for the clinician role (nurse or doctor) kept in localStorage.
 * Rule: RESTORE first, WRITE only on an explicit user choice. Never write the default.
 * ROLE_STORAGE_KEY is the latest explicit choice on any surface (it may also hold "pharmacist" or "ops");
 * CLINICIAN_ROLE_KEY remembers the last nurse/doctor so leaving for pharmacy or ops does not lose it.
 */
export type ClinicianRole = "nurse" | "doctor";
export const CLINICIAN_ROLE_KEY = "medx.clinicianRole";

export function readClinicianRole(): ClinicianRole {
  try {
    const latest = localStorage.getItem(ROLE_STORAGE_KEY);
    if (latest === "nurse" || latest === "doctor") return latest;
    const last = localStorage.getItem(CLINICIAN_ROLE_KEY);
    if (last === "nurse" || last === "doctor") return last;
  } catch { /* storage blocked: default below */ }
  return "nurse";
}

export function writeClinicianRole(r: ClinicianRole) {
  try { localStorage.setItem(CLINICIAN_ROLE_KEY, r); localStorage.setItem(ROLE_STORAGE_KEY, r); } catch { /* nothing to persist */ }
}

/** `restored` turns true once storage has been read, so screens can avoid acting on the default role. */
export function useStaffRole() {
  const [role, setRoleState] = useState<ClinicianRole>("nurse");
  const [restored, setRestored] = useState(false);
  const chosen = useRef(false);
  useEffect(() => {
    if (!chosen.current) setRoleState(readClinicianRole());
    setRestored(true);
  }, []);
  const setRole = useCallback((r: ClinicianRole) => { chosen.current = true; setRoleState(r); writeClinicianRole(r); }, []);
  return { role, setRole, restored };
}

/** Greeting from the viewer's local clock. */
export function greetingFor(lang: "th" | "it" | "en", hour: number): string {
  const part = hour < 12 ? 0 : hour < 18 ? 1 : 2;
  return {
    en: ["Good morning", "Good afternoon", "Good evening"],
    it: ["Buongiorno", "Buon pomeriggio", "Buonasera"],
    th: ["อรุณสวัสดิ์", "สวัสดียามบ่าย", "สวัสดียามเย็น"],
  }[lang][part];
}
