"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { OpsMetrics } from "@medx/shared";
import { Card, CardHeader, GradientHero, Icon, StatTile } from "@/components/ui";
import { ClinicianFrame, useFrame } from "./(clinician)/_frame";
import { tr, type TKey } from "./(clinician)/review/_i18n";

const pill =
  "inline-flex h-11 items-center gap-2 rounded-full bg-sheet px-5 text-body font-semibold text-ocean shadow-[0_8px_16px_-10px_rgba(0,0,0,0.4)] transition-transform duration-quick ease-pen active:scale-[0.97]";

function Landing() {
  const { lang } = useFrame();
  const [m, setM] = useState<OpsMetrics | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const load = () =>
      fetch("/api/metrics", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: OpsMetrics) => { setM(d); setFailed(false); })
        .catch(() => setFailed(true));
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);
  const roles: { href: string; key: TKey; icon: "clipboard-list" | "pill" | "activity" }[] = [
    { href: "/review", key: "roleClinician", icon: "clipboard-list" },
    { href: "/pharmacy", key: "rolePharmacist", icon: "pill" },
    { href: "/ops", key: "roleOps", icon: "activity" },
  ];
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <GradientHero
        className="cl-enter"
        title={<span className="text-[28px] font-extrabold">{tr("landTitle", lang)}</span>}
        subtitle={tr("landSub", lang)}
        action={roles.map((r) => (
          <Link key={r.href} href={r.href} className={pill}>
            <Icon name={r.icon} size={18} />
            {tr(r.key, lang)}
          </Link>
        ))}
      />

      <section aria-label={tr("landStats", lang)} className="grid grid-cols-1 gap-4 min-[700px]:grid-cols-3">
        <StatTile label={tr("statSessionsToday", lang)} value={m ? m.sessionsToday : null} tone="ocean" icon={<Icon name="clipboard-list" size={16} />} />
        <StatTile label={tr("statEscalated", lang)} value={m ? m.escalations : null} tone={m && m.escalations ? "signal" : "default"} icon={<Icon name="triangle-alert" size={16} />} />
        <StatTile label={tr("statAwaiting", lang)} value={m ? m.byStatus.awaiting_review : null} tone="teal" icon={<Icon name="clock" size={16} />} />
      </section>
      {failed && <p role="status" className="text-small text-ink-soft">{tr("statsUnavailable", lang)}</p>}

      <Card className="cl-enter flex flex-wrap items-center gap-5">
        <div className="grid size-28 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-rule-strong/60 bg-paper p-2 text-center text-micro text-graphite">
          {tr("qrPlaceholder", lang)}
        </div>
        <div className="min-w-[240px] flex-1">
          <CardHeader title={tr("patientApp", lang)} className="!mb-1" />
          <p className="max-w-[52ch] text-body text-ink-soft">{tr("patientAppBody", lang)}</p>
          <Link href="/review" className="mt-3 inline-flex items-center gap-1 text-small font-semibold text-ocean underline-offset-4 hover:underline">
            {tr("openReviewDemo", lang)}
            <Icon name="chevron-right" size={14} />
          </Link>
        </div>
      </Card>
      <p className="text-micro text-graphite">{tr("decisionSupportShort", lang)}</p>
    </div>
  );
}

export default function Home() {
  return (
    <ClinicianFrame active="home">
      <Landing />
    </ClinicianFrame>
  );
}
