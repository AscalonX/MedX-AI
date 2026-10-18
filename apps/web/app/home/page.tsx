"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { OpsMetrics } from "@medx/shared";
import { color } from "@medx/shared/src/tokens";
import { Card, CardHeader, GradientHero, Icon, StatTile, type IconName } from "@/components/ui";
import { ClinicianFrame, useFrame } from "../(clinician)/_frame";
import { tr, type TKey } from "../(clinician)/review/_i18n";

// Staff home (wave 20: moved here from "/", which is now the marketing landing). Unchanged behaviour:
// live counts from /api/metrics, the patient QR and the journey summary, inside the clinician frame.

/** The visit as one synced case: who acts at each step. Rules and models only suggest; people decide. */
const JOURNEY: { title: TKey; body: TKey; icon: IconName }[] = [
  { title: "jPatient", body: "jPatientBody", icon: "mic" },
  { title: "jNurse", body: "jNurseBody", icon: "activity" },
  { title: "jDoctor", body: "jDoctorBody", icon: "clipboard-list" },
  { title: "jPharm1", body: "jPharm1Body", icon: "pill" },
  { title: "jPharm2", body: "jPharm2Body", icon: "bell" },
];

const pill =
  "inline-flex h-11 items-center gap-2 rounded-full bg-sheet px-5 text-body font-semibold text-ocean shadow-[0_8px_16px_-10px_rgba(0,0,0,0.4)] transition-transform duration-quick ease-pen active:scale-[0.97]";

function StaffHome() {
  const { lang } = useFrame();
  const [m, setM] = useState<OpsMetrics | null>(null);
  const [failed, setFailed] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = `${window.location.origin}/patient/`;
    setUrl(u);
    QRCode.toString(u, { type: "svg", margin: 1, color: { dark: color.ink, light: color.sheet } }).then(setQr).catch(() => setQr(null));
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
      {/* No Fin here: the stat row below turns the Escalated tile red, and Fin never sits beside a red alert (DIRECTION.md 11). */}
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

      <section aria-label={tr("landStats", lang)} className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 min-[1000px]:grid-cols-4">
        <StatTile label={tr("statSessionsToday", lang)} value={m ? m.sessionsToday : null} emptyLabel={tr("noDataYet", lang)} tone="ocean" icon={<Icon name="clipboard-list" size={16} />} />
        <StatTile label={tr("statEscalated", lang)} value={m ? m.escalations : null} emptyLabel={tr("noDataYet", lang)} tone={m && m.escalations ? "signal" : "default"} icon={<Icon name="triangle-alert" size={16} />} />
        <StatTile label={tr("statAwaiting", lang)} value={m ? m.byStatus.awaiting_review : null} emptyLabel={tr("noDataYet", lang)} tone="teal" icon={<Icon name="clock" size={16} />} />
        <StatTile label={tr("statReadyPickup", lang)} value={m?.pharmacy ? m.pharmacy.readyForPickup : null} emptyLabel={tr("noDataYet", lang)} icon={<Icon name="pill" size={16} />} />
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
      <Card className="cl-enter" aria-labelledby="journey-title" role="region">
        <h2 id="journey-title" className="text-lead font-bold text-ink">{tr("journeyTitle", lang)}</h2>
        <p className="mt-1 max-w-[70ch] text-body text-ink-soft">{tr("journeyBody", lang)}</p>
        <ol className="mt-4 grid grid-cols-1 gap-3 min-[700px]:grid-cols-2 min-[1024px]:grid-cols-5">
          {JOURNEY.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-2 rounded-2xl bg-paper p-4">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-ocean-tint text-ocean"><Icon name={step.icon} size={16} /></span>
                <span className="text-micro font-semibold tabular-nums text-ink-soft">{i + 1}</span>
              </span>
              <h3 className="text-body font-bold text-ink">{tr(step.title, lang)}</h3>
              <p className="text-small text-ink-soft">{tr(step.body, lang)}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-small font-semibold text-ink">{tr("journeyFoot", lang)}</p>
      </Card>
      <p className="text-micro text-graphite">{tr("decisionSupportShort", lang)}</p>
    </div>
  );
}

export default function StaffHomePage() {
  return (
    <ClinicianFrame active="home">
      <StaffHome />
    </ClinicianFrame>
  );
}
