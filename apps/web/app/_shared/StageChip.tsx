import type { IntakeSession, JourneyStage, Lang } from "@medx/shared";
import { Badge, Icon, type IconName } from "@/components/ui";
import { T } from "../(clinician)/review/_i18n";
import { stageWords } from "../(clinician)/review/_stage";

const ICON: Record<JourneyStage, IconName> = {
  intake: "inbox",
  intake_reviewed: "list-checks",
  triaged: "activity",
  nurse_done: "user-check",
  doctor_signed: "file-check",
  orders_submitted: "clipboard-list",
  pharmacy_verify: "pill",
  pharmacy_dispense: "package-check",
  ready_for_pickup: "bell",
  collected: "circle-check",
};

/**
 * Journey stage as a word chip (S-01): neutral outline, an icon and the word, never colour alone.
 * Never red and never the approved teal, because a stage is not an urgency or a sign-off.
 */
export function StageChip({ s, stage, lang, className = "" }: { s: Pick<IntakeSession, "orders" | "pickup">; stage?: JourneyStage | null; lang: Lang; className?: string }) {
  if (!stage) return null;
  return (
    <Badge tone="outline" className={`min-w-0 max-w-full ${className}`} icon={<Icon name={ICON[stage]} size={12} className="shrink-0" />}>
      <span className="sr-only">{T.stageLabel[lang]}: </span>
      <span className="min-w-0 truncate" data-stage={stage}>{stageWords(s, stage)[lang]}</span>
    </Badge>
  );
}
