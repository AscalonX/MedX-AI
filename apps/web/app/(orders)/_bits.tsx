"use client";
import { useEffect, type ReactNode } from "react";
import type { StaffRole } from "@medx/shared";
import { useFrame } from "../(clinician)/_frame";
import type { IntakeSession, InvestigationOrder, Lang } from "@medx/shared";
import { Badge, Icon, type IconName } from "@/components/ui";
import { CaseHeader, type CaseTab } from "../_shared/CaseHeader";
import { tr, type TKey } from "./_lib";

/** Page header for vitals and orders: case tabs, title, patient code, language, stage chip, fixture badge. */
export function Head({ title, session, lang, fixture, id, active, children }: { title: string; session: IntakeSession | null; lang: Lang; fixture: boolean; id: string; active: CaseTab; children?: ReactNode }) {
  return (
    <CaseHeader
      id={id}
      active={active}
      title={title}
      lang={lang}
      session={session}
      badges={fixture ? <span title={tr("fixtureWhy", lang)}><Badge tone="pencil" icon={<Icon name="triangle-alert" size={12} />}>{tr("fixture", lang)}</Badge></span> : undefined}
      actions={children}
    />
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

/**
 * Status of an investigation order (C-05). No lab system exists in this prototype, so a sent order reads
 * "Sent (no lab system in this prototype)" and never shows a pharmacy, verified or result state.
 */
export const investigationBadge = (st: InvestigationOrder["status"], lang: "en" | "th" | "it") =>
  st === "draft" || st === "cancelled"
    ? <Badge tone="outline">{tr(st === "draft" ? "stDraft" : "stCancelled", lang)}</Badge>
    : <Badge tone="outline" icon={<Icon name="clipboard-list" size={12} />} className="h-auto! min-h-6 whitespace-normal! py-0.5 text-left"><span data-investigation-status="sent">{tr("invSent", lang)}</span></Badge>;


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
