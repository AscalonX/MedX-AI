"use client";

import { useState } from "react";
import type { Lang } from "@medx/shared";
import { Button, LangMorph } from "@/components/ui";
import { copy, languages, locale } from "../i18n";
import { StatusChart, LatencyChart } from "./Charts";
import { Blank, Escalations, Queue } from "./Queue";
import { MetricStrip, ProviderPlate } from "./SystemLedger";
import { useOpsSnapshot } from "./useOpsSnapshot";
import styles from "../ops.module.css";

export function OpsDashboard() {
  const [lang, setLang] = useState<Lang>("en");
  const { snapshot, error, refreshing, retry } = useOpsSnapshot();
  const date = snapshot ? new Intl.DateTimeFormat(locale[lang], { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(snapshot.fetchedAt) : null;
  const time = snapshot ? new Intl.DateTimeFormat(locale[lang], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(snapshot.fetchedAt) : null;
  return (
    <main className={styles.desk} lang={lang}>
      <div className={styles.masthead}><span className={styles.wordmark}>MedX Bridge</span><span><LangMorph text={copy.notice} lang={lang} /></span></div>
      <article className={styles.sheet}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}><LangMorph text={copy.title} lang={lang} /></p>
            <h1><LangMorph text={copy.today} lang={lang} />{date ? <>, <LangMorph text={date} lang={lang} /></> : <> <Blank label={copy.loading[lang]} /></>}</h1>
            <p className={styles.subtitle}><LangMorph text={copy.subtitle} lang={lang} /></p>
          </div>
          <div className={styles.headerControls}>
            <div role="group" aria-label={copy.language[lang]} className={styles.languageControl}>
              {languages.map(item => <Button key={item.lang} variant={lang === item.lang ? "primary" : "quiet"} aria-pressed={lang === item.lang} lang={item.lang} onClick={() => setLang(item.lang)}>{item.label}</Button>)}
            </div>
            <div className={styles.sync}><LangMorph text={copy.lastUpdated} lang={lang} /> {time ?? <Blank label={copy.unavailable[lang]} />} <span lang="en">ICT</span></div>
          </div>
        </header>
        <div className={styles.refreshBar}>
          <p><LangMorph text={error && snapshot ? copy.stale : copy.live} lang={lang} /></p>
          <Button variant="quiet" onClick={retry} disabled={refreshing}><LangMorph text={refreshing ? copy.refreshing : copy.refresh} lang={lang} /><span aria-hidden="true"> ↻</span></Button>
        </div>
        {error && <div className={styles.error} role="alert"><div><p><LangMorph text={copy.error} lang={lang} /></p>{snapshot && <p className={styles.note}><LangMorph text={copy.stale} lang={lang} /></p>}</div><Button onClick={retry} disabled={refreshing}><LangMorph text={copy.retry} lang={lang} /></Button></div>}
        {snapshot ? <>
          <Escalations sessions={snapshot.sessions} lang={lang} />
          <Queue sessions={snapshot.sessions} now={snapshot.fetchedAt} lang={lang} />
          <MetricStrip metrics={snapshot.metrics} lang={lang} />
          <div className={styles.charts}><StatusChart sessions={snapshot.sessions} lang={lang} /><LatencyChart sessions={snapshot.sessions} metrics={snapshot.metrics} lang={lang} /></div>
          <ProviderPlate provider={snapshot.metrics.provider} lang={lang} />
        </> : !error && <section className={styles.loading} aria-busy="true" aria-label={copy.loading[lang]}><p role="status"><LangMorph text={copy.loading} lang={lang} /></p><div aria-hidden="true" className={styles.loadingLines}>{Array.from({ length: 6 }, (_, i) => <div key={i}><span /><span /><span /></div>)}</div></section>}
        <footer className={styles.footer}><p><LangMorph text={copy.footer} lang={lang} /></p><span lang="en">MedX Bridge · ACT III</span></footer>
      </article>
    </main>
  );
}
