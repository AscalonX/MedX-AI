import { color, radius, shadow, space } from "@medx/shared";
import * as Speech from "expo-speech";
import { router } from "expo-router";
import { AccessibilityInfo, Modal, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { pickupPending } from "@/api";
import { Chevron, Info, Refresh } from "@/components/icons";
import { Enter, MS, Press } from "@/components/motion";
import { Card, Pill, sh, T } from "@/components/ui";
import { STR } from "@/i18n";
import { useStore } from "@/store";

/**
 * Whether this phone may offer "Start a new visit": only when a visit is stored, and never on a red-flag visit
 * (the patient has no way out of the red-flag screen; staff clear it there).
 */
export function canStartOver(status: string | undefined) {
  return !!status && status !== "escalated";
}

/** Home and Help: a quiet card that opens the confirm sheet. */
export function NewVisitCard({ style }: { style?: ViewStyle }) {
  const { lang, session, askNewVisit } = useStore();
  const s = STR[lang];
  if (!canStartOver(session?.status)) return null;
  return (
    <Press accessibilityRole="button" accessibilityLabel={s.newVisit} accessibilityHint={s.newVisitSub} onPress={askNewVisit} to={0.98} style={style}>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[4] }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color.oceanTint, alignItems: "center", justifyContent: "center" }}>
          <Refresh color={color.ocean} />
        </View>
        <View style={{ flex: 1 }}>
          <T lang={lang} token="body" weight="bold">{s.newVisit}</T>
          <T lang={lang} token="small" tone="inkSoft">{s.newVisitSub}</T>
        </View>
        <Chevron color={color.graphite} />
      </Card>
    </Press>
  );
}

/**
 * Confirm sheet for "Start a new visit" (rendered once, in the root layout). Clears the visit from this phone only:
 * the server keeps everything already sent. If medicine is still waiting, it says plainly that this phone will stop
 * telling the patient, and shows the code so it can be written down. Backdrop fades in, sheet rises (reduced motion: none).
 */
export function NewVisitSheet() {
  const { lang, session, newVisit, closeNewVisit, startOver } = useStore();
  const s = STR[lang];
  const i = useSafeAreaInsets();
  if (!newVisit) return null;
  const pending = !!session && pickupPending(session);
  const confirm = () => {
    Speech.stop();
    startOver();
    router.replace("/");
    AccessibilityInfo.announceForAccessibility(s.newVisitDone);
  };
  return (
    <Modal transparent visible animationType="none" onRequestClose={closeNewVisit} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Enter dy={0} ms={MS.wash} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15, 30, 46, 0.45)" }]}>
          <Pressable style={{ flex: 1 }} onPress={closeNewVisit} accessibilityRole="button" accessibilityLabel={s.newVisitKeep} />
        </Enter>
        <Enter dy={32} ms={MS.enter} accessibilityViewIsModal aria-modal role="dialog" aria-label={s.newVisitTitle}
          style={[{ width: "100%", maxWidth: 560, alignSelf: "center", backgroundColor: color.sheet, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, paddingHorizontal: space[6], paddingTop: space[3], paddingBottom: space[6] + i.bottom, gap: space[3] }, { boxShadow: sh(shadow.sheetLifted) } as ViewStyle]}>
          <View style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: color.rule, marginBottom: space[2] }} />
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: color.oceanTint, alignItems: "center", justifyContent: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Refresh color={color.ocean} size={24} />
          </View>
          <T lang={lang} token="title" weight="bold" accessibilityRole="header">{s.newVisitTitle}</T>
          <T lang={lang} token="body" tone="inkSoft">{s.newVisitBody}</T>
          {!!session && <T lang={lang} token="body" weight="semibold">{s.newVisitCode(session.code.replace(/-/g, "‑"))}</T>}
          {pending && (
            <View style={{ flexDirection: "row", gap: space[2], backgroundColor: color.warnTint, borderRadius: radius.control, padding: space[3] }}>
              <View style={{ paddingTop: 2 }}><Info color={color.warn} size={18} /></View>
              <T lang={lang} token="body" tone="ink" style={{ flex: 1 }}>{s.newVisitPickup}</T>
            </View>
          )}
          <View style={{ gap: space[3], marginTop: space[2] }}>
            <Pill lang={lang} label={s.newVisitConfirm} onPress={confirm} />
            <Pill lang={lang} variant="quiet" label={s.newVisitKeep} onPress={closeNewVisit} />
          </View>
        </Enter>
      </View>
    </Modal>
  );
}
