import { color, gradient, radius } from "@medx/shared";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Mic, Stop } from "@/components/icons";
import { sh } from "@/components/ui";

const SIZE = 72;

/** Big round mic: teal to ocean, a pulsing ring while listening (not with reduced motion). */
export function MicButton({ listening, level, onPress, label }: { listening: boolean; level: number; onPress: () => void; label: string }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (listening && !reduced) pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.ease) }), -1, false);
    else pulse.value = 0;
  }, [listening, reduced, pulse]);
  const ring = useAnimatedStyle(() => ({ opacity: listening && !reduced ? 0.45 * (1 - pulse.value) : 0, transform: [{ scale: 1 + pulse.value * (0.55 + level * 0.4) }] }));
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
/** Live level bars. With reduced motion the bars stay at rest. */
export function LevelBars({ level }: { level: number }) {
  const reduced = useReducedMotion();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 28 }}>
      {BARS.map((b, i) => <Bar key={i} h={reduced ? 6 : 4 + level * 24 * b} />)}
    </View>
  );
}
function Bar({ h }: { h: number }) {
  const v = useSharedValue(h);
  useEffect(() => { v.value = withTiming(h, { duration: 120 }); }, [h, v]);
  const st = useAnimatedStyle(() => ({ height: v.value }));
  return <Animated.View style={[{ width: 4, borderRadius: 2, backgroundColor: color.ocean }, st]} />;
}
