"use client";

import { useState } from "react";
import Link from "next/link";
import type { IntakeSession, Lang, RedFlagHit } from "@medx/shared";
import { Card, EmptyState, FieldValue, Icon, LangMorph } from "@/components/ui";
import { abstainMessage } from "@/lib/pipeline/messages";
import { copy, locale, patientLanguageCopy, statusCopy } from "../i18n";
import { isEmptySession, isEmergency, isModelFlag, orderedQueue, verifiedComplaint, waitingSeconds } from "../ops-data";
import styles from "../ops.module.css";

export function Blank({ label }: { label: string }) {
  return <span className={styles.blank}><span aria-hidden="true" /><span className="sr-only">{label}</span></span>;
}

export function duration(seconds: number, lang: Lang) {
  const format = new Intl.NumberFormat(locale[lang], { maximumFractionDigits: 1 });
  if (seconds < 60) return `${format.format(seconds)} ${copy.seconds[lang]}`;
  if (seconds < 3600) return `${format.format(Math.floor(seconds / 60))} ${copy.minutes[lang]}`;
  return `${format.format(Math.floor(seconds / 3600))} ${copy.hours[lang]} ${format.format(Math.floor(seconds % 3600 / 60))} ${copy.minutes[lang]}`;
}

function FlagSource({ flag, lang }: { flag: RedFlagHit; lang: Lang }) {
  return <span className={styles.flagSource}><span>{flag.ruleId}</span><span> · </span><LangMorph text={isModelFlag(flag) ? copy.modelSuggested : copy.rule} lang={lang} /><span> · </span><LangMorph text={flag.severity === "emergency" ? copy.emergency : copy.urgent} lang={lang} /></span>;
}

function OpenIntake({ session, lang }: { session: IntakeSession; lang: Lang }) {
  return <Link className={styles.openLink} href={`/review/${encodeURIComponent(session.id)}`}><LangMorph text={copy.open} lang={lang} /><span className="sr-only"> {session.code}</span><Icon name="chevron-right" size={16} /></Link>;
}

export function Escalations({ sessions, lang }: { sessions: IntakeSession[]; lang: Lang }) {
  const escalated = orderedQueue(sessions).filter(s => s.status === "escalated");
  return (
    <section className={styles.section} aria-labelledby="escalations-title">
      <div className={styles.sectionHeading}>
        <h2 id="escalations-title"><LangMorph text={copy.escalations} lang={lang} /> <span className={styles.headingCount}>{escalated.length}</span></h2>
        <p><LangMorph text={copy.escalationNote} lang={lang} /></p>
      </div>
      {escalated.length === 0 ? <Card><EmptyState icon={<Icon name="circle-check" />} title={<LangMorph text={copy.noEscalations} lang={lang} />} /></Card> : (
        <div className={styles.escalations}>
          {escalated.map(s => (
            <Card key={s.id} className={styles.escalation}>
              <div className={styles.escalationIdentity}>
                <Link href={`/review/${encodeURIComponent(s.id)}`} className={styles.escalationCode}>{s.code}</Link>
                <span className={styles.urgentPill}><Icon name="triangle-alert" size={14} /><LangMorph text={isEmergency(s) ? copy.emergency : copy.urgent} lang={lang} /></span>
              </div>
              <div className={styles.escalationFlags}>
                {s.summary?.redFlags.length ? s.summary.redFlags.map((flag, i) => (
                  <div key={`${flag.ruleId}-${i}`} className={styles.escalationFlag}>
                    <div><p className={styles.flagLabel}><LangMorph text={flag.label} lang={lang} /></p><FlagSource flag={flag} lang={lang} /></div>
                    <div className={styles.acknowledgement}>
                      <span className={flag.review?.action === "acknowledge" ? styles.ackPill : styles.reviewPill}>
                        <Icon name={flag.review?.action === "acknowledge" ? "check" : flag.review ? "circle-minus" : "clock"} size={14} />
                        <span><LangMorph text={flag.review ? flag.review.action === "acknowledge" ? copy.acknowledged : copy.falseAlarm : copy.unacknowledged} lang={lang} />{flag.review && <> {flag.review.reviewerId}</>}</span>
                      </span>
                      {isModelFlag(flag) && <p className={styles.note}><LangMorph text={copy.needsReview} lang={lang} /></p>}
                    </div>
                  </div>
                )) : <span className={styles.reviewPill}><LangMorph text={copy.needsReview} lang={lang} /></span>}
              </div>
              <OpenIntake session={s} lang={lang} />
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export function Queue({ sessions, now, lang }: { sessions: IntakeSession[]; now: number; lang: Lang }) {
  const [showEmpty, setShowEmpty] = useState(false);
  const emptyCount = sessions.filter(isEmptySession).length;
  const visible = orderedQueue(sessions).filter(s => showEmpty || !isEmptySession(s));
  return (
    <Card className={styles.section} aria-labelledby="queue-title">
      <div className={styles.sectionHeading}>
        <h2 id="queue-title"><LangMorph text={copy.queue} lang={lang} /> <span className={styles.headingCount}>{new Intl.NumberFormat(locale[lang]).format(visible.length)}</span></h2>
        <p><LangMorph text={copy.queueNote} lang={lang} /></p>
      </div>
      {emptyCount > 0 && <button type="button" className={styles.emptyToggle} aria-expanded={showEmpty} aria-controls="ops-queue-list" onClick={() => setShowEmpty(value => !value)}>{(showEmpty ? copy.hideEmpty : copy.showEmpty)[lang].replace("{count}", new Intl.NumberFormat(locale[lang]).format(emptyCount))}</button>}
      {visible.length === 0 && <EmptyState icon={<Icon name="inbox" />} title={<LangMorph text={sessions.length ? copy.emptyVisible : copy.empty} lang={lang} />} />}
        <ul id="ops-queue-list" className={styles.queueList} aria-label={copy.queue[lang]}>
          {visible.map(s => {
            const waiting = waitingSeconds(s, now);
            const statusClass = s.status === "escalated" ? styles.urgentPill : s.status === "needs_human" ? styles.reviewPill : s.status === "approved" || s.status === "taken_over" ? styles.ackPill : styles.statusPill;
            return (
              <li key={s.id} className={styles.queueRow}>
                <div className={styles.queueIdentity}>
                  <Link href={`/review/${encodeURIComponent(s.id)}`} className={styles.queueCode}>{s.code}</Link>
                  <span className={styles.languagePill}><Icon name="globe" size={14} /><LangMorph text={patientLanguageCopy[s.patientLang]} lang={lang} /></span>
                </div>
                <div className={styles.queueDetail}>
                  <span className={statusClass}><Icon name={s.status === "escalated" ? "triangle-alert" : s.status === "approved" ? "check" : s.status === "needs_human" ? "pencil" : "clipboard-list"} size={14} /><LangMorph text={statusCopy[s.status]} lang={lang} /></span>
                  <div className={styles.complaint}><span className="sr-only">{s.summary?.redFlags.length ? copy.redFlags[lang] : copy.complaint[lang]}: </span>{s.summary?.redFlags.length ? s.summary.redFlags.map((flag, index) => <p key={`${flag.ruleId}-${index}`}><LangMorph text={flag.label} lang={lang} /></p>) : s.summary?.abstained ? <span className={styles.reviewPill}><Icon name="pencil" size={14} /><LangMorph text={copy.needsReview} lang={lang} /></span> : isEmptySession(s) ? copy.noComplaint[lang] : <FieldValue field={verifiedComplaint(s)} lang={lang} />}</div>
                  {s.summary?.abstained && <p className={styles.note}><LangMorph text={abstainMessage(s.summary.abstainReason)} lang={lang} /></p>}
                  <div className={styles.queueFlags}>{s.summary?.redFlags.length ? s.summary.redFlags.map((flag, i) => <div key={`${flag.ruleId}-${i}`}><FlagSource flag={flag} lang={lang} /></div>) : <LangMorph text={copy.noFlags} lang={lang} className={styles.noFlags} />}</div>
                </div>
                <div className={styles.queueAction}><span className={styles.waiting}><Icon name="clock" size={14} /><span><span className="sr-only">{copy.waiting[lang]}: </span>{waiting === null ? <Blank label={copy.completed[lang]} /> : duration(waiting, lang)}</span></span><OpenIntake session={s} lang={lang} /></div>
              </li>
            );
          })}
        </ul>
      <p className={styles.note}><LangMorph text={copy.waitingNote} lang={lang} /></p>
    </Card>
  );
}
