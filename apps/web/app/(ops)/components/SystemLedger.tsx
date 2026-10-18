import type { Lang, OpsMetrics } from "@medx/shared";
import { Card, Icon, LangMorph, StatTile } from "@/components/ui";
import { copy, locale } from "../i18n";
import { healthHardware, isMockProvider, type OpsHealth } from "../ops-data";
import { useCountProgress } from "./CountUp";
import { Blank, duration } from "./Queue";
import styles from "../ops.module.css";

export function MetricStrip({ metrics, health, lang }: { metrics: OpsMetrics; health: OpsHealth; lang: Lang }) {
  const progress = useCountProgress();
  const percent = (value: number) => new Intl.NumberFormat(locale[lang], { style: "percent", maximumFractionDigits: 1 }).format(value * progress);
  const milliseconds = (value: number | null) => value === null ? null : new Intl.NumberFormat(locale[lang], { maximumFractionDigits: 1 }).format(value * progress);
  const mock = isMockProvider(health.provider);
  return (
    <section aria-label={copy.ledger[lang]}>
      <div className={styles.metricStrip}>
        <StatTile label={<LangMorph text={copy.autoCaptured} lang={lang} />} value={percent(metrics.autoCapturedRate)} tone="teal" icon={<Icon name="circle-check" size={18} />} />
        <StatTile label={<LangMorph text={copy.abstain} lang={lang} />} value={percent(metrics.abstainRate)} icon={<Icon name="circle-minus" size={18} />} />
        {(["p50", "p95"] as const).map(key => <div key={key} className={styles.metricCell}>
          {mock || metrics.modelLatencyMs[key] === null ? <Card><p className={styles.metricLabel}>{copy[key === "p50" ? "latencyP50" : "latencyP95"][lang]}</p><span className={styles.statusPill}>{mock ? copy.mockLatency[lang] : copy.unavailable[lang]}</span></Card>
            : <StatTile label={copy[key === "p50" ? "latencyP50" : "latencyP95"][lang]} value={milliseconds(metrics.modelLatencyMs[key])} unit="ms" tone="ocean" icon={<Icon name="activity" size={18} />} />}
        </div>)}
        <Card><p className={styles.metricLabel}>{copy.medianReview[lang]}</p>{metrics.medianReviewSeconds === null ? <Blank label={copy.unavailable[lang]} /> : <p className={styles.metricValue}>{duration(metrics.medianReviewSeconds * progress, lang)}</p>}</Card>
      </div>
      <p className={styles.note}><LangMorph text={copy.metricsNote} lang={lang} /></p>
    </section>
  );
}

export function ProviderPill({ health, lang }: { health: OpsHealth; lang: Lang }) {
  const mock = isMockProvider(health.provider);
  const hardware = healthHardware(health);
  const extract = (health as { extractModel?: unknown }).extractModel;
  const models = typeof extract === "string" && extract ? `${health.model} + ${extract}` : health.model;
  return <span className={styles.providerPill}><Icon name={mock ? "circle-minus" : "activity"} size={18} />{mock ? copy.mock[lang] : `${models}${hardware ? ` · ${hardware}` : ""}`}</span>;
}

export function ProviderPlate({ health, lang }: { health: OpsHealth; lang: Lang }) {
  const values = { provider: health.provider, model: health.model, hardware: healthHardware(health) };
  return (
    <Card className={styles.provider} aria-labelledby="provider-title">
      <h2 id="provider-title"><LangMorph text={copy.system} lang={lang} /></h2>
      <ProviderPill health={health} lang={lang} />
      <dl className={styles.providerValues}>{(["provider", "model", "hardware"] as const).map(key => <div key={key}><dt><LangMorph text={copy[key]} lang={lang} /></dt><dd>{values[key] ?? <Blank label={copy.unavailable[lang]} />}</dd></div>)}</dl>
      <p className={styles.note}><LangMorph text={copy.providerNote} lang={lang} /></p>
    </Card>
  );
}
