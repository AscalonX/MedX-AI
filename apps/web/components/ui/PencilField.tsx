import type { ExtractedField, Lang } from "@medx/shared";
import { InkConfidence } from "./InkConfidence";
import { Badge } from "./Badge";
import { Icon } from "./Icon";

const copy = {
  unsupported: {
    th: "ไม่พบในคำพูดของผู้ป่วย ตรวจสอบก่อนใช้",
    it: "Non trovato nelle parole del paziente. Verificare prima dell'uso.",
    en: "Not found in the patient's words. Check before use.",
  },
  needsCheck: { th: "ต้องตรวจสอบ", it: "Da verificare", en: "Needs check" },
  verified: { th: "จากคำพูดผู้ป่วย", it: "Dalle parole del paziente", en: "From patient's words" },
  missing: { th: "ผู้ป่วยยังไม่ได้บอก", it: "Non ancora detto dal paziente", en: "Not mentioned yet" },
  approved: { th: "อนุมัติแล้ว", it: "Approvato", en: "Approved" },
  edited: { th: "แก้ไขโดยแพทย์", it: "Modificato dal clinico", en: "Edited by clinician" },
} as const;

/** Unverified model value (no quote): dashed amber outline + "Needs check" chip + note (DIRECTION.md 6b). */
export function PencilField({ value, lang }: { value: string; lang: Lang }) {
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="mx-pencil text-body">{value}</span>
        <Badge tone="pencil" icon={<Icon name="triangle-alert" size={13} />}>
          {copy.needsCheck[lang]}
        </Badge>
      </span>
      <span lang={lang} className="text-micro text-warn">
        {copy.unsupported[lang]}
      </span>
    </span>
  );
}

/**
 * Renders a summary value by FieldStatus so every surface treats status identically.
 * supported: solid value + ocean "From patient's words" chip + confidence bars.
 * unsupported: PencilField. missing: grey placeholder pill.
 * edited: old value struck, new value, teal "Edited by". approved: value + teal check chip.
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
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-muted px-3 text-small text-graphite">
        <Icon name="circle-minus" size={14} />
        {copy.missing[lang]}
      </span>
    );
  }
  if (field.status === "unsupported") return <PencilField value={v} lang={lang} />;
  if (field.status === "edited") {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        {previousValue && <s className="mx-struck text-body">{previousValue}</s>}
        <span className="text-body font-semibold text-ink">{v}</span>
        <Badge tone="teal" icon={<Icon name="pencil" size={12} />}>
          {copy.edited[lang]}
          {reviewer ? `, ${reviewer}` : ""}
        </Badge>
      </span>
    );
  }
  if (field.status === "approved") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="text-body font-semibold text-ink">{v}</span>
        <Badge tone="teal" icon={<Icon name="circle-check" size={13} />}>
          {copy.approved[lang]}
          {reviewer ? `, ${reviewer}` : ""}
        </Badge>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <InkConfidence confidence={field.confidence} lang={lang}>
        <span className="text-body font-semibold">{v}</span>
      </InkConfidence>
      <Badge tone="ocean" icon={<Icon name="quote" size={11} />}>
        {copy.verified[lang]}
      </Badge>
    </span>
  );
}
