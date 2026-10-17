import type { ConsultMode, ConsultSuggestion } from "@medx/shared";

/** Popups hold questions only (rule_out, ask_next). "consider" never appears here, in any mode. */
export const questionsFor = (mode: ConsultMode, list: ConsultSuggestion[]): ConsultSuggestion[] =>
  list.filter((s) => s.kind !== "consider" && s.mode.includes(mode));

/**
 * The single place where "consider" items are allowed through: doctor mode AND kind "consider" AND the
 * suggestion is flagged for doctors. Nurse mode always gets an empty list.
 */
export const considerationsFor = (mode: ConsultMode, list: ConsultSuggestion[]): ConsultSuggestion[] =>
  mode === "doctor" ? list.filter((s) => s.kind === "consider" && s.mode.includes("doctor")) : [];
