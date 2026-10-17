import { MASCOT_VIEWBOX, mascotGradients, mascotPoses, type MascotPose } from "@medx/shared";
import { useEffect, useId } from "react";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Defs, G, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";

/**
 * Mali (DIRECTION.md section 11), same path data as the web. Decorative: hidden from screen readers.
 * NEVER render on the red-flag screen, next to alerts or in error states.
 * Motion: gentle idle bob; `listening` also sways a few degrees (the ears are not separate groups here).
 * Reduced motion: static.
 */
export function Mascot({ pose = "wave", size = 120, animate = true }: { pose?: MascotPose; size?: number; animate?: boolean }) {
  const reduced = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const t = useSharedValue(0);
  useEffect(() => {
    if (animate && !reduced) t.value = withRepeat(withSequence(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.ease) })), -1, false);
    else t.value = 0;
  }, [animate, reduced, t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -3 * t.value }, { rotate: pose === "listening" ? `${(t.value - 0.5) * 4}deg` : "0deg" }],
  }));
  const ref = (v?: string): string | undefined => {
    if (v && v.startsWith("url(#")) return "url(#" + uid + "-" + v.slice(5);
    return v;
  };

  return (
    <Animated.View style={[{ width: size, height: size }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Svg width={size} height={size} viewBox={MASCOT_VIEWBOX}>
        <Defs>
          {mascotGradients.map((g) => {
            const stops = g.stops.map((s, i) => <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />);
            return g.type === "linear"
              ? <LinearGradient key={g.id} id={`${uid}-${g.id}`} gradientUnits="userSpaceOnUse" x1={g.coords.x1} y1={g.coords.y1} x2={g.coords.x2} y2={g.coords.y2}>{stops}</LinearGradient>
              : <RadialGradient key={g.id} id={`${uid}-${g.id}`} gradientUnits="userSpaceOnUse" cx={g.coords.cx} cy={g.coords.cy} r={g.coords.r} fx={g.coords.fx ?? g.coords.cx} fy={g.coords.fy ?? g.coords.cy}>{stops}</RadialGradient>;
          })}
        </Defs>
        <G>
          {mascotPoses[pose].map((l, i) => (
            <Path key={i} d={l.d} fill={ref(l.fill) ?? "none"} stroke={l.stroke} strokeWidth={l.stroke ? (l.strokeWidth ?? 2) : undefined} strokeLinecap={l.stroke ? "round" : undefined} strokeLinejoin={l.stroke ? "round" : undefined} opacity={l.opacity} />
          ))}
        </G>
      </Svg>
    </Animated.View>
  );
}
