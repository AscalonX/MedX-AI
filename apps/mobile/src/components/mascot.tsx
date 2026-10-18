import { MASCOT_VIEWBOX, mascotGradients, mascotPoses, type MascotPose } from "@medx/shared";
import { Image } from "expo-image";
import { useEffect, useId } from "react";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Defs, G, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { useReduceMotion } from "@/components/motion";

/** Fin switches from the vector drawing to the owner-approved 3D art at this size (DIRECTION.md section 11, same as the web). */
export const MASCOT_3D_MIN = 96;

// 3D poses (docs/design/brand3d, transparent webp, 512 px: sharp up to ~170 pt at 3x). Never edited, never recoloured.
const FIN3D: Record<MascotPose, number> = {
  wave: require("../../assets/brand/fin3d/fin3d-wave-512.webp"),
  listening: require("../../assets/brand/fin3d/fin3d-listening-512.webp"),
  thinking: require("../../assets/brand/fin3d/fin3d-thinking-512.webp"),
  happy: require("../../assets/brand/fin3d/fin3d-happy-512.webp"),
  pointing: require("../../assets/brand/fin3d/fin3d-pointing-512.webp"),
};

/**
 * Fin, the dolphin mascot (DIRECTION.md section 11). From 96 pt the 3D art, below that the vector drawing (same path data as the web).
 * Decorative: hidden from screen readers.
 * NEVER render on the red-flag screen, next to alerts or in error states.
 * Motion: the idle bob (DIRECTION section 5, a 3.2 s loop, one of the two loops the app allows). The 3D art floats a little
 * higher (5 pt) with a slight tilt; `listening` sways a few degrees. Reduced motion (read live): completely still.
 */
export function Mascot({ pose = "wave", size = 120, animate = true, variant = "auto" }: { pose?: MascotPose; size?: number; animate?: boolean; variant?: "auto" | "vector" | "3d" }) {
  const reduced = useReduceMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const t = useSharedValue(0);
  const use3d = variant === "3d" || (variant === "auto" && size >= MASCOT_3D_MIN);
  useEffect(() => {
    const half = { duration: 1600, easing: Easing.inOut(Easing.sin) };
    t.set(animate && !reduced ? withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1, false) : 0);
  }, [animate, reduced, t]);
  const lift = use3d ? 5 : 3;
  const moving = animate && !reduced; // still Fin rests exactly upright
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -lift * t.get() },
      { rotate: !moving ? "0deg" : pose === "listening" ? `${(t.get() - 0.5) * 4}deg` : use3d ? `${(t.get() - 0.5) * 2}deg` : "0deg" },
    ],
  }), [lift, pose, use3d, moving]);
  const ref = (v?: string): string | undefined => {
    if (v && v.startsWith("url(#")) return "url(#" + uid + "-" + v.slice(5);
    return v;
  };

  if (use3d) {
    return (
      <Animated.View style={[{ width: size, height: size }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
        <Image source={FIN3D[pose]} style={{ width: size, height: size }} contentFit="contain" accessible={false} alt="" />
      </Animated.View>
    );
  }

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
