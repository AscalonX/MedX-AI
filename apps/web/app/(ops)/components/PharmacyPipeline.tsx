import Link from "next/link";
import type { IntakeSession, Lang, Localized, OpsMetrics } from "@medx/shared";
import { Card, Icon, LangMorph, StatTile, type IconName } from "@/components/ui";
import { copy, locale } from "../i18n";
import { pharmacyStages, readyForPickup, type PharmacyStage } from "../ops-data";
import { CountUp } from "./CountUp";
import { duration } from "./Queue";
import styles from "../ops.module.css";

type Unit = "order" | "patient";
const STAGE: Record<PharmacyStage, { label: Localized; who: Localized; unit: Unit; icon: IconName; tone: "ocean" | "teal" | "default" }> = {
  toVerify: { label: copy.stageToVerify, who: copy.stageToVerifyWho, unit: "order", icon: "clipboard-list", tone: "ocean" },
  toDispense: { label: copy.stageToDispense, who: copy.stageToDispenseWho, unit: "order", icon: "pill", tone: "ocean" },
  readyForPickup: { label: copy.stageReadyForPickup, who: copy.stageReadyForPickupWho, unit: "patient", icon: "bell", tone: "default" },
  collectedToday: { label: copy.stageCollectedToday, who: copy.stageCollectedTodayWho, unit: "patient", icon: "circle-check", tone: "teal" },
};

function unitLabel(unit: Unit, n: number, lang: Lang) {
  const one = new Intl.PluralRules(locale[lang]).select(n) === "one";
  return (unit === "order" ? one ? copy.unitOrder : copy.unitOrders : one ? copy.unitPatient : copy.unitPatients)[lang];
}

/**
 * Pharmacy stages after the doctor sends orders: pharmacist 1 verifies, pharmacist 2 dispenses,
 * the patient is called and collects. Counts come from /api/metrics; a missing block is shown as
 * "no measurement", never as zeros. The counter list shows patient code and counter only.
 */
export function PharmacyPipeline({ metrics, sessions, now, lang }: { metrics: OpsMetrics; sessions: IntakeSession[]; now: number; lang: Lang }) {
  const counts = metrics.pharmacy;
  const pickup = readyForPickup(sessions);
  const time = (iso: string) => new Intl.DateTimeFormat(locale[lang], { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(new Date(iso));
  return (
    <section className={styles.section} aria-labelledby="pharmacy-title">
      <div className={styles.sectionHeading}>
        <h2 id="pharmacy-title"><LangMorph text={copy.pharmacyPipeline} lang={lang} /></h2>
        <p><LangMorph text={copy.pharmacyPipelineNote} lang={lang} /></p>
      </div>
      {counts ? (
        <ol className={styles.pipeline} aria-label={copy.pharmacyPipeline[lang]}>
          {pharmacyStages.map((stage, index) => {
            const s = STAGE[stage];
            return (
              <li key={stage} data-stage={stage}>
                <StatTile
                  label={<span className={styles.stageLabel}><span className={styles.stageIndex} aria-hidden="true">{index + 1}</span><LangMorph text={s.label} lang={lang} /></span>}
                  value={<CountUp value={counts[stage]} lang={lang} />}
                  unit={unitLabel(s.unit, counts[stage], lang)}
                  hint={<LangMorph text={s.who} lang={lang} />}
                  tone={s.tone}
                  icon={<Icon name={s.icon} size={16} />}
                />
              </li>
            );
          })}
        </ol>
      ) : (
        <Card>
          <span className={styles.statusPill}>{copy.unavailable[lang]}</span>
          <p className={styles.note}><LangMorph text={copy.pharmacyUnavailable} lang={lang} /></p>
        </Card>
      )}
      <Card className={styles.pickup}>
        <div className={styles.sectionHeading}>
          <h3 id="pickup-title"><LangMorph text={copy.pickupList} lang={lang} /> <span className={styles.headingCount}>{new Intl.NumberFormat(locale[lang]).format(pickup.length)}</span></h3>
          <p><LangMorph text={copy.pickupListNote} lang={lang} /></p>
        </div>
        {pickup.length === 0 ? <p className={styles.noFlags}><LangMorph text={copy.noPickup} lang={lang} /></p> : (
          <ul className={styles.pickupList} aria-label={copy.pickupList[lang]}>
            {pickup.map(p => (
              <li key={p.id} className={styles.pickupRow}>
                <span className={styles.queueCode}>{p.code}</span>
                <span className={styles.pickupMeta}>
                  <span className={styles.languagePill}><Icon name="bell" size={14} />{p.counter ? copy.counter[lang].replace("{n}", p.counter) : copy.noCounter[lang]}</span>
                  <span className={styles.waiting}>
                    <Icon name="clock" size={14} />
                    <span>{copy.calledAt[lang]} {time(p.calledAt)}<span aria-hidden="true"> · </span><span className="sr-only">. {copy.waiting[lang]}: </span>{duration(Math.max(0, Math.floor((now - Date.parse(p.calledAt)) / 1000)), lang)}</span>
                  </span>
                </span>
                <Link className={styles.openLink} href={`/pharmacy/${encodeURIComponent(p.id)}`}><LangMorph text={copy.openPharmacy} lang={lang} /><span className="sr-only"> {p.code}</span><Icon name="chevron-right" size={16} /></Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
