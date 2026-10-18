"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Lang } from "@medx/shared";
import { ROLE_STORAGE_KEY, staffFor } from "@medx/shared/src/staff";
import { Button, Card, GradientHero, Icon, LangMorph, type ShellRole } from "@/components/ui";
import { copy, locale, statusCopy } from "../i18n";
import { StatusChart, LatencyChart } from "./Charts";
import { Blank, Escalations, Queue } from "./Queue";
import { highAlertsOpen, pendingEscalations } from "../ops-data";
import { CountUp } from "./CountUp";
import { OpsShell } from "./OpsShell";
import { PharmacyFlow } from "./PharmacyFlow";
import { MetricStrip, ProviderPill, ProviderPlate } from "./SystemLedger";
import { useOpsSnapshot } from "./useOpsSnapshot";
import styles from "../ops.module.css";

/** Same key every surface uses for the UI language (clinician, pharmacy, orders). */
const LANG_KEY = "medx.lang";
const OPS_NAME = staffFor("ops")[0]?.name;

export function OpsDashboard() {
  const [lang, setLangState] = useState<Lang>("en");
  const router = useRouter();
  const { snapshot, error, refreshing, retry } = useOpsSnapshot();
  const pending = snapshot ? pendingEscalations(snapshot.sessions) : [];
  const date = snapshot ? new Intl.DateTimeFormat(locale[lang], { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(snapshot.fetchedAt) : null;
  const time = snapshot ? new Intl.DateTimeFormat(locale[lang], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(snapshot.fetchedAt) : null;
  // Restore the shared language first; write it only on an explicit choice. Share role + identity with the other
  // surfaces (packages/shared/src/staff.ts keys).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "th" || saved === "it" || saved === "en") setLangState(saved);
      localStorage.setItem(ROLE_STORAGE_KEY, "ops");
      // Identity comes from OpsShell's sign-in sheet; writing it here would undo a sign-out on reload.
    } catch { /* storage blocked: English default, nothing to persist */ }
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* storage blocked: this page only */ }
  };
  const changeRole = (role: ShellRole) => {
    if (role === "ops") return;
    try { localStorage.setItem(ROLE_STORAGE_KEY, role); if (role === "nurse" || role === "doctor") localStorage.setItem("medx.clinicianRole", role); } catch { /* storage blocked */ }
    router.push(role === "pharmacist" ? "/pharmacy" : "/review");
  };
  return (
    <div className={styles.desk} lang={lang}>
      <OpsShell onRoleChange={changeRole} lang={lang} onLangChange={setLang} userName={OPS_NAME} rows={snapshot?.sessions ?? null}>
        <div className={styles.board}>
          <div className={styles.pageHeading}>
            <div><h1><LangMorph text={copy.title} lang={lang} /></h1><p>{date ?? <Blank label={copy.loading[lang]} />}</p></div>
            <div className={styles.sync}><Icon name="clock" size={16} /><span><LangMorph text={copy.lastUpdated} lang={lang} /> {time ?? <Blank label={copy.unavailable[lang]} />} <span lang="en">ICT</span></span></div>
          </div>
          <p className={styles.disclosure}><Icon name="shield-check" size={16} /><LangMorph text={copy.notice} lang={lang} /></p>
          <div className={styles.refreshBar}>
            <p><LangMorph text={error && snapshot ? copy.stale : copy.live} lang={lang} /></p>
            <Button variant="quiet" size="sm" onClick={retry} disabled={refreshing} icon={<Icon name="rotate-ccw" size={14} />}><LangMorph text={refreshing ? copy.refreshing : copy.refresh} lang={lang} /></Button>
          </div>
          {error && <Card className={styles.error} role="alert"><div><p><LangMorph text={copy.error} lang={lang} /></p>{snapshot && <p className={styles.note}><LangMorph text={copy.stale} lang={lang} /></p>}</div><Button onClick={retry} disabled={refreshing}><LangMorph text={copy.retry} lang={lang} /></Button></Card>}
          {snapshot ? <>
            <GradientHero title={<LangMorph text={copy.frontDesk} lang={lang} />}
              action={pending[0] ? <Link className={styles.heroLink} href={`/review/${encodeURIComponent(pending[0].id)}`}><LangMorph text={copy.openOldest} lang={lang} /><span className="sr-only"> {pending[0].code}</span><Icon name="arrow-right" size={18} /></Link> : <p className={styles.heroCalm}><Icon name="circle-check" size={18} /><LangMorph text={copy.allAcknowledged} lang={lang} /></p>}>
              <div className={styles.heroTop}>
                <div className={styles.heroCount}><p className={`${styles.heroNumber} ${pending.length > 0 ? styles.heroUrgent : ""}`}><CountUp value={pending.length} lang={lang} /></p><p><LangMorph text={copy.pendingEscalations} lang={lang} /></p></div>
                <ProviderPill health={snapshot.health} lang={lang} />
              </div>
              <dl className={styles.heroStats}>
                <div><dt><LangMorph text={statusCopy.awaiting_review} lang={lang} /></dt><dd><CountUp value={snapshot.metrics.byStatus.awaiting_review} lang={lang} /></dd></div>
                <div><dt><LangMorph text={copy.pharmacyAlerts} lang={lang} /><span className="sr-only">. {copy.pharmacyAlertsNote[lang]}</span></dt><dd><CountUp value={highAlertsOpen(snapshot.sessions)} lang={lang} /></dd></div>
                <div><dt><LangMorph text={copy.sessionsToday} lang={lang} /></dt><dd><CountUp value={snapshot.metrics.sessionsToday} lang={lang} /></dd></div>
              </dl>
            </GradientHero>
            <PharmacyFlow metrics={snapshot.metrics} sessions={snapshot.sessions} now={snapshot.fetchedAt} lang={lang} />
            <MetricStrip metrics={snapshot.metrics} health={snapshot.health} lang={lang} />
            <Escalations sessions={snapshot.sessions} lang={lang} />
            <Queue sessions={snapshot.sessions} now={snapshot.fetchedAt} lang={lang} />
            <div className={styles.charts}><StatusChart sessions={snapshot.sessions} lang={lang} /><LatencyChart sessions={snapshot.sessions} metrics={snapshot.metrics} health={snapshot.health} lang={lang} /></div>
            <ProviderPlate health={snapshot.health} lang={lang} />
          </> : !error && <Card className={styles.loading} aria-busy="true" aria-label={copy.loading[lang]}><p role="status"><LangMorph text={copy.loading} lang={lang} /></p><div aria-hidden="true" className={styles.loadingLines}>{Array.from({ length: 6 }, (_, i) => <div key={i} className="mx-skeleton" />)}</div></Card>}
          <footer className={styles.footer}><p><LangMorph text={copy.footer} lang={lang} /></p><span lang="en">MedX · ACT III</span></footer>
        </div>
      </OpsShell>
    </div>
  );
}
