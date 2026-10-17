import type { Lang, OpsMetrics } from "@medx/shared";
import { LangMorph } from "@/components/ui";
import { copy, locale } from "../i18n";
import { Blank, duration } from "./Queue";
import styles from "../ops.module.css";

export function MetricStrip({ metrics, lang }: { metrics: OpsMetrics; lang: Lang }) {
  const percent = (value: number) => new Intl.NumberFormat(locale[lang], { style: "percent", maximumFractionDigits: 1 }).format(value);
  const milliseconds = (value: number | null) => value === null ? null : `${new Intl.NumberFormat(locale[lang], { maximumFractionDigits: 1 }).format(value)} ms`;
  const values = [
    { label: copy.sessionsToday, value: metrics.sessionsToday },
    { label: copy.escalations, value: metrics.escalations },
    { label: copy.autoCaptured, value: percent(metrics.autoCapturedRate) },
    { label: copy.abstain, value: percent(metrics.abstainRate) },
    { label: copy.medianReview, value: metrics.medianReviewSeconds === null ? null : duration(metrics.medianReviewSeconds, lang) },
    { label: copy.latencyP50, value: milliseconds(metrics.modelLatencyMs.p50) },
    { label: copy.latencyP95, value: milliseconds(metrics.modelLatencyMs.p95) },
  ];
  return (
    <section className={styles.metricSection} aria-labelledby="metrics-title">
      <h2 id="metrics-title"><LangMorph text={copy.ledger} lang={lang} /></h2>
      <dl className={styles.metricStrip}>{values.map((metric, i) => <div key={i}><dt><LangMorph text={metric.label} lang={lang} /></dt><dd>{metric.value === null ? <Blank label={copy.unavailable[lang]} /> : metric.value}</dd></div>)}</dl>
      <p className={styles.note}><LangMorph text={copy.metricsNote} lang={lang} /></p>
    </section>
  );
}

export function ProviderPlate({ provider, lang }: { provider: OpsMetrics["provider"]; lang: Lang }) {
  const mock = provider.name.toLowerCase().includes("mock");
  return (
    <section className={styles.provider} aria-labelledby="provider-title">
      <h2 id="provider-title"><LangMorph text={copy.system} lang={lang} /></h2>
      <p className={styles.providerHeadline}>{mock ? <span lang="en">MOCK — not AMD</span> : <span lang="en">{provider.model.toLowerCase().includes("gemma") && /amd|instinct|rocm/i.test(provider.hardware) ? "Gemma · AMD Instinct (ROCm)" : `${provider.model} · ${provider.hardware}`}</span>}</p>
      <dl className={styles.providerValues}>{(["name", "model", "hardware"] as const).map(key => <div key={key}><dt><LangMorph text={key === "name" ? copy.provider : copy[key]} lang={lang} /></dt><dd>{provider[key]}</dd></div>)}</dl>
      <p className={styles.note}><LangMorph text={copy.providerNote} lang={lang} /></p>
    </section>
  );
}
