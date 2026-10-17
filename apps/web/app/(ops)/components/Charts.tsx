import Link from "next/link";
import type { IntakeSession, Lang, OpsMetrics } from "@medx/shared";
import { LangMorph } from "@/components/ui";
import { copy, locale, statusCopy, stepCopy } from "../i18n";
import { recordedCalls, statusOrder, stepOrder } from "../ops-data";
import styles from "../ops.module.css";

export function StatusChart({ sessions, lang }: { sessions: IntakeSession[]; lang: Lang }) {
  const counts = statusOrder.map(status => ({ status, count: sessions.filter(s => s.status === status).length }));
  const maximum = Math.max(1, ...counts.map(s => s.count));
  return (
    <figure className={styles.statusChart}>
      <figcaption><h2><LangMorph text={copy.distribution} lang={lang} /></h2><p className={styles.note}><LangMorph text={copy.distributionNote} lang={lang} /></p></figcaption>
      <div className={styles.chartScale} aria-hidden="true"><span>0</span><span>{maximum} <LangMorph text={copy.sessions} lang={lang} /></span></div>
      <ul className={styles.distributionRows}>{counts.map(({ status, count }) => (
        <li key={status}>
          <span className={status === "needs_human" ? "mx-pencil" : undefined}><LangMorph text={statusCopy[status]} lang={lang} /></span>
          <svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="0" x2="0" y2="20" stroke="var(--color-rule-strong)" /><rect x="0" y="5" width={count / maximum * 200} height="10" fill={status === "escalated" ? "var(--color-signal)" : "var(--color-ink-soft)"} /></svg>
          <span>{count}</span>
        </li>
      ))}</ul>
    </figure>
  );
}

export function LatencyChart({ sessions, metrics, lang }: { sessions: IntakeSession[]; metrics: OpsMetrics; lang: Lang }) {
  const calls = recordedCalls(sessions);
  const groups = stepOrder.map(step => ({ step, calls: calls.filter(c => c.step === step) })).filter(g => g.calls.length);
  const p50 = metrics.modelLatencyMs.p50;
  const p95 = metrics.modelLatencyMs.p95;
  const maximum = Math.max(1, ...calls.map(c => c.latencyMs), p50 ?? 0, p95 ?? 0);
  const y = (ms: number) => 140 - ms / maximum * 112;
  const percentileLines = [{ name: "p50", value: p50 }, { name: "p95", value: p95 }].filter((p): p is { name: string; value: number } => p.value !== null);
  const close = percentileLines.length === 2 && Math.abs(y(p50!) - y(p95!)) < 18;
  const format = (ms: number) => new Intl.NumberFormat(locale[lang], { maximumFractionDigits: 1 }).format(ms);
  // More calls widen the plot, rather than dropping samples or drawing overlapping ticks.
  const plotWidth = Math.max(520, ...groups.map(g => g.calls.length * 8 * groups.length));
  const groupWidth = plotWidth / Math.max(1, groups.length);
  return (
    <figure className={styles.latencyChart}>
      <figcaption><div className={styles.chartHeading}><h2><LangMorph text={copy.latency} lang={lang} /></h2><span>{calls.length} <LangMorph text={copy.calls} lang={lang} /></span></div><p className={styles.note}><LangMorph text={copy.latencyNote} lang={lang} /></p></figcaption>
      {calls.length === 0 ? <p className={styles.emptyLine}><LangMorph text={copy.noCalls} lang={lang} /></p> : <>
        <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={copy.latency[lang]}>
          <div style={{ minWidth: plotWidth + 150 }}>
            <svg className={styles.latencySvg} viewBox={`0 0 ${plotWidth + 150} 166`} role="img" aria-label={copy.latency[lang]}>
              <title>{copy.latency[lang]}</title>
              <desc>{copy.latencyNote[lang]}</desc>
              <text x="0" y="16">{format(maximum)} ms</text>
              <line x1="0" y1="140" x2={plotWidth} y2="140" stroke="var(--color-rule-strong)" />
              <text x="0" y="160">0 ms</text>
              {percentileLines.map(p => <g key={p.name}>
                <line x1="0" x2={plotWidth} y1={y(p.value)} y2={y(p.value)} stroke="var(--color-rule-strong)" strokeDasharray={p.name === "p95" ? "4 4" : undefined} />
                {!close && <text x={plotWidth + 8} y={y(p.value) + 4}>{p.name} {format(p.value)} ms</text>}
              </g>)}
              {close && <text x={plotWidth + 8} y={y(Math.max(p50!, p95!)) - 16}><tspan x={plotWidth + 8}>p50 {format(p50!)} ms</tspan><tspan x={plotWidth + 8} dy="16">p95 {format(p95!)} ms</tspan></text>}
              {groups.map((group, groupIndex) => group.calls.map((call, index) => {
                const x = groupIndex * groupWidth + (index + 1) * groupWidth / (group.calls.length + 1);
                return <g key={`${call.sessionId}-${call.index}`}>
                  <title>{`${call.code} · ${stepCopy[call.step][lang]} · ${format(call.latencyMs)} ms · ${call.ok ? copy.ok[lang] : copy.failed[lang]} · ${call.provider} · ${call.model}`}</title>
                  {call.ok ? <line x1={x} x2={x} y1={y(call.latencyMs)} y2="140" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="square" /> : <rect x={x - 2} y={y(call.latencyMs)} width="4" height={140 - y(call.latencyMs)} fill="none" stroke="var(--color-graphite)" strokeDasharray="2 1" />}
                  {call.latencyMs === 0 && <line x1={x - 2} x2={x + 2} y1="140" y2="140" stroke="var(--color-ink)" strokeWidth="2" />}
                </g>;
              }))}
            </svg>
            <div className={styles.stepLabels} style={{ width: `${plotWidth / (plotWidth + 150) * 100}%`, gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>{groups.map(group => <div key={group.step}><LangMorph text={stepCopy[group.step]} lang={lang} /><span>{group.calls.length} <LangMorph text={copy.calls} lang={lang} />{group.calls.some(c => !c.ok) && <> · {group.calls.filter(c => !c.ok).length} <LangMorph text={copy.failed} lang={lang} /></>}</span></div>)}</div>
          </div>
        </div>
        <details className={styles.callLedger}>
          <summary><LangMorph text={copy.callLedger} lang={lang} /> ({calls.length})</summary>
          <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={copy.callLedger[lang]}>
            <table><caption className="sr-only"><LangMorph text={copy.callLedger} lang={lang} /></caption><thead><tr>{[copy.code, copy.step, copy.latencyColumn, copy.provider, copy.model, copy.result].map((label, i) => <th key={i} scope="col"><LangMorph text={label} lang={lang} /></th>)}</tr></thead>
              <tbody>{groups.flatMap(g => g.calls).map(call => <tr key={`${call.sessionId}-${call.index}`}><td><Link href={`/review/${encodeURIComponent(call.sessionId)}`}>{call.code}</Link></td><td><LangMorph text={stepCopy[call.step]} lang={lang} /></td><td>{format(call.latencyMs)} ms</td><td>{call.provider}</td><td>{call.model}</td><td><LangMorph text={call.ok ? copy.ok : copy.failed} lang={lang} /></td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </>}
    </figure>
  );
}
