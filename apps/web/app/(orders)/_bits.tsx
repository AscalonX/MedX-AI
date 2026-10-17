"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ROLE_STORAGE_KEY, isStaffName, reviewerStorageKey, staffFor, type StaffRole } from "@medx/shared";
import { useFrame } from "../(clinician)/_frame";
import type { IntakeSession, InvestigationOrder, Lang } from "@medx/shared";
import { Badge, Icon } from "@/components/ui";
import { tr, type TKey } from "./_lib";

/** Page header: patient code, back link, fixture badge. */
export function Head({ title, session, lang, fixture, id, children }: { title: string; session: IntakeSession | null; lang: Lang; fixture: boolean; id: string; children?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <Link href={`/review/${id}`} className="text-small font-semibold text-ocean hover:underline">{tr("backToCase", lang)}</Link>
        <h1 className="text-title font-bold text-ink">
          {title}
          {session && <span className="ml-3 text-lead font-semibold text-ink-soft">{tr("patient", lang)} {session.code}</span>}
        </h1>
      </div>
      {fixture && <span title={tr("fixtureWhy", lang)}><Badge tone="pencil" icon={<Icon name="triangle-alert" size={12} />}>{tr("fixture", lang)}</Badge></span>}
      {children}
    </header>
  );
}

export const Notice = ({ children }: { children: ReactNode }) => (
  <p role="alert" className="mb-3 rounded-2xl bg-signal-tint px-4 py-2 text-small font-semibold text-signal">{children}</p>
);

const ORDER_TONE = { draft: "outline", submitted: "ocean", verified: "teal", returned: "pencil", cancelled: "outline" } as const;
const ORDER_KEY: Record<InvestigationOrder["status"], TKey> = { draft: "stDraft", submitted: "stSubmitted", verified: "stVerified", returned: "stReturned", cancelled: "stCancelled" };
export const statusBadge = (st: InvestigationOrder["status"], lang: "en" | "th" | "it") => <Badge tone={ORDER_TONE[st]}>{tr(ORDER_KEY[st], lang)}</Badge>;


const ROLES: StaffRole[] = ["nurse", "doctor", "pharmacist", "ops"];
/** Frame state plus role/person persisted in localStorage (shared keys from staff.ts). `role` may be pharmacist/ops (read-only here). */
export function useIdentity(title: string) {
  const f = useFrame();
  const [stored, setStored] = useState<StaffRole | null>(null);
  const [ready, setReady] = useState(false);
  const skip = useRef(true);
  useEffect(() => {
    document.title = `${title} | MedX`;
    try {
      const r = localStorage.getItem(ROLE_STORAGE_KEY) as StaffRole | null;
      if (r && ROLES.includes(r)) {
        setStored(r);
        if (r === "nurse" || r === "doctor") {
          f.setClinicianRole(r);
          const n = localStorage.getItem(reviewerStorageKey(r));
          if (n && staffFor(r).some((s) => s.name === n)) f.setReviewer(n);
        }
      }
    } catch { /* private mode */ }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!ready) return;
    if (skip.current) { skip.current = false; return; }
    setStored(f.clinicianRole);
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, f.clinicianRole);
      if (isStaffName(f.reviewer) && staffFor(f.clinicianRole).some((s) => s.name === f.reviewer)) localStorage.setItem(reviewerStorageKey(f.clinicianRole), f.reviewer);
    } catch { /* ignore */ }
  }, [ready, f.clinicianRole, f.reviewer]);
  return { ...f, role: (stored ?? f.clinicianRole) as StaffRole, ready };
}

export const ReadOnlyNote = ({ children }: { children: ReactNode }) => (
  <p className="mb-4 rounded-2xl border-l-4 border-ocean bg-ocean-tint px-4 py-2 text-body font-semibold text-ocean">{children}</p>
);
export const noDash = (s: string) => s.replace(/ [—–] /g, ", ");
