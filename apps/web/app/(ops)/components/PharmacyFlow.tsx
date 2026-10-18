import Link from "next/link";
import type { IntakeSession, Lang, Localized, OpsMetrics } from "@medx/shared";
import { Card, Icon, LangMorph, type IconName } from "@/components/ui";
import { copy, locale } from "../i18n";
import { pharmacyStages, readyForPickup, type PharmacyStage } from "../ops-data";
import { CountUp } from "./CountUp";
import { duration } from "./Queue";
import styles from "../ops.module.css";

type Unit = "order" | "patient";
/** `stage` is the pharmacy queue stage each count opens (/pharmacy?stage=...). */
const STAGE: Record<PharmacyStage, { label: Localized; who: Localized; unit: Unit; icon: IconName; stage: "verify" | "dispense" | "ready" | "collected" }> = {
  toVerify: { label: copy.stageToVerify, who: copy.stageToVerifyWho, unit: "order", icon: "clipboard-list", stage: "verify" },
  toDispense: { label: copy.stageToDispense, who: copy.stageToDispenseWho, unit: "order", icon: "package-check", stage: "dispense" },
  readyForPickup: { label: copy.stageReadyForPickup, who: copy.stageReadyForPickupWho, unit: "patient", icon: "bell", stage: "ready" },
  collectedToday: { label: copy.stageCollectedToday, who: copy.stageCollectedTodayWho, unit: "patient", icon: "circle-check", stage: "collected" },
};

function unitLabel(unit: Unit, n: number, lang: Lang) {
  const one = new Intl.PluralRules(locale[lang]).select(n) === "one";
  return (unit === "order" ? one ? copy.unitOrder : copy.unitOrders : one ? copy.unitPatient : copy.unitPatients)[lang];
}

/**
 * Pharmacy flow after the doctor sends orders: pharmacist 1 verifies, pharmacist 2 dispenses, the patient is called
 * and collects. The four counts are metrics.pharmacy exactly, and each one links to that stage of the pharmacy queue.
 * A missing block is shown as "no measurement", never as zeros. The counter list shows patient code and counter only.
 */
export function PharmacyFlow({ metrics, sessions, now, lang }: { metrics: OpsMetrics; sessions: IntakeSession[]; now: number; lang: Lang }) {
  const counts = metrics.pharmacy;
  const pickup = readyForPickup(sessions);
  const time = (iso: string) => new Intl.DateTimeFormat(locale[lang], { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(new Date(iso));
  return (
    <section className={styles.section} aria-labelledby="pharmacy-flow-title">
      <div className={styles.sectionHeading}>
        <h2 id="pharmacy-flow-title"><Icon name="pill" size={20} className={styles.headingIcon} /><LangMorph text={copy.pharmacyFlow} lang={lang} /></h2>
        <p><LangMorph text={copy.pharmacyFlowNote} lang={lang} /></p>
      </div>
      {counts ? (
        <ol className={styles.flow} aria-label={copy.pharmacyFlow[lang]}>
          {pharmacyStages.map((stage, index) => {
            const s = STAGE[stage];
            const n = counts[stage];
            return (
              <li key={stage} data-stage={stage}>
                <Link href={`/pharmacy?stage=${s.stage}`} className={styles.flowTile} data-tone={stage === "collectedToday" ? "teal" : n > 0 ? "ocean" : "quiet"}>
                  <span className={styles.flowTop}>
                    <span className={styles.stageIndex} aria-hidden="true">{index + 1}</span>
                    <span className={styles.flowLabel}><LangMorph text={s.label} lang={lang} /></span>
                    <span className={styles.flowIcon} aria-hidden="true"><Icon name={s.icon} size={18} /></span>
                  </span>
                  <span className={styles.flowValue}>
                    <span className={styles.flowNumber}><CountUp value={n} lang={lang} /></span>
                    <span className={styles.flowUnit}>{unitLabel(s.unit, n, lang)}</span>
                  </span>
                  <span className={styles.flowWho}><LangMorph text={s.who} lang={lang} /></span>
                  <span className={styles.flowOpen}><span className={styles.flowOpenText}><LangMorph text={copy.openStage} lang={lang} /></span><Icon name="arrow-right" size={14} /></span>
                </Link>
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
                <Link className={styles.openLink} href={`/pharmacy/${encodeURIComponent(p.id)}#pickup`}><LangMorph text={copy.openPharmacy} lang={lang} /><span className="sr-only"> {p.code}</span><Icon name="chevron-right" size={16} /></Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
