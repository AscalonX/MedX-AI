"use client";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import type { StaffRole } from "@medx/shared";
import { useFrame } from "../(clinician)/_frame";
import type { IntakeSession, InvestigationOrder, Lang } from "@medx/shared";
import { Badge, Icon, type IconName } from "@/components/ui";
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

const ORDER_TONE = { draft: "outline", submitted: "ocean", verified: "teal", returned: "pencil", dispensed: "teal", cancelled: "outline" } as const;
const ORDER_KEY: Record<InvestigationOrder["status"], TKey> = { draft: "stDraft", submitted: "stSubmitted", verified: "stVerified", returned: "stReturned", dispensed: "stDispensed", cancelled: "stCancelled" };
// Verified (pharmacist 1) and dispensed (pharmacist 2) share the "done" tone, so each carries its own icon.
const ORDER_ICON: Partial<Record<InvestigationOrder["status"], IconName>> = { verified: "check", dispensed: "circle-check", returned: "pencil" };
export const statusBadge = (st: InvestigationOrder["status"], lang: "en" | "th" | "it") => {
  const icon = ORDER_ICON[st];
  return <Badge tone={ORDER_TONE[st]} icon={icon ? <Icon name={icon} size={12} /> : undefined}>{tr(ORDER_KEY[st], lang)}</Badge>;
};


/** Frame state; role and person are restored by ClinicianFrame (read first, write only on an explicit choice). `ready` is true once storage was read. */
export function useIdentity(title: string) {
  const f = useFrame();
  useEffect(() => { document.title = `${title} | MedX`; }, [title]);
  return { ...f, role: f.clinicianRole as StaffRole, ready: f.restored };
}

export const ReadOnlyNote = ({ children }: { children: ReactNode }) => (
  <p className="mb-4 rounded-2xl border-l-4 border-ocean bg-ocean-tint px-4 py-2 text-body font-semibold text-ocean">{children}</p>
);
export const noDash = (s: string) => s.replace(/ [—–] /g, ", ");
