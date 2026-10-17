"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
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
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = `${window.location.origin}/patient/`;
    setUrl(u);
    QRCode.toString(u, { type: "svg", margin: 1, color: { dark: "#0F1E2E", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(null));
  }, []);
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
        <figure className="m-0 flex shrink-0 flex-col items-center gap-1">
          {qr ? (
            <div role="img" aria-label={`${tr("landSubQr", lang)}: ${url}`} className="size-32 overflow-hidden rounded-2xl border border-rule/70 bg-sheet p-1 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
          ) : (
            <span className="mx-skeleton !size-32" aria-hidden="true" />
          )}
          <figcaption className="max-w-[10rem] text-center text-micro text-ink-soft">{tr("landSubQr", lang)}</figcaption>
        </figure>
        <div className="min-w-[240px] flex-1">
          <CardHeader title={tr("patientApp", lang)} className="!mb-1" />
          <p className="max-w-[52ch] text-body text-ink-soft">{tr("patientAppBody", lang)}</p>
          <p className="mt-1 text-small font-semibold text-ink">{tr("tryIt", lang)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a href="/patient/" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary-gradient px-5 text-small font-semibold text-on-primary shadow-[0_10px_18px_-10px_rgba(26,95,196,0.8)]">{tr("openPatientApp", lang)}</a>
            <Link href="/review" className="inline-flex items-center gap-1 text-small font-semibold text-ocean underline-offset-4 hover:underline">
              {tr("openReviewDemo", lang)}
              <Icon name="chevron-right" size={14} />
            </Link>
          </div>
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
