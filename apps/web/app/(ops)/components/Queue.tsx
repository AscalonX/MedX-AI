import Link from "next/link";
import type { IntakeSession, Lang, RedFlagHit } from "@medx/shared";
import { Badge, FieldValue, LangMorph } from "@/components/ui";
import { copy, locale, patientLanguageCopy, statusCopy } from "../i18n";
import { isEmergency, isModelFlag, orderedQueue, verifiedComplaint, waitingSeconds } from "../ops-data";
import styles from "../ops.module.css";

export function Blank({ label }: { label: string }) {
  return <span className={styles.blank}><span aria-hidden="true" /><span className="sr-only">{label}</span></span>;
}

export function duration(seconds: number, lang: Lang) {
  const format = new Intl.NumberFormat(locale[lang], { maximumFractionDigits: 1 });
  if (seconds < 60) return `${format.format(seconds)} s`;
  if (seconds < 3600) return `${format.format(Math.floor(seconds / 60))} min`;
  return `${format.format(Math.floor(seconds / 3600))} h ${format.format(Math.floor(seconds % 3600 / 60))} min`;
}

function FlagSource({ flag, lang }: { flag: RedFlagHit; lang: Lang }) {
  return <span className={styles.flagSource}><span>{flag.ruleId}</span><span> · </span><LangMorph text={isModelFlag(flag) ? copy.modelSuggested : copy.rule} lang={lang} /><span> · </span><LangMorph text={flag.severity === "emergency" ? copy.emergency : copy.urgent} lang={lang} /></span>;
}

export function Escalations({ sessions, lang }: { sessions: IntakeSession[]; lang: Lang }) {
  const escalated = orderedQueue(sessions).filter(s => s.status === "escalated");
  return (
    <section className={styles.section} aria-labelledby="escalations-title">
      <div className={styles.sectionHeading}>
        <h2 id="escalations-title"><LangMorph text={copy.escalations} lang={lang} /> <span className={styles.headingCount}>{escalated.length}</span></h2>
        <p><LangMorph text={copy.escalationNote} lang={lang} /></p>
      </div>
      {escalated.length === 0 ? <p className={styles.emptyLine}><LangMorph text={copy.noEscalations} lang={lang} /></p> : (
        <div className={styles.escalations}>
          {escalated.map(s => (
            <div key={s.id} className={`${styles.escalation} ${isEmergency(s) ? styles.emergency : styles.urgent}`}>
              <Link href={`/review/${encodeURIComponent(s.id)}`} className={styles.escalationCode}>{s.code}</Link>
              <div className={styles.escalationFlags}>
                {s.summary?.redFlags.length ? s.summary.redFlags.map((flag, i) => (
                  <div key={`${flag.ruleId}-${i}`} className={styles.escalationFlag}>
                    <div><LangMorph text={flag.label} lang={lang} /><div><FlagSource flag={flag} lang={lang} /></div></div>
                    <p className={styles.acknowledgement}>
                      <LangMorph text={flag.review ? flag.review.action === "acknowledge" ? copy.acknowledged : copy.falseAlarm : copy.unacknowledged} lang={lang} />
                      {flag.review && <> <span>{flag.review.reviewerId}</span></>}
                      {isModelFlag(flag) && <><br /><LangMorph text={copy.needsReview} lang={lang} /></>}
                    </p>
                  </div>
                )) : <LangMorph text={copy.needsReview} lang={lang} />}
              </div>
              <Link className={styles.openLink} href={`/review/${encodeURIComponent(s.id)}`}><LangMorph text={copy.open} lang={lang} /><span className="sr-only"> {s.code}</span><span aria-hidden="true"> ↗</span></Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function Queue({ sessions, now, lang }: { sessions: IntakeSession[]; now: number; lang: Lang }) {
  return (
    <section className={styles.section} aria-labelledby="queue-title">
      <div className={styles.sectionHeading}>
        <h2 id="queue-title"><LangMorph text={copy.queue} lang={lang} /> <span className={styles.headingCount}>{sessions.length}</span></h2>
        <p><LangMorph text={copy.queueNote} lang={lang} /></p>
      </div>
      {sessions.length === 0 ? <p className={styles.emptyLine}><LangMorph text={copy.empty} lang={lang} /></p> : (
        <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={copy.queue[lang]}>
          <table className={styles.queueTable}>
            <caption className="sr-only"><LangMorph text={copy.queue} lang={lang} /></caption>
            <thead><tr>{[copy.code, copy.patientLanguage, copy.status, copy.complaint, copy.waiting, copy.redFlags, copy.open].map((label, i) => <th scope="col" key={i}><LangMorph text={label} lang={lang} /></th>)}</tr></thead>
            <tbody>
              {orderedQueue(sessions).map(s => {
                const waiting = waitingSeconds(s, now);
                const emergency = isEmergency(s);
                return (
                  <tr key={s.id} className={s.status === "escalated" ? emergency ? styles.emergency : styles.urgent : undefined}>
                    <th scope="row"><Link href={`/review/${encodeURIComponent(s.id)}`} className={styles.queueCode}>{s.code}</Link></th>
                    <td><LangMorph text={patientLanguageCopy[s.patientLang]} lang={lang} /></td>
                    <td><Badge tone={s.status === "needs_human" ? "pencil" : "outline"}><LangMorph text={statusCopy[s.status]} lang={lang} /></Badge></td>
                    <td className={styles.complaint}>
                      {s.summary?.abstained ? <span className="mx-pencil"><LangMorph text={copy.needsReview} lang={lang} /></span> : <FieldValue field={verifiedComplaint(s)} lang={lang} />}
                    </td>
                    <td className={styles.waiting}>{waiting === null ? <Blank label={copy.completed[lang]} /> : duration(waiting, lang)}</td>
                    <td className={styles.queueFlags}>{s.summary?.redFlags.length ? s.summary.redFlags.map((flag, i) => <div key={`${flag.ruleId}-${i}`}><FlagSource flag={flag} lang={lang} /></div>) : <LangMorph text={copy.noFlags} lang={lang} className={styles.noFlags} />}</td>
                    <td><Link className={styles.openLink} href={`/review/${encodeURIComponent(s.id)}`}><LangMorph text={copy.open} lang={lang} /><span className="sr-only"> {s.code}</span><span aria-hidden="true"> ↗</span></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.note}><LangMorph text={copy.waitingNote} lang={lang} /></p>
    </section>
  );
}
