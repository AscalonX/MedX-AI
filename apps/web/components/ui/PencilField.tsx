import type { ExtractedField, Lang } from "@medx/shared";
import { InkConfidence } from "./InkConfidence";
import { Badge } from "./Badge";

const copy = {
  unsupported: {
    th: "ไม่พบในคำพูดของผู้ป่วย ตรวจสอบก่อนใช้",
    it: "Non trovato nelle parole del paziente. Verificare prima dell'uso.",
    en: "Not found in the patient's words. Check before use.",
  },
  missing: { th: "ผู้ป่วยยังไม่ได้บอก", it: "Non ancora detto dal paziente", en: "Not mentioned yet" },
  approved: { th: "อนุมัติแล้ว", it: "Approvato", en: "Approved" },
  edited: { th: "แก้ไขโดยแพทย์", it: "Modificato dal clinico", en: "Edited by clinician" },
} as const;

/** Unsupported value: graphite pencil, never ink, always with the margin note (DIRECTION.md 6b). */
export function PencilField({ value, lang }: { value: string; lang: Lang }) {
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="mx-pencil text-body">{value}</span>
      <span lang={lang} className="text-micro italic text-graphite font-serif">{copy.unsupported[lang]}</span>
    </span>
  );
}

/**
 * Renders a summary value by FieldStatus so every surface treats status identically.
 * supported: ink, darkness by confidence. unsupported: pencil. missing: blank form line.
 * edited: old value struck through once, new value in ink. approved: ink plus stamp.
 */
export function FieldValue({
  field,
  lang,
  previousValue,
  reviewer,
}: {
  field: ExtractedField;
  lang: Lang;
  previousValue?: string;
  reviewer?: string;
}) {
  const v = field.value?.[lang] ?? null;
  if (field.status === "missing" || v === null) {
    return (
      <span className="inline-flex items-baseline gap-2">
        <span className="mx-blank" aria-hidden="true" />
        <span className="text-small text-graphite">{copy.missing[lang]}</span>
      </span>
    );
  }
  if (field.status === "unsupported") return <PencilField value={v} lang={lang} />;
  if (field.status === "edited") {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-2">
        {previousValue && <s className="mx-struck text-body">{previousValue}</s>}
        <span className="text-body font-medium text-ink">{v}</span>
        <span className="text-micro text-ink-soft">{copy.edited[lang]}{reviewer ? `, ${reviewer}` : ""}</span>
      </span>
    );
  }
  if (field.status === "approved") {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-2">
        <span className="text-body font-medium text-ink">{v}</span>
        <Badge tone="outline">{copy.approved[lang]}{reviewer ? `, ${reviewer}` : ""}</Badge>
      </span>
    );
  }
  return (
    <InkConfidence confidence={field.confidence} lang={lang}>
      <span className="text-body font-medium">{v}</span>
    </InkConfidence>
  );
}
