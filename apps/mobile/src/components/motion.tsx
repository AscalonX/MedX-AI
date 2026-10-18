import { duration, easing } from "@medx/shared";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";

/**
 * Patient app motion (DIRECTION.md section 5). Small, calm and only transform + opacity, so nothing ever shifts layout.
 * Rules:
 * - Transitions run 150 to 450 ms with the `pen` ease-out. The only loops are Fin's idle bob and the loading shimmer.
 * - Reduced motion (system setting, read live): no motion at all; every end state is identical and shown at once.
 * - Urgent content never moves: the red-flag screen, red-flag examples and error cards appear instantly and stay static.
 */
export const EASE = Easing.bezier(...easing.pen);
export const MS = { press: duration.quick, enter: 280, hero: 420, morph: duration.morph, step: 360, wash: 200, fade: 450 } as const;

// ---- Reduced motion, live -------------------------------------------------------------------------------------------
// Reanimated's useReducedMotion() is the value at startup (synchronous, so the first frame is already right);
// AccessibilityInfo keeps it current when the patient changes the setting while the app is open.
let live: boolean | null = null;
const subs = new Set<() => void>();
let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  const set = (v: boolean) => { if (v !== live) { live = v; subs.forEach((f) => f()); } };
  AccessibilityInfo.isReduceMotionEnabled().then(set, () => {});
  AccessibilityInfo.addEventListener("reduceMotionChanged", set);
}
const subscribe = (f: () => void) => { wire(); subs.add(f); return () => { subs.delete(f); }; };
const snapshot = () => live;

export function useReduceMotion(): boolean {
  const startup = useReducedMotion();
  const v = useSyncExternalStore(subscribe, snapshot, snapshot);
  return v ?? startup;
}

// ---- Entering ----------------------------------------------------------------------------------------------------------
/**
 * Enters once with a fade and a small rise, driven by a shared value (a small hook, not a Reanimated layout animation:
 * on web, non-preset entering animations end by pinning the element with position absolute and a fixed size, which
 * breaks later re-layout). Always the same Animated.View, so the reduced-motion setting can change without remounting
 * the children; with reduced motion (or `off`) it starts at its end state. Remount with a new `key` to play it again.
 */
export function Enter({ children, dy = 8, ms = MS.enter, delay = 0, off, style, ...view }: ViewProps & { children: ReactNode; dy?: number; ms?: number; delay?: number; off?: boolean; style?: StyleProp<ViewStyle> }) {
  const reduced = useReduceMotion();
  const still = reduced || !!off;
  const p = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    p.set(still ? 1 : withDelay(delay, withTiming(1, { duration: ms, easing: EASE })));
  }, [still, delay, ms, p]);
  const a = useAnimatedStyle(() => (dy ? { opacity: p.get(), transform: [{ translateY: (1 - p.get()) * dy }] } : { opacity: p.get() }), [dy]);
  return <Animated.View {...view} style={[style, a]}>{children}</Animated.View>;
}

// ---- Press feedback ---------------------------------------------------------------------------------------------------
const APressable = Animated.createAnimatedComponent(Pressable);
type PressProps = Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle>; to?: number };

/** Pressable that sinks to `to` (scale .97, `quick`) while pressed and eases back. Reduced motion: no scale. */
export function Press({ style, to = 0.97, onPressIn, onPressOut, ...p }: PressProps) {
  const reduced = useReduceMotion();
  const k = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: k.get() }] }));
  return (
    <APressable
      {...p}
      onPressIn={(e) => { if (!reduced) k.set(withTiming(to, { duration: MS.press, easing: EASE })); onPressIn?.(e); }}
      onPressOut={(e) => { k.set(reduced ? 1 : withTiming(1, { duration: duration.base, easing: EASE })); onPressOut?.(e); }}
      style={[style, a]}
    />
  );
}

// ---- Status change highlight ------------------------------------------------------------------------------------------
/**
 * A calm one-time cue when `signal` changes (never on first render): a tint washes in over 200 ms and out over 450 ms
 * (`wash`), or a ring grows 2% and fades (`ring`). It sits behind the content and never delays it. Not for urgent content.
 */
export function Highlight({ signal, radius, color, kind = "wash" }: { signal: string; radius: number; color: string; kind?: "wash" | "ring" }) {
  const reduced = useReduceMotion();
  const o = useSharedValue(0);
  const prev = useRef(signal);
  useEffect(() => {
    if (prev.current === signal) return;
    prev.current = signal;
    if (reduced) return;
    o.set(withSequence(withTiming(1, { duration: MS.wash, easing: EASE }), withTiming(0, { duration: MS.fade, easing: EASE })));
  }, [signal, reduced, o]);
  const st = useAnimatedStyle(() => (kind === "ring"
    ? { opacity: o.get() * 0.7, transform: [{ scale: 1 + (1 - o.get()) * 0.02 }] }
    : { opacity: o.get() }));
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, kind === "ring" ? { borderRadius: radius, borderWidth: 2, borderColor: color, margin: -4 } : { borderRadius: radius, backgroundColor: color }, st]} />
  );
}

// ---- Progress ---------------------------------------------------------------------------------------------------------
/** Thin progress bar. Grows with scaleX from the left (no width animation, no layout shift), from `from` to `value`. */
export function ProgressBar({ value, from, color, track, height = 4 }: { value: number; from?: number; color: string; track: string; height?: number }) {
  const reduced = useReduceMotion();
  const v = useSharedValue(reduced ? value : from ?? value);
  useEffect(() => { v.set(reduced ? value : withTiming(value, { duration: MS.step, easing: EASE })); }, [value, reduced, v]);
  const st = useAnimatedStyle(() => ({ transform: [{ scaleX: v.get() }] }));
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: "hidden" }}>
      <Animated.View style={[{ height, width: "100%", borderRadius: height / 2, backgroundColor: color, transformOrigin: "left" }, st]} />
    </View>
  );
}

/** Vertical rail between two timeline steps; fills top-down with scaleY when `on`. */
export function Rail({ on, delay = 0, color, track }: { on: boolean; delay?: number; color: string; track: string }) {
  const reduced = useReduceMotion();
  const v = useSharedValue(reduced && on ? 1 : 0);
  useEffect(() => {
    const to = on ? 1 : 0;
    v.set(reduced ? to : withDelay(delay, withTiming(to, { duration: MS.step, easing: EASE })));
  }, [on, reduced, delay, v]);
  const st = useAnimatedStyle(() => ({ transform: [{ scaleY: v.get() }] }));
  return (
    <View style={{ flex: 1, width: 2, minHeight: 12, marginVertical: 4, borderRadius: 1, backgroundColor: track, overflow: "hidden" }}>
      <Animated.View style={[{ flex: 1, backgroundColor: color, transformOrigin: "top" }, st]} />
    </View>
  );
}

/** Loading shimmer across a muted bar (one of the two allowed loops). Reduced motion: a still bar. */
export function Shimmer({ color, track, height = 6 }: { color: string; track: string; height?: number }) {
  const reduced = useReduceMotion();
  const [w, setW] = useState(0);
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced || !w) { t.set(0); return; }
    t.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, false));
  }, [reduced, w, t]);
  const st = useAnimatedStyle(() => ({ opacity: reduced ? 0 : 1, transform: [{ translateX: -0.4 * w + t.get() * 1.4 * w }] }), [w, reduced]);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flex: 1, height, borderRadius: height / 2, backgroundColor: track, overflow: "hidden" }}>
      <Animated.View style={[{ width: "40%", height, borderRadius: height / 2, backgroundColor: color, opacity: 0 }, st]} />
    </View>
  );
}
