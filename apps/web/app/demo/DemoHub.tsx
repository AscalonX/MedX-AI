"use client";
import { useEffect, useState } from "react";
import type { Lang, OpsMetrics } from "@medx/shared";
import { Accent, ButtonLink, CountUp, Footer, Icon, SectionHeader, StatTile } from "../../components/ui";
import { HUB_COPY, NAV_COPY, PENDING_REVIEW } from "../_landing/demoCopy";
import { LandingNav } from "../_landing/LandingNav";
import { landingNavLinks } from "../_landing/nav";
import { PersonaCards, SyntheticNotice } from "../_landing/Personas";
import { LANDING_PATHS, LANG_STORAGE_KEY, PATIENT_PATH } from "../_landing/site";
import { SignedOutNotice } from "../_shared/SignedOutNotice";

/**
 * /demo: the persona hub. English on first paint (owner decision 3); after mount it follows the language the
 * visitor last chose (medx.lang), like the staff surfaces. Live counts poll /api/metrics here, never on "/".
 * No escalation count: red stays off marketing pages except the landing's red-flag card (DIRECTION.md 12.6).
 */
export function DemoHub({ qrSvg, patientUrl }: { qrSvg: string | null; patientUrl: string }) {
  const [lang, setLang] = useState<Lang>("en");
  const [m, setM] = useState<OpsMetrics | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === "th" || saved === "it" || saved === "en") setLang(saved);
    } catch {
      /* storage blocked: English */
    }
  }, []);

  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/metrics", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<OpsMetrics>) : Promise.reject(new Error(String(r.status)))))
        .then((d) => {
          if (!live) return;
          setM(d);
          setFailed(false);
        })
        .catch(() => live && setFailed(true));
    void load();
    const t = setInterval(load, 10000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  const t = HUB_COPY[lang];
  const n = NAV_COPY[lang];
  const pending = PENDING_REVIEW[lang];
  const inPharmacy = m?.pharmacy ? m.pharmacy.toVerify + m.pharmacy.toDispense : null;
  // Live counts count up when they first arrive and on each change (CountUp; instant under reduced motion).
  const count = (n: number | null | undefined) => (n === null || n === undefined ? null : <CountUp value={n} />);

  return (
    <div lang={lang} className="mx-marketing min-h-dvh overflow-x-clip bg-mist">
      <LandingNav
        lang={lang}
        links={landingNavLinks(lang, false)}
        cta={{ href: `${PATIENT_PATH}?new=1`, label: t.navCta, hardNav: true }}
        labels={n.labels}
        onLangChange={setLang}
      />
      {/* Sign-out from any staff surface lands here (/demo?signedOut=1): confirm it, then drop the flag from the URL. */}
      <SignedOutNotice lang={lang} />
      <main id="main-content" data-page-motion="off" className="px-4 pb-section pt-10 sm:px-8 sm:pt-14">
        <div className="mx-auto flex w-full max-w-page flex-col gap-12">
          <section aria-labelledby="demo-roles-title" className="flex flex-col gap-8">
            {pending && <p className="mx-enter mx-auto text-micro font-semibold text-ink-soft">{pending}</p>}
            <SectionHeader
              className="mx-enter mx-d1"
              id="demo-roles-title"
              as="h1"
              size="h2"
              eyebrow={t.eyebrow}
              eyebrowIcon={<Icon name="users" size={14} />}
              title={
                <>
                  {t.titleA} <Accent>{t.titleB}</Accent>
                </>
              }
              subtitle={t.subtitle}
            />
            <SyntheticNotice lang={lang} className="mx-enter mx-d2 mx-auto" />
            <PersonaCards lang={lang} />
          </section>

          <section aria-labelledby="demo-counts-title" className="mx-reveal flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="demo-counts-title" className="text-h3 font-bold text-ink">
                {t.countsTitle}
              </h2>
              <p className="text-small text-ink-soft">{t.countsNote}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 lg:grid-cols-4">
              <StatTile label={t.sessionsToday} value={count(m?.sessionsToday)} emptyLabel={t.noData} tone="ocean" icon={<Icon name="clipboard-list" size={16} />} />
              <StatTile label={t.awaiting} value={count(m?.byStatus.awaiting_review)} emptyLabel={t.noData} tone="teal" icon={<Icon name="clock" size={16} />} />
              <StatTile label={t.pharmacy} value={count(inPharmacy)} emptyLabel={t.noData} icon={<Icon name="pill" size={16} />} />
              <StatTile label={t.pickup} value={count(m?.pharmacy?.readyForPickup)} emptyLabel={t.noData} icon={<Icon name="package-check" size={16} />} />
            </div>
            {failed && (
              <p role="status" className="text-small text-ink-soft">
                {t.countsUnavailable}
              </p>
            )}
          </section>

          <section aria-labelledby="demo-qr-title" className="mx-reveal glass flex flex-wrap items-center gap-6 rounded-bento border border-sheet/70 p-6 shadow-sheet sm:p-8">
            <figure className="m-0 flex shrink-0 flex-col items-center gap-2">
              {qrSvg ? (
                <div
                  role="img"
                  aria-label={`${t.qrLabel}: ${patientUrl}`}
                  className="size-40 overflow-hidden rounded-2xl bg-sheet p-1.5 ring-1 ring-inset ring-rule [&>svg]:size-full"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <span className="grid size-40 place-items-center rounded-2xl bg-muted text-graphite">
                  <Icon name="qr-code" size={36} />
                </span>
              )}
              <figcaption className="max-w-[12rem] break-all text-center text-micro text-graphite">{patientUrl}</figcaption>
            </figure>
            <div className="flex min-w-[240px] flex-1 flex-col items-start gap-3">
              <h2 id="demo-qr-title" className="text-h3 font-bold text-ink">
                {t.qrTitle}
              </h2>
              <p className="max-w-[56ch] text-body text-ink-soft">{t.qrBody}</p>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href={`${PATIENT_PATH}?new=1`} hardNav variant="primary" icon={<Icon name="smartphone" size={18} />}>
                  {t.openPatient}
                </ButtonLink>
                <ButtonLink href={LANDING_PATHS[lang]} variant="quiet" iconEnd={<Icon name="arrow-right" size={16} />}>
                  {t.backHome}
                </ButtonLink>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer disclaimer={t.footerDisclaimer} note={t.footerNote} homeHref={LANDING_PATHS[lang]} homeLabel={n.labels.home} />
    </div>
  );
}
