import type { Lang } from "@medx/shared";
import { BentoCard, BentoGrid, BentoMedia, Icon, type IconName } from "../../components/ui";
import { AUDIT_ROWS, type FeatureId, type LandingCopy } from "./copy";
import { RED_FLAG_EXAMPLE, RULE_COUNTS, highlightParts, still, type LandingStill } from "./data";
import { fill } from "./site";

/*
 * Features bento (DIRECTION.md 12.5, 12.6). Every card shows the real product: a crop of a real MedX screen from
 * public/landing, or real output rendered by the page (the red-flag card runs the deterministic rules on the synthetic
 * sample at build time). One ink card (voice intake). Red appears only on the red-flag card. No Fin.
 */

const ONE_COL = "(min-width: 1024px) 340px, (min-width: 640px) 45vw, 92vw";
const TWO_COL = "(min-width: 1024px) 740px, 92vw";

interface Spec {
  id: Exclude<FeatureId, "redflag" | "audit">;
  still: LandingStill;
  icon: IconName;
  /** Allowed display aspect range for the crop, and the fallback when the file cannot be read. */
  range: [number, number];
  fallback: number;
  cols?: 1 | 2;
  position?: string;
  chrome?: boolean;
}

const SPECS: Record<Spec["id"], Spec> = {
  voice: { id: "voice", still: "patient-voice", icon: "audio-lines", range: [0.75, 1], fallback: 0.8, position: "top center" },
  consult: { id: "consult", still: "hero-consult", icon: "quote", range: [2, 3.4], fallback: 3.15, cols: 2, chrome: true },
  news2: { id: "news2", still: "nurse-case", icon: "thermometer", range: [1.2, 1.5], fallback: 1.33, chrome: true },
  considerations: { id: "considerations", still: "consult", icon: "file-check", range: [1.2, 1.5], fallback: 1.33, chrome: true },
  orders: { id: "orders", still: "orders", icon: "list-checks", range: [1.2, 1.5], fallback: 1.33, chrome: true },
  verify: { id: "verify", still: "pharmacy-verify", icon: "pill", range: [1.2, 1.5], fallback: 1.33, chrome: true },
  dispense: { id: "dispense", still: "pharmacy-dispense", icon: "package-check", range: [1.2, 1.5], fallback: 1.33, chrome: true },
  pickup: { id: "pickup", still: "patient-pickup", icon: "smartphone", range: [1.2, 1.5], fallback: 1.33 },
  ops: { id: "ops", still: "ops", icon: "gauge", range: [1.2, 1.9], fallback: 1.75, chrome: true },
  trace: { id: "trace", still: "trace", icon: "route", range: [2.6, 4.4], fallback: 4.16, cols: 2, chrome: true },
};

function Shot({ spec, alt, tone = "light" }: { spec: Spec; alt: string; tone?: "light" | "ink" }) {
  const s = still(spec.still, spec.range, spec.fallback);
  return (
    <BentoMedia
      src={s.src}
      alt={alt}
      aspect={s.aspect}
      position={spec.position ?? "top left"}
      sizes={spec.cols === 2 ? TWO_COL : tone === "ink" ? "(min-width: 1024px) 380px, 92vw" : ONE_COL}
      chrome={spec.chrome}
      tone={tone}
    />
  );
}

function ShotCard({ spec, copy }: { spec: Spec; copy: LandingCopy }) {
  const c = copy.features.cards[spec.id];
  return (
    <BentoCard
      eyebrow={c.eyebrow}
      icon={<Icon name={spec.icon} size={18} />}
      title={c.title}
      body={fill(c.body, RULE_COUNTS)}
      cols={spec.cols ?? 1}
      accent={spec.id === "news2" || spec.id === "considerations" || spec.id === "dispense" ? "teal" : "ocean"}
      media={<Shot spec={spec} alt={c.alt} />}
    />
  );
}

/** The red-flag card: the synthetic Thai sample, the words the rules matched, and the rule that fired. */
function RedFlagCard({ copy, lang }: { copy: LandingCopy; lang: Lang }) {
  const c = copy.features.cards.redflag;
  const ex = RED_FLAG_EXAMPLE;
  return (
    <BentoCard
      eyebrow={c.eyebrow}
      icon={<Icon name="triangle-alert" size={18} />}
      accent="signal"
      title={c.title}
      body={fill(c.body, RULE_COUNTS)}
      media={
        ex ? (
          <figure className="m-0 rounded-2xl border border-signal/25 bg-signal-tint p-4">
            <figcaption className="text-micro font-semibold text-signal">
              {copy.features.redSample} · {copy.how.sampleLang[ex.sample.lang]}
            </figcaption>
            <blockquote lang={ex.sample.lang} className="m-0 mt-1.5 text-body text-ink">
              {highlightParts(ex.sample.text, ex.quotes).map((p, i) =>
                p.mark ? (
                  <mark key={i} className="rounded bg-sheet px-0.5 font-semibold text-signal ring-1 ring-inset ring-signal/30">
                    {p.text}
                  </mark>
                ) : (
                  <span key={i}>{p.text}</span>
                ),
              )}
            </blockquote>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-small">
              <span className="sr-only">{copy.features.redRule}: </span>
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-signal-gradient px-2.5 text-micro font-semibold text-on-signal">
                <Icon name="triangle-alert" size={12} />
                {ex.hit.ruleId}
              </span>
              <span className="font-semibold text-ink">{ex.hit.label[lang]}</span>
            </p>
            <p className="mt-2 text-micro text-ink-soft">{copy.features.redZero}</p>
          </figure>
        ) : null
      }
    />
  );
}

/** The audit card: the event types a synthetic golden visit writes, in order, as they appear in the log. */
function AuditCard({ copy }: { copy: LandingCopy }) {
  const c = copy.features.cards.audit;
  return (
    <BentoCard
      eyebrow={c.eyebrow}
      icon={<Icon name="scroll-text" size={18} />}
      accent="teal"
      title={c.title}
      body={c.body}
      media={
        <figure className="m-0 rounded-2xl bg-paper p-3 ring-1 ring-inset ring-rule">
          <ol className="flex flex-col">
            {AUDIT_ROWS.map((type) => (
              <li key={type} className="flex items-center gap-2.5 border-b border-rule/70 py-1 last:border-b-0">
                <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-teal-tint text-teal">
                  <Icon name="check" size={12} />
                </span>
                <span className="min-w-0 flex-1 text-small font-semibold text-ink">{copy.features.audit[type]}</span>
                <code className="hidden shrink-0 text-micro text-graphite sm:inline">{type}</code>
              </li>
            ))}
          </ol>
          <figcaption className="mt-2 text-micro text-graphite">{copy.features.auditCaption}</figcaption>
        </figure>
      }
    />
  );
}

export function Features({ copy, lang }: { copy: LandingCopy; lang: Lang }) {
  const voice = copy.features.cards.voice;
  return (
    <BentoGrid>
      <BentoCard
        tone="ink"
        cols={2}
        mediaPosition="right"
        eyebrow={voice.eyebrow}
        icon={<Icon name="mic" size={18} />}
        title={voice.title}
        body={voice.body}
        media={
          <div className="mx-auto w-full max-w-[340px]">
            <Shot spec={SPECS.voice} alt={voice.alt} tone="ink" />
          </div>
        }
      />
      <RedFlagCard copy={copy} lang={lang} />
      <ShotCard spec={SPECS.consult} copy={copy} />
      <ShotCard spec={SPECS.news2} copy={copy} />
      <ShotCard spec={SPECS.considerations} copy={copy} />
      <ShotCard spec={SPECS.orders} copy={copy} />
      <ShotCard spec={SPECS.verify} copy={copy} />
      <ShotCard spec={SPECS.dispense} copy={copy} />
      <ShotCard spec={SPECS.pickup} copy={copy} />
      <AuditCard copy={copy} />
      <ShotCard spec={SPECS.trace} copy={copy} />
      <ShotCard spec={SPECS.ops} copy={copy} />
    </BentoGrid>
  );
}

/** Stills the bento uses (for tests and the video agent's capture list). */
export const FEATURE_STILLS: LandingStill[] = Object.values(SPECS).map((s) => s.still);
