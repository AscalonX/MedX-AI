"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DemoPersonaId, Lang } from "@medx/shared";
import { Icon, Logo } from "../../../components/ui";
import { findPersonaCase, needsCase, personaById, personaHref, personaInitials, rememberPersona, rememberPersonaCase } from "../../_landing/demo";
import { LAUNCH_COPY, ROLES_COPY, personaCopy } from "../../_landing/demoCopy";
import { LANG_STORAGE_KEY, fill } from "../../_landing/site";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Opens the demo as one persona: writes the identity every surface reads (medx.role, medx.clinicianRole,
 * medx.reviewer.<role>, medx.demo.persona), asks POST /api/demo/start for a fresh synthetic case at the persona's
 * stage (falls back to the shared seeded case from /api/demo/cases), records a fresh case as the visitor's own
 * (medx.demo.case; cleared otherwise), then replaces this page with the case.
 */
export function Launcher({ personaId }: { personaId: DemoPersonaId }) {
  const persona = personaById(personaId)!;
  const [lang, setLang] = useState<Lang>("en");
  const [dest, setDest] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // React strict mode runs effects twice in development: one case per visit
    started.current = true;
    let chosen: Lang = "en";
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === "th" || saved === "it" || saved === "en") chosen = saved;
    } catch {
      /* storage blocked */
    }
    setLang(chosen);
    rememberPersona(persona, storage());
    void findPersonaCase(persona, (input, init) => fetch(input, init)).then((found) => {
      rememberPersonaCase(persona, found, storage());
      const href = personaHref(persona, found?.id ?? null, chosen);
      setDest(href);
      window.location.replace(href);
    });
  }, [persona]);

  const t = LAUNCH_COPY[lang];
  const c = personaCopy(persona.id, lang);
  const name = persona.staffName ?? ROLES_COPY[lang].patientName;
  const note = persona.role === "patient" ? t.patient : persona.role === "ops" ? t.ops : t.preparing;
  const fallback = personaHref(persona, null, lang);

  return (
    <main id="main-content" data-page-motion="off" lang={lang} className="mx-marketing grid min-h-dvh place-items-center bg-mist px-4 py-10">
      <div className="flex w-full max-w-[460px] flex-col items-center gap-6">
        <Link href="/" aria-label="MedX" className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean">
          <Logo height={30} />
        </Link>
        <section aria-labelledby="launch-title" aria-busy={dest ? undefined : true} className="mx-enter mx-d1 flex w-full flex-col gap-4 rounded-card border border-rule/70 bg-sheet p-6 shadow-sheet">
          <div className="flex items-center gap-4">
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-gradient text-body font-bold text-on-primary">
              {persona.role === "patient" ? <Icon name="smartphone" size={20} /> : personaInitials(persona)}
            </span>
            <div className="min-w-0">
              <h1 id="launch-title" className="text-lead font-bold text-ink">
                {fill(t.opening, { name })}
              </h1>
              <p className="text-small font-semibold text-teal">{c.label}</p>
            </div>
          </div>
          <p className="text-body text-ink-soft" role="status">
            {note}
          </p>
          <span aria-hidden="true" className="mx-skeleton block h-2 w-full rounded-full" />
          {persona.staffName && (
            <p className="text-small text-ink-soft">
              {t.signedInAs} <span className="font-semibold text-ink">{persona.staffName}</span>
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <a href={dest ?? fallback} className="inline-flex items-center gap-1 text-small font-semibold text-ocean underline-offset-4 hover:underline">
              {t.manual}
              <Icon name="arrow-right" size={14} />
            </a>
            <Link href="/demo" className="text-small text-ink-soft underline-offset-4 hover:text-ocean hover:underline">
              {t.back}
            </Link>
          </div>
        </section>
        {needsCase(persona) && <p className="text-center text-micro text-graphite">{ROLES_COPY[lang].notice}</p>}
      </div>
    </main>
  );
}
