import type { IntakeSession, Lang, OpsMetrics } from "@medx/shared";
import { Card, Icon, LangMorph, StatTile } from "@/components/ui";
import { copy, locale } from "../i18n";
import styles from "../ops.module.css";

export function MetricStrip({ metrics, sessions, lang }: { metrics: OpsMetrics; sessions: IntakeSession[]; lang: Lang }) {
  const percent = (value: number) => new Intl.NumberFormat(locale[lang], { style: "percent", maximumFractionDigits: 1 }).format(value);
  const milliseconds = (value: number | null) => value === null ? null : new Intl.NumberFormat(locale[lang], { maximumFractionDigits: 1 }).format(value);
  const alerts = sessions.reduce((total, session) => total + (Array.isArray(session.summary?.medAlerts) ? session.summary.medAlerts.filter(alert => alert && !alert.review).length : 0), 0);
  return (
    <section aria-label={copy.ledger[lang]}>
      <div className={styles.metricStrip}>
        <StatTile label={<LangMorph text={copy.autoCaptured} lang={lang} />} value={percent(metrics.autoCapturedRate)} tone="teal" icon={<Icon name="circle-check" size={18} />} />
        <StatTile label={<LangMorph text={copy.abstain} lang={lang} />} value={percent(metrics.abstainRate)} icon={<Icon name="circle-minus" size={18} />} />
        <StatTile label={<LangMorph text={copy.latencyP50} lang={lang} />} value={milliseconds(metrics.modelLatencyMs.p50)} unit="ms" tone="ocean" icon={<Icon name="activity" size={18} />} />
        <StatTile label={<LangMorph text={copy.latencyP95} lang={lang} />} value={milliseconds(metrics.modelLatencyMs.p95)} unit="ms" tone="ocean" icon={<Icon name="clock" size={18} />} />
        <StatTile label={<LangMorph text={copy.pharmacyAlerts} lang={lang} />} value={alerts} hint={<LangMorph text={copy.pharmacyNote} lang={lang} />} icon={<Icon name="pill" size={18} />} />
      </div>
      <p className={styles.note}><LangMorph text={copy.metricsNote} lang={lang} /></p>
    </section>
  );
}

export function ProviderPill({ provider }: { provider: OpsMetrics["provider"] }) {
  const mock = provider.name.toLowerCase().includes("mock");
  const label = mock ? "MOCK — not AMD" : provider.model.toLowerCase().includes("gemma") && /amd|instinct|rocm/i.test(provider.hardware) ? "Gemma · AMD Instinct (ROCm)" : `${provider.model} · ${provider.hardware}`;
  return <span className={styles.providerPill} lang="en"><Icon name={mock ? "circle-minus" : "activity"} size={18} />{label}</span>;
}

export function ProviderPlate({ provider, lang }: { provider: OpsMetrics["provider"]; lang: Lang }) {
  return (
    <Card className={styles.provider} aria-labelledby="provider-title">
      <h2 id="provider-title"><LangMorph text={copy.system} lang={lang} /></h2>
      <ProviderPill provider={provider} />
      <dl className={styles.providerValues}>{(["name", "model", "hardware"] as const).map(key => <div key={key}><dt><LangMorph text={key === "name" ? copy.provider : copy[key]} lang={lang} /></dt><dd>{provider[key]}</dd></div>)}</dl>
      <p className={styles.note}><LangMorph text={copy.providerNote} lang={lang} /></p>
    </Card>
  );
}
