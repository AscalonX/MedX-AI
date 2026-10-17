"use client";
import Link from "next/link";
import type { ReactNode } from "react";
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

