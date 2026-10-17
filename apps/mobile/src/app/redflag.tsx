import { color, duration, easing, gradient, radius, space } from "@medx/shared";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Alert, Platform, Pressable, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Alert as AlertIcon } from "@/components/icons";
import { Page, Pill, T } from "@/components/ui";
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
  // Staff-only (demo): long-press the code for 2 s. The patient has no path out of this screen.
  const endIntake = () => {
    const end = () => { reset(); router.replace("/"); };
    if (Platform.OS === "web") { if (window.confirm("Staff: end this intake?")) end(); return; }
    Alert.alert("Staff: end this intake?", "Demo staff only. This clears the red-flag screen.", [{ text: "Cancel", style: "cancel" }, { text: "End intake", style: "destructive", onPress: end }]);
  };
  const [head, rest] = splitFirst(message, lang === "th");

  return (
    <Animated.View style={[{ flex: 1 }, slide]} accessibilityRole="alert" accessible={false}>
      <LinearGradient colors={[gradient.signal.from, gradient.signal.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
        <Page bg="transparent" tabs={false}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: color.sheet, alignItems: "center", justifyContent: "center", marginBottom: space[5] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <AlertIcon color={color.signal} size={26} />
          </View>
          <T lang={lang} token="display" weight="bold" tone="onSignal" accessibilityRole="header">{head}</T>
          {!!rest && <T lang={lang} token="lead" tone="onSignal" style={{ marginTop: space[4] }}>{rest}</T>}
          <View style={{ height: space[6] }} />
          <Pressable onLongPress={endIntake} delayLongPress={2000} accessible={false}>
            <View accessible accessibilityLabel={`${s.rfCode} ${session.code.split("").join(" ")}`} style={{ backgroundColor: color.sheet, borderRadius: radius.hero, padding: space[5] }}>
              <T lang={lang} token="small" tone="inkSoft">{s.rfCode}</T>
              <T lang="en" token="code" weight="bold" tone="ink">{session.code}</T>
            </View>
          </Pressable>
          <T lang={lang} tone="onSignal" style={{ marginTop: space[5] }}>{atDesk ? s.atDeskDone : s.rfShow}</T>
          <View style={{ flexGrow: 1, minHeight: space[8] }} />
          {!atDesk && <Pill lang={lang} variant="white" tone="signal" label={s.atDesk} onPress={() => setAtDesk(true)} />}
        </Page>
      </LinearGradient>
    </Animated.View>
  );
}
