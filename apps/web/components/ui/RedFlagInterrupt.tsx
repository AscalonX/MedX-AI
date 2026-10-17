"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { Lang, RedFlagHit } from "@medx/shared";
import { Button } from "./Button";

const copy = {
  heading: { th: "สัญญาณอันตราย", it: "Segnale d'allarme", en: "Red flag" },
  ack: { th: "รับทราบแล้ว", it: "Preso in carico", en: "Acknowledge" },
  acked: { th: "รับทราบแล้ว", it: "Preso in carico", en: "Acknowledged" },
  said: { th: "ผู้ป่วยพูดว่า", it: "Il paziente ha detto", en: "Patient said" },
} as const;

/**
 * Clinician red-flag interrupt (DIRECTION.md 6c). A full-width signal band grows from the top
 * of the sheet and pushes `children` (the summary) down. It cannot be dismissed: acknowledging
 * collapses it to a one-line strip that stays for the life of the session.
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
          <section
            role="alert"
            aria-live="assertive"
            lang={lang}
            className={emergency ? "bg-signal text-on-signal" : "bg-signal-tint text-ink border-y-2 border-signal"}
          >
            {acknowledged ? (
              <p className="flex items-baseline gap-3 px-6 py-2 text-small font-medium">
                <span className="font-serif text-lead">{copy.heading[lang]}</span>
                <span>{hits.map((h) => h.label[lang]).join("; ")}</span>
                <span className="ml-auto opacity-90">{copy.acked[lang]}</span>
              </p>
            ) : (
              <div className="flex flex-col gap-4 px-6 py-5">
                {hits.map((h) => (
                  <div key={h.ruleId} className="flex flex-col gap-1">
                    <h2 className="font-serif text-display">{h.label[lang]}</h2>
                    <p className="text-lead font-medium">{h.action[lang]}</p>
                    {h.evidence[0] && (
                      <p className="text-small">
                        {copy.said[lang]}: <q lang={patientLang} className="font-serif italic">{h.evidence[0].quote}</q>
                        <span className="ml-3 opacity-80">{h.ruleId}</span>
                      </p>
                    )}
                  </div>
                ))}
                {onAcknowledge && (
                  <div>
                    <Button variant={emergency ? "onSignal" : "primary"} onClick={onAcknowledge}>
                      {copy.ack[lang]}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
      {children}
    </div>
  );
}
