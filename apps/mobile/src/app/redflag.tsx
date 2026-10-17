import { color, duration, easing, space } from "@medx/shared";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { Button, Page, T } from "@/components/ui";
import { STR } from "@/i18n";
import { useStore } from "@/store";

/** First sentence is the instruction (display size); the rest is supporting text. Thai has no full stops, so it splits on the first space. */
function splitFirst(m: string, thai: boolean): [string, string] {
  const k = (thai ? /\s/ : /[.!?]\s/).exec(m);
  if (!k) return [m, ""];
  const cut = k.index + (thai ? 0 : 1);
  return [m.slice(0, cut).trim(), m.slice(cut).trim()];
}

export default function RedFlag() {
  const { lang, session, reset } = useStore();
  const s = STR[lang];
  const reduced = useReducedMotion();
  const { height } = useWindowDimensions();
  const y = useSharedValue(reduced ? 0 : height);
  const [atDesk, setAtDesk] = useState(false);
  const hit = session?.summary?.redFlags.find((r) => r.severity === "emergency") ?? session?.summary?.redFlags[0];
  const message = hit?.patientMessage[lang] ?? "";

  useEffect(() => {
    if (!session) { router.replace("/"); return; }
    y.value = withTiming(0, { duration: reduced ? 0 : duration.interrupt, easing: Easing.bezier(...easing.interrupt) });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); // one haptic, no repeat
    AccessibilityInfo.announceForAccessibility(message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  if (!session) return null;
  const [head, rest] = splitFirst(message, lang === "th");

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: color.signal }, slide]} accessibilityRole="alert" accessible={false}>
      <Page bg={color.signal}>
        <T lang={lang} token="display" family="serif" weight="semibold" tone="onSignal" accessibilityRole="header">{head}</T>
        {!!rest && <T lang={lang} token="lead" tone="onSignal" style={{ marginTop: space[4] }}>{rest}</T>}
        <View style={{ height: space[8] }} />
        <T lang={lang} token="small" tone="onSignal">{s.rfCode}</T>
        <T lang="en" token="code" weight="semibold" tone="onSignal" accessibilityLabel={`${s.rfCode} ${session.code.split("").join(" ")}`} style={{ marginVertical: space[2] }}>{session.code}</T>
        <T lang={lang} tone="onSignal" style={{ marginTop: space[3] }}>{atDesk ? s.atDeskDone : s.rfShow}</T>
        <View style={{ flexGrow: 1, minHeight: space[8] }} />
        {!atDesk ? (
          <Button lang={lang} label={s.atDesk} onSignal onPress={() => setAtDesk(true)} />
        ) : (
          <Pressable accessibilityRole="button" onPress={() => { reset(); router.replace("/"); }} style={{ minHeight: 48, justifyContent: "center", alignSelf: "flex-start" }}>
            <T lang={lang} token="small" tone="onSignal" style={{ textDecorationLine: "underline" }}>{s.newIntake}</T>
          </Pressable>
        )}
      </Page>
    </Animated.View>
  );
}
