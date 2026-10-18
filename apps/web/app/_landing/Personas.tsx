import { DEMO_PERSONAS, type Lang } from "@medx/shared";
import { Icon, PersonaCard, PersonaGrid } from "../../components/ui";
import { personaInitials } from "./demo";
import { ROLES_COPY, personaCopy } from "./demoCopy";

/**
 * The six demo personas (DEMO_PERSONAS, DIRECTION.md 12.9). Each card is one link to /demo/<id>, which records the
 * identity and opens that persona's synthetic case. Synthetic names, no photos, no Fin, no red.
 * Usable from server and client pages (no hooks, no server-only imports).
 */
export function PersonaCards({ lang }: { lang: Lang }) {
  const t = ROLES_COPY[lang];
  return (
    <PersonaGrid>
      {DEMO_PERSONAS.map((p) => {
        const c = personaCopy(p.id, lang);
        const initials = personaInitials(p);
        return (
          <PersonaCard
            key={p.id}
            href={`/demo/${p.id}`}
            name={p.staffName ?? t.patientName}
            role={c.label}
            description={c.task}
            tag={p.role === "patient" ? t.phone : t.web}
            icon={p.role === "patient" ? <Icon name="smartphone" size={20} /> : <span>{initials}</span>}
            cta={t.cta}
          />
        );
      })}
    </PersonaGrid>
  );
}

/** "Synthetic data only. Do not enter real patient information." Informational (ocean), never red. */
export function SyntheticNotice({ lang, className }: { lang: Lang; className?: string }) {
  return (
    <p className={`flex w-fit max-w-full items-start gap-2 rounded-2xl bg-ocean-tint px-4 py-2.5 text-small font-semibold text-ocean ${className ?? ""}`}>
      <Icon name="info" size={16} className="mt-0.5 shrink-0" />
      <span>{ROLES_COPY[lang].notice}</span>
    </p>
  );
}
