"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { Lang, RedFlagHit } from "@medx/shared";
import { Button } from "./Button";
import { Icon } from "./Icon";

const copy = {
  heading: { th: "สัญญาณอันตราย", it: "Segnale d'allarme", en: "Red flag" },
  ack: { th: "รับทราบแล้ว", it: "Preso in carico", en: "Acknowledge" },
  acked: { th: "รับทราบแล้ว", it: "Preso in carico", en: "Acknowledged" },
  said: { th: "ผู้ป่วยพูดว่า", it: "Il paziente ha detto", en: "Patient said" },
} as const;

/**
 * Clinician red-flag interrupt (DIRECTION.md 6c). A red card grows in at the top of the container and
 * pushes `children` (the summary) down. It cannot be dismissed: acknowledging collapses it to a
 * one-line red strip that stays for the life of the session.
 */
export function RedFlagInterrupt({
  hits,
  lang,
  patientLang,
  acknowledged = false,
  onAcknowledge,
  children,
}: {
  hits: RedFlagHit[];
  lang: Lang;
  /** Language of the patient's quote (evidence is never translated). */
  patientLang?: Lang;
  acknowledged?: boolean;
  onAcknowledge?: () => void;
  children: ReactNode;
}) {
  // Open after first paint so the push is seen even when hits arrive with the page.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(hits.length > 0));
    return () => cancelAnimationFrame(id);
  }, [hits.length]);
  const emergency = hits.some((h) => h.severity === "emergency");

  return (
    <div className="flex flex-col">
      <div className="mx-interrupt" data-open={open}>
        <div>
          <div className="p-3 pb-0">
            <section
              role="alert"
              aria-live="assertive"
              lang={lang}
              className={
                emergency
                  ? "relative overflow-hidden rounded-card bg-signal-gradient text-on-signal shadow-[var(--shadow-signal)]"
                  : "relative overflow-hidden rounded-card bg-signal-tint text-ink ring-1 ring-inset ring-signal/40"
              }
            >
              {acknowledged ? (
                <p className="flex flex-wrap items-center gap-3 px-5 py-3 text-small font-medium">
                  <Icon name="triangle-alert" size={16} className={emergency ? "" : "text-signal"} />
                  <span className="font-bold">{copy.heading[lang]}</span>
                  <span>{hits.map((h) => h.label[lang]).join("; ")}</span>
                  <span className="ml-auto inline-flex items-center gap-1 opacity-90">
                    <Icon name="check" size={14} />
                    {copy.acked[lang]}
                  </span>
                </p>
              ) : (
                <div className="flex gap-4 px-5 py-5">
                  <span
                    className={
                      emergency
                        ? "grid size-11 shrink-0 place-items-center rounded-full bg-white/15 ring-1 ring-white/30"
                        : "grid size-11 shrink-0 place-items-center rounded-full bg-signal text-on-signal"
                    }
                  >
                    <Icon name="triangle-alert" size={22} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    {hits.map((h) => (
                      <div key={h.ruleId} className="flex flex-col gap-1">
                        <p className="text-micro font-semibold opacity-90">{copy.heading[lang]}</p>
                        <h2 className="text-title font-bold">{h.label[lang]}</h2>
                        <p className="text-lead font-medium">{h.action[lang]}</p>
                        {h.evidence[0] && (
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-small">
                            <span className={emergency ? "rounded-full bg-white/15 px-3 py-1" : "rounded-full bg-sheet px-3 py-1"}>
                              {copy.said[lang]}: <q lang={patientLang} className="italic">{h.evidence[0].quote}</q>
                            </span>
                            <span className="tabular-nums opacity-80">{h.ruleId}</span>
                          </p>
                        )}
                      </div>
                    ))}
                    {onAcknowledge && (
                      <div>
                        <Button variant={emergency ? "onSignal" : "signal"} onClick={onAcknowledge} icon={<Icon name="check" size={16} />}>
                          {copy.ack[lang]}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
