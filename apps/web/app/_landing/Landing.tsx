import Image from "next/image";
import Link from "next/link";
import type { Lang } from "@medx/shared";
import {
  Accent,
  ButtonLink,
  Chip,
  Eyebrow,
  FinStage,
  FloatCard,
  Footer,
  Icon,
  Section,
  StatStrip,
  StepCard,
  StepList,
  type IconName,
} from "../../components/ui";
import { LANDING_COPY, type LandingCopy } from "./copy";
import { NAV_COPY, PENDING_REVIEW } from "./demoCopy";
import { PATIENT_URL, RULE_COUNTS, TRY_SAYING, excerpt, patientQrSvg, videoInfo } from "./data";
import { Features } from "./Features";
import { HealthChip } from "./HealthChip";
import { LandingNav } from "./LandingNav";
import { LandingVideo } from "./LandingVideo";
import { landingNavLinks } from "./nav";
import { PersonaCards, SyntheticNotice } from "./Personas";
import { LANDING_PATHS, PATIENT_PATH, fill } from "./site";

/*
 * Marketing landing (DIRECTION.md 12; wave 20 owner decisions 1 to 4). A server component: no AppShell, no
 * ClinicianFrame, no /api/metrics polling. Client islands: the nav (language toggle), the video button, and the
 * model label read once from /api/health. Section ids, in order: nav, hero, built-with, video, how-it-works,
 * features, safety, why, demo-accounts, phone-and-web, under-the-hood, limitations, cta, footer.
 */

export const LANDING_SECTION_IDS = [
  "nav",
  "hero",
  "built-with",
  "video",
  "how-it-works",
  "features",
  "safety",
  "why",
  "demo-accounts",
  "phone-and-web",
  "under-the-hood",
  "limitations",
  "cta",
  "footer",
] as const;

const STAT_LINKS: (string | undefined)[] = ["https://doi.org/10.1093/intqhc/mzl069", undefined, "https://doi.org/10.7326/M16-0961"];
const BUILT_WITH = ["AMD Developer Hackathon ACT III", "Gemma", "Next.js", "Expo"];
const SAFETY_ICONS: IconName[] = ["shield-check", "quote", "circle-minus", "user-check"];
const STEP_ICONS: IconName[] = ["mic", "shield-check", "user-check"];
/** Secondary action on the primary gradient: white outline pill (buttonClasses has no such variant). */
const ON_GRADIENT_OUTLINE =
  "mx-press inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-on-primary/60 px-6 text-lead font-semibold text-on-primary transition-[background-color,scale,outline-offset] duration-quick ease-pen hover:bg-on-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary";

function Hero({ t, lang }: { t: LandingCopy; lang: Lang }) {
  const h = t.hero;
  const pending = PENDING_REVIEW[lang];
  return (
    <section id="hero" aria-labelledby="hero-title" className="px-4 pb-section pt-8 sm:px-8 sm:pt-14">
      <div className="mx-auto grid w-full max-w-page items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-6">
        {/* Entrance (DIRECTION.md 5): each line rises in 70ms after the one above; the headline's accent fades in a
            beat after its first line. CSS only, so it plays on first paint; nothing moves under reduced motion. */}
        <div className="flex min-w-0 flex-col items-start gap-6">
          {pending && (
            <p className="mx-enter inline-flex max-w-full items-center gap-2 rounded-full bg-sheet/85 px-3 py-1 text-micro font-semibold text-ink-soft ring-1 ring-inset ring-rule">
              <Icon name="languages" size={14} />
              {pending}
            </p>
          )}
          <Eyebrow className="mx-enter">{h.eyebrow}</Eyebrow>
          <h1 id="hero-title" className="mx-enter mx-hero-title mx-d1 max-w-[14ch] text-hero font-extrabold text-ink">
            {h.titleA} <Accent>{h.titleB}</Accent>
          </h1>
          <p className="mx-enter mx-d3 max-w-[56ch] text-lead-lg text-ink-soft">{h.subtitle}</p>
          <div className="mx-enter mx-d4 flex flex-wrap gap-3">
            <ButtonLink href="/demo" variant="primary" size="lg" iconEnd={<Icon name="arrow-right" size={18} />}>
              {h.ctaDemo}
            </ButtonLink>
            <ButtonLink href="#video" hardNav variant="secondary" size="lg" icon={<Icon name="circle-play" size={18} />}>
              {h.ctaVideo}
            </ButtonLink>
          </div>
          <ul aria-label={h.trustLabel} className="mx-enter mx-d5 flex max-w-[60ch] flex-wrap gap-2">
            {h.trust.map((c) => (
              <li key={c}>
                <Chip tone="glass" size="sm" icon={<Icon name="check" size={14} className="text-teal" />}>
                  {c}
                </Chip>
              </li>
            ))}
          </ul>
        </div>
        {/* Fin appears once on the page, here, with patient-side cards only (DIRECTION.md 12.3). */}
        <div role="group" aria-label={h.cardsLabel} className="min-w-0">
          <FinStage
            art="hero-hello"
            size={440}
            cards={[
              <FloatCard key="lang" icon={<Icon name="languages" size={18} />} meta={h.langMeta}>
                <p lang="th" className="text-small font-bold text-ink">
                  ภาษาไทย
                </p>
              </FloatCard>,
              <FloatCard key="ask" icon={<Icon name="audio-lines" size={18} />} meta={h.askMeta} title={h.askTitle} />,
              <FloatCard key="sent" icon={<Icon name="check" size={18} />} meta="B-042" title={h.sentTitle} />,
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function BuiltWith({ t }: { t: LandingCopy }) {
  return (
    <section id="built-with" aria-labelledby="built-with-title" className="px-4 sm:px-8">
      <div className="mx-reveal mx-auto w-full max-w-page rounded-card border border-sheet/70 bg-sheet/70 px-5 py-6 shadow-hairline sm:px-8">
        <div className="flex flex-col items-center gap-4 lg:flex-row lg:gap-10">
          <h2 id="built-with-title" className="shrink-0 text-small font-semibold text-ink-soft">
            {t.built.label}
          </h2>
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 lg:justify-start">
            {BUILT_WITH.map((name) => (
              <li key={name} className="text-lead font-extrabold tracking-tight text-ink/65">
                {name}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-center text-micro text-graphite lg:text-left">{t.built.caption}</p>
      </div>
    </section>
  );
}

function VideoSection({ t }: { t: LandingCopy }) {
  const v = videoInfo();
  const labels = {
    name: t.video.name,
    playSound: t.video.playSound,
    play: t.video.play,
    caption: t.video.caption,
    captions: t.video.captions,
    fallback: t.video.fallback,
    walkthrough: t.video.walkthrough,
    walkthroughTitle: t.video.walkthroughTitle,
    walkthroughNote: t.video.walkthroughNote,
    close: t.video.close,
  };
  return (
    <Section id="video" eyebrow={t.video.eyebrow} eyebrowIcon={<Icon name="circle-play" size={14} />} title={<>{t.video.titleA} <Accent>{t.video.titleB}</Accent></>} subtitle={t.video.subtitle}>
      {v.src ? (
        <LandingVideo src={v.src} poster={v.poster} track={v.track} audio={v.audio} labels={labels} walkthrough={v.walkthrough} />
      ) : (
        // Poster-only state: the file is not published yet, so there is no player to break.
        <figure className="mx-reveal mx-glow m-0 mx-auto w-full max-w-[1040px]" data-video-state="pending">
          <div className="glass rounded-bento border border-sheet/70 p-2 shadow-float sm:p-3">
            <div className="relative grid min-h-[320px] place-items-center overflow-hidden rounded-[20px] bg-ink py-10 sm:aspect-video sm:min-h-0 sm:py-0">
              {v.poster && <Image src={v.poster} alt="" fill sizes="(min-width: 1040px) 1020px, 94vw" className="object-cover opacity-40" />}
              <div className="relative flex max-w-[44ch] flex-col items-center gap-3 px-6 text-center">
                <Icon name="circle-play" size={40} className="text-on-primary/80" />
                <p className="text-h3 font-bold text-on-primary">{t.video.missingTitle}</p>
                <p className="text-body text-on-primary/80">{t.video.missingBody}</p>
                <ButtonLink href="/demo" variant="onDark" size="md" iconEnd={<Icon name="arrow-right" size={16} />}>
                  {t.video.missingCta}
                </ButtonLink>
              </div>
            </div>
          </div>
        </figure>
      )}
    </Section>
  );
}

function HowItWorks({ t, lang }: { t: LandingCopy; lang: Lang }) {
  return (
    <Section id="how-it-works" eyebrow={t.how.eyebrow} title={<>{t.how.titleA} <Accent>{t.how.titleB}</Accent></>} subtitle={t.how.subtitle}>
      <StepList columns={3}>
        {t.how.steps.map((s, i) => (
          <StepCard
            key={s.title}
            step={i + 1}
            title={s.title}
            body={s.body}
            icon={<Icon name={STEP_ICONS[i]!} size={20} />}
            human={i === t.how.steps.length - 1}
            humanLabel={t.how.human}
          />
        ))}
      </StepList>
      <div className="mx-reveal mt-12 flex flex-col items-center gap-4 text-center">
        <h3 className="text-h3 font-bold text-ink">{t.how.trySaying}</h3>
        <p className="max-w-[60ch] text-small text-ink-soft">{t.how.trySayingNote}</p>
        <ul className="flex max-w-[980px] flex-wrap justify-center gap-2.5">
          {TRY_SAYING.map((s) => (
            <li key={s.id} className="max-w-full">
              <a
                href={`${PATIENT_PATH}?new=1&lang=${s.lang}&sample=${encodeURIComponent(s.id)}`}
                className="group inline-flex max-w-full rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean"
              >
                <Chip tone="plain" lang={s.lang} icon={<Icon name="quote" size={14} className="text-ocean" />} className="text-left transition-shadow duration-quick ease-pen group-hover:ring-ocean/50">
                  <span className="mr-1.5 text-micro font-semibold text-ocean" lang={lang}>
                    {t.how.sampleLang[s.lang]}
                  </span>
                  <span className="font-medium text-ink">{excerpt(s.text)}</span>
                </Chip>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function Safety({ t }: { t: LandingCopy }) {
  return (
    <Section id="safety" tone="ink" eyebrow={t.safety.eyebrow} eyebrowIcon={<Icon name="shield-check" size={14} />} title={<>{t.safety.titleA} <Accent tone="dark">{t.safety.titleB}</Accent></>} subtitle={t.safety.subtitle}>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {t.safety.cards.map((c, i) => (
          <li key={c.title} className="mx-reveal flex flex-col gap-3 rounded-card bg-on-primary/[0.06] p-6 ring-1 ring-inset ring-on-primary/15">
            <span aria-hidden="true" className="grid size-11 place-items-center rounded-2xl bg-on-primary/10 text-on-primary ring-1 ring-inset ring-on-primary/20">
              <Icon name={SAFETY_ICONS[i]!} size={20} />
            </span>
            <h3 className="text-h3 font-bold text-on-primary">{c.title}</h3>
            <p className="text-body text-on-primary/80">{fill(c.body, RULE_COUNTS)}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Why({ t }: { t: LandingCopy }) {
  return (
    <Section id="why" eyebrow={t.why.eyebrow} title={<>{t.why.titleA} <Accent>{t.why.titleB}</Accent></>} subtitle={t.why.subtitle}>
      <StatStrip
        newTabLabel={t.why.newTab}
        items={t.why.stats.map((s, i) => ({ value: s.value, label: s.label, source: { label: s.source, href: STAT_LINKS[i] } }))}
      />
    </Section>
  );
}

function DemoAccounts({ t, lang }: { t: LandingCopy; lang: Lang }) {
  return (
    <Section id="demo-accounts" eyebrow={t.roles.eyebrow} eyebrowIcon={<Icon name="users" size={14} />} title={<>{t.roles.titleA} <Accent>{t.roles.titleB}</Accent></>} subtitle={t.roles.subtitle}>
      <SyntheticNotice lang={lang} className="mx-auto mb-6" />
      <PersonaCards lang={lang} />
      <p className="mt-6 text-center">
        <Link
          href="/demo"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 py-2 text-body font-semibold text-ocean transition-colors duration-quick ease-pen hover:bg-ocean-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean"
        >
          {t.roles.more}
          <Icon name="arrow-right" size={16} className="shrink-0" />
        </Link>
      </p>
    </Section>
  );
}

function PhoneAndWeb({ t }: { t: LandingCopy }) {
  const qr = patientQrSvg();
  return (
    <Section id="phone-and-web" tone="panel" eyebrow={t.phone.eyebrow} eyebrowIcon={<Icon name="smartphone" size={14} />} title={<>{t.phone.titleA} <Accent>{t.phone.titleB}</Accent></>} subtitle={t.phone.subtitle}>
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
        <ul className="mx-auto flex max-w-[56ch] flex-col gap-4">
          {t.phone.points.map((p) => (
            <li key={p} className="mx-reveal flex items-start gap-3 text-body text-ink">
              <span aria-hidden="true" className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-ocean-tint text-ocean">
                <Icon name="check" size={15} />
              </span>
              {p}
            </li>
          ))}
          <li className="mt-2">
            <ButtonLink href={`${PATIENT_PATH}?new=1`} hardNav variant="primary" size="lg" icon={<Icon name="smartphone" size={18} />}>
              {t.phone.open}
            </ButtonLink>
          </li>
        </ul>
        <figure className="mx-reveal m-0 mx-auto flex flex-col items-center gap-3 rounded-card bg-sheet p-5 shadow-sheet ring-1 ring-inset ring-rule">
          {qr ? (
            <div
              role="img"
              aria-label={`${t.phone.qrLabel}: ${PATIENT_URL}`}
              className="size-48 overflow-hidden rounded-2xl [&>svg]:size-full"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
          ) : (
            <span className="grid size-48 place-items-center rounded-2xl bg-muted text-graphite">
              <Icon name="qr-code" size={40} />
            </span>
          )}
          <figcaption className="flex max-w-[16rem] flex-col items-center gap-1 text-center">
            <span className="text-small font-bold text-ink">{t.phone.qrLabel}</span>
            <span className="text-micro text-ink-soft">{t.phone.scanNote}</span>
            <span className="break-all text-micro text-graphite">{PATIENT_URL}</span>
          </figcaption>
        </figure>
      </div>
    </Section>
  );
}

function UnderTheHood({ t }: { t: LandingCopy }) {
  const h = t.hood;
  return (
    <Section id="under-the-hood" eyebrow={h.eyebrow} eyebrowIcon={<Icon name="cpu" size={14} />} title={<>{h.titleA} <Accent>{h.titleB}</Accent></>} subtitle={h.subtitle}>
      <div className="mx-reveal flex flex-col items-center gap-6 text-center">
        <HealthChip
          labels={{ modelLabel: h.modelLabel, modelLoading: h.modelLoading, modelMock: h.modelMock, modelLive: h.modelLive, modelNotConfigured: h.modelNotConfigured, modelUnknown: h.modelUnknown }}
        />
        <p className="max-w-[64ch] text-small text-ink-soft">{h.designed}</p>
        <ul className="flex max-w-[900px] flex-wrap justify-center gap-2.5">
          {h.chips.map((c) => (
            <li key={c}>
              <Chip tone="plain">{fill(c, RULE_COUNTS)}</Chip>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function Limitations({ t }: { t: LandingCopy }) {
  return (
    <Section id="limitations" eyebrow={t.limits.eyebrow} eyebrowIcon={<Icon name="info" size={14} />} title={<>{t.limits.titleA} <Accent>{t.limits.titleB}</Accent></>}>
      <ul className="mx-reveal mx-auto grid max-w-[1000px] grid-cols-1 gap-x-8 gap-y-4 rounded-bento border border-rule/70 bg-sheet p-6 shadow-sheet sm:p-8 md:grid-cols-2">
        {t.limits.items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-body text-ink-soft">
            <Icon name="circle-minus" size={18} className="mt-0.5 shrink-0 text-graphite" />
            <span>{fill(item, RULE_COUNTS)}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function FinalCta({ t }: { t: LandingCopy }) {
  // The one primary-gradient panel on the page; no Fin and no 3D mark on it (DIRECTION.md 11, 12.4).
  return (
    <section id="cta" aria-labelledby="cta-title" className="px-4 py-section sm:px-8">
      <div className="mx-reveal mx-auto flex w-full max-w-page flex-col items-center gap-5 rounded-bento bg-primary-gradient px-5 py-14 text-center shadow-hero sm:px-12 sm:py-20">
        <h2 id="cta-title" className="max-w-[22ch] text-h2 font-extrabold text-on-primary">
          {t.cta.titleA} <Accent tone="dark">{t.cta.titleB}</Accent>
        </h2>
        <p className="max-w-[56ch] text-lead-lg text-on-primary/85">{t.cta.body}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/demo" variant="onDark" size="lg" iconEnd={<Icon name="arrow-right" size={18} />}>
            {t.cta.demo}
          </ButtonLink>
          <a href="#video" className={ON_GRADIENT_OUTLINE}>
            <Icon name="circle-play" size={18} />
            {t.cta.video}
          </a>
        </div>
      </div>
    </section>
  );
}

function LandingFooter({ t, lang }: { t: LandingCopy; lang: Lang }) {
  const f = t.footer;
  return (
    <div id="footer">
      <Footer
        disclaimer={f.disclaimer}
        note={f.note}
        navLabel={f.navLabel}
        homeLabel={f.homeLabel}
        homeHref={LANDING_PATHS[lang]}
        columns={[
          { title: f.product, links: landingNavLinks(lang) },
          {
            title: f.demo,
            links: [
              { href: `${PATIENT_PATH}?new=1`, label: f.patientApp },
              { href: "/demo", label: f.allRoles },
              { href: "/home", label: f.staffHome },
            ],
          },
          {
            title: f.project,
            links: [
              { href: "#video", label: f.video },
              { href: "#under-the-hood", label: f.hood },
              { href: "#limitations", label: f.limits },
            ],
          },
        ]}
      />
    </div>
  );
}

/** The whole landing in one language. `lang` comes from the route: "/" English, "/th" Thai, "/it" Italian. */
export function Landing({ lang }: { lang: Lang }) {
  const t = LANDING_COPY[lang];
  const n = NAV_COPY[lang];
  return (
    <div lang={lang} className="mx-marketing min-h-dvh overflow-x-clip bg-mist">
      {/* display: contents keeps the nav sticky against the page while carrying the "nav" anchor id. */}
      <div id="nav" className="contents">
        <LandingNav lang={lang} links={landingNavLinks(lang)} cta={{ href: "/demo", label: n.cta }} labels={n.labels} />
      </div>
      {/* The hero has its own entrance, so the app's page fade is off here. */}
      <main id="main-content" data-page-motion="off">
        <Hero t={t} lang={lang} />
        <BuiltWith t={t} />
        <VideoSection t={t} />
        <HowItWorks t={t} lang={lang} />
        <Section id="features" eyebrow={t.features.eyebrow} title={<>{t.features.titleA} <Accent>{t.features.titleB}</Accent></>} subtitle={t.features.subtitle}>
          <Features copy={t} lang={lang} />
        </Section>
        <Safety t={t} />
        <Why t={t} />
        <DemoAccounts t={t} lang={lang} />
        <PhoneAndWeb t={t} />
        <UnderTheHood t={t} />
        <Limitations t={t} />
        <FinalCta t={t} />
      </main>
      <LandingFooter t={t} lang={lang} />
    </div>
  );
}
