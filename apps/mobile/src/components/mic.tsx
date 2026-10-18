import { color, gradient, radius } from "@medx/shared";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Mic, Stop } from "@/components/icons";
import { useReduceMotion } from "@/components/motion";
import { sh } from "@/components/ui";

const SIZE = 72;

/** Big round mic: teal to ocean, a pulsing ring while listening (not with reduced motion). */
export function MicButton({ listening, level, onPress, label }: { listening: boolean; level: number; onPress: () => void; label: string }) {
  const reduced = useReduceMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(listening && !reduced ? withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.ease) }), -1, false) : 0);
  }, [listening, reduced, pulse]);
  const ring = useAnimatedStyle(() => ({ opacity: listening && !reduced ? 0.45 * (1 - pulse.get()) : 0, transform: [{ scale: 1 + pulse.get() * (0.55 + level * 0.4) }] }), [listening, reduced, level]);
  return (
    <View style={{ width: SIZE + 40, height: SIZE + 40, alignItems: "center", justifyContent: "center" }}>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", width: SIZE, height: SIZE, borderRadius: radius.pill, backgroundColor: color.ocean }, ring]} />
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: listening }} onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] })}>
        <LinearGradient colors={[gradient.primary.from, gradient.primary.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ width: SIZE, height: SIZE, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" }, { boxShadow: sh({ x: 0, y: 14, blur: 28, spread: -10, color: "rgba(26, 95, 196, 0.6)" }) } as ViewStyle]}>
          {listening ? <Stop color={color.onPrimary} /> : <Mic color={color.onPrimary} />}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const BARS = [0.5, 0.8, 1, 0.7, 0.9, 0.6, 0.4];
const BAR_MAX = 28;
/** Live level bars. With reduced motion the bars stay at rest. */
export function LevelBars({ level }: { level: number }) {
  const reduced = useReduceMotion();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 28 }}>
      {BARS.map((b, i) => <Bar key={i} h={reduced ? 6 : 4 + level * 24 * b} still={reduced} />)}
    </View>
  );
}
function Bar({ h, still }: { h: number; still: boolean }) {
  // Height follows the live voice level (a meter, not a transition); with reduced motion the bars are fixed.
  // Drawn at full height and scaled (transform only, so the row never re-lays out).
  const v = useSharedValue(h);
  useEffect(() => { v.set(still ? h : withTiming(h, { duration: 120 })); }, [h, still, v]);
  const st = useAnimatedStyle(() => ({ transform: [{ scaleY: v.get() / BAR_MAX }] }));
  return <Animated.View style={[{ width: 4, height: BAR_MAX, borderRadius: 2, backgroundColor: color.ocean }, st]} />;
}
