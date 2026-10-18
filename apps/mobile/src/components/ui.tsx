import { color, duration, gradient, layout, lineHeightPx, radius, shadow, space, type as scale } from "@medx/shared";
import type { Lang, TypeToken } from "@medx/shared";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type TextProps, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { EASE, Enter, Press, useReduceMotion } from "@/components/motion";
import { fontFor, type Weight } from "@/fonts";

export const sh = (s: { x: number; y: number; blur: number; spread: number; color: string }) =>
  `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`;
export const cardShadow = { boxShadow: sh(shadow.sheet) } as ViewStyle;

type TProps = TextProps & { lang: Lang; token?: TypeToken; weight?: Weight; tone?: keyof typeof color; light?: boolean; children: ReactNode };

/**
 * Text in the patient's language: Plus Jakarta Sans (en, it) or Noto Sans Thai (th), see fonts.ts.
 * `lang` drives the face, the line height (Thai stacked marks) and the VoiceOver voice. Thai tracking is always 0.
 * Codes and big numbers use tabular figures. `light` is kept for older calls and maps to regular.
 */
export function T({ lang, token = "bodyPatient", weight = "regular", tone = "ink", light, style, ...p }: TProps) {
  const t = scale[token];
  const nums = token === "code" || token === "stat";
  return (
    <Text
      {...p}
      accessibilityLanguage={lang}
      maxFontSizeMultiplier={1.6}
      style={[{ fontFamily: fontFor(lang, light ? "regular" : weight), fontSize: t.size, lineHeight: lineHeightPx(token, lang), letterSpacing: lang === "th" ? 0 : t.tracking * t.size, color: color[tone] }, nums && { fontVariant: ["tabular-nums"] }, style]}
    />
  );
}

export function Card({ children, style, tone = "sheet" }: { children: ReactNode; style?: ViewStyle; tone?: "sheet" | "tint" | "warn" }) {
  const bg = tone === "tint" ? color.tealTint : tone === "warn" ? color.warnTint : color.sheet;
  return <View style={[{ backgroundColor: bg, borderRadius: radius.card, padding: space[5], borderWidth: 1, borderColor: color.rule }, cardShadow, style]}>{children}</View>;
}

export function GradientHero({ children, signal, style }: { children: ReactNode; signal?: boolean; style?: ViewStyle }) {
  const g = signal ? gradient.signal : gradient.primary;
  return (
    <LinearGradient colors={[g.from, g.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: radius.hero, padding: space[6] }, { boxShadow: sh(shadow.hero) } as ViewStyle, style]}>
      {children}
    </LinearGradient>
  );
}

/** Pill button. variant: gradient (primary), white (on gradient/red), quiet (outline). Sinks slightly while pressed. */
export function Pill({ lang, label, onPress, disabled, variant = "gradient", tone, a11yHint, still }: { lang: Lang; label: string; onPress: () => void; disabled?: boolean; variant?: "gradient" | "white" | "quiet"; tone?: keyof typeof color; a11yHint?: string; still?: boolean }) {
  const inner = (
    <T lang={lang} token="lead" weight="semibold" tone={tone ?? (variant === "gradient" ? "onPrimary" : variant === "white" ? "ocean" : "ink")}>{label}</T>
  );
  const base: ViewStyle = { minHeight: layout.hitTarget, borderRadius: radius.pill, justifyContent: "center", alignItems: "center", paddingHorizontal: space[6] };
  const body = variant === "gradient" ? (
    <LinearGradient colors={[gradient.primary.from, gradient.primary.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={base}>{inner}</LinearGradient>
  ) : (
    <View style={[base, variant === "white" ? { backgroundColor: color.sheet } : { borderWidth: 1.5, borderColor: color.ruleStrong, backgroundColor: color.sheet }]}>{inner}</View>
  );
  const a11y = { accessibilityRole: "button" as const, accessibilityLabel: label, accessibilityHint: a11yHint, accessibilityState: { disabled: !!disabled }, disabled, onPress };
  // `still`: urgent screens (red flag) keep a static button.
  if (still) return <Pressable {...a11y} style={{ opacity: disabled ? 0.45 : 1 }}>{body}</Pressable>;
  return <Press {...a11y} style={{ opacity: disabled ? 0.45 : 1 }}>{body}</Press>;
}

export function Chip({ lang, label, onPress, selected, a11y }: { lang: Lang; label: string; onPress?: () => void; selected?: boolean; a11y?: string }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={a11y ?? label} aria-label={a11y ?? label} accessibilityState={{ selected: !!selected }} onPress={onPress} to={0.94}
      style={{ minHeight: 44, minWidth: 44, paddingHorizontal: space[4], borderRadius: radius.pill, justifyContent: "center", alignItems: "center", backgroundColor: selected ? color.tealTint : color.sheet, borderWidth: 1.5, borderColor: selected ? color.teal : color.rule }}>
      <T lang={lang} token="body" weight="semibold" tone={selected ? "teal" : "ink"}>{label}</T>
    </Press>
  );
}

/** Small non-interactive pill (code, progress). */
export function Badge({ lang, label, tone = "muted", a11y }: { lang: Lang; label: string; tone?: "muted" | "tint"; a11y?: string }) {
  return (
    <View accessible accessibilityLabel={a11y ?? label} style={{ paddingHorizontal: space[3], minHeight: 32, borderRadius: radius.pill, justifyContent: "center", backgroundColor: tone === "tint" ? color.tealTint : color.muted }}>
      <T lang={lang} token="small" weight="semibold" tone={tone === "tint" ? "teal" : "inkSoft"}>{label}</T>
    </View>
  );
}

/** Eyebrow chip: a small teal dot and a short label, in a white pill (reference: pill chips above big headlines). */
export function Eyebrow({ lang, label }: { lang: Lang; label: string }) {
  return (
    <View style={[{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[3], minHeight: 30, borderRadius: radius.pill, backgroundColor: color.sheet, borderWidth: 1, borderColor: color.rule }, { boxShadow: sh(shadow.hairline) } as ViewStyle]}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color.teal }} />
      <T lang={lang} token="small" weight="semibold" tone="teal">{label}</T>
    </View>
  );
}

// English first: it is the default visit language (owner decision, 17 Oct 2026). Thai and Italian stay one tap away.
const SEG: { l: Lang; label: string }[] = [{ l: "en", label: "English" }, { l: "th", label: "ไทย" }, { l: "it", label: "Italiano" }];
const PAD = 4;
/** Language segmented control: muted track, a white raised thumb that slides to the choice (`base`), labels in their own language. */
export function Segmented({ value, onChange, disabled }: { value: Lang; onChange: (l: Lang) => void; disabled?: boolean }) {
  const reduced = useReduceMotion();
  const [w, setW] = useState(0);
  const idx = Math.max(0, SEG.findIndex((x) => x.l === value));
  const seg = w > 0 ? (w - PAD * 2) / SEG.length : 0;
  const x = useSharedValue(idx);
  useEffect(() => { x.set(reduced ? idx : withTiming(idx, { duration: duration.base, easing: EASE })); }, [idx, reduced, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() * seg }] }), [seg]);
  return (
    <View accessibilityRole="tablist" onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", backgroundColor: color.muted, borderRadius: radius.pill, padding: PAD }}>
      {seg > 0 && <Animated.View pointerEvents="none" style={[{ position: "absolute", top: PAD, bottom: PAD, left: PAD, width: seg, borderRadius: radius.pill, backgroundColor: color.sheet }, { boxShadow: sh(shadow.hairline) } as ViewStyle, thumb]} />}
      {SEG.map(({ l, label }) => {
        const on = l === value;
        return (
          <Press key={l} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on, disabled }} aria-selected={on} disabled={disabled} onPress={() => onChange(l)}
            style={[{ flex: 1, minHeight: 44, borderRadius: radius.pill, justifyContent: "center", alignItems: "center" }, on && seg === 0 && ({ backgroundColor: color.sheet, boxShadow: sh(shadow.hairline) } as ViewStyle)]}>
            {/* Noto Sans Thai's tall metrics (room for stacked marks) sit the word ~2 pt high next to Latin: optical nudge. */}
            <T lang={l} token="body" weight={on ? "bold" : "regular"} tone={on ? "ink" : "inkSoft"} style={l === "th" ? { marginTop: 2 } : undefined}>{label}</T>
          </Press>
        );
      })}
    </View>
  );
}

/** Soft radial tints of the brand colours in the top corners of the mist page (static, decorative). */
function Mist() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={460} height={460} style={{ position: "absolute", top: -220, left: -190 }}>
        <Defs>
          <RadialGradient id={`${id}t`} cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={color.primaryFrom} stopOpacity={0.16} /><Stop offset="1" stopColor={color.primaryFrom} stopOpacity={0} /></RadialGradient>
        </Defs>
        <Circle cx={230} cy={230} r={230} fill={`url(#${id}t)`} />
      </Svg>
      <Svg width={520} height={520} style={{ position: "absolute", top: -200, right: -260 }}>
        <Defs>
          <RadialGradient id={`${id}o`} cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={color.primaryTo} stopOpacity={0.13} /><Stop offset="1" stopColor={color.primaryTo} stopOpacity={0} /></RadialGradient>
        </Defs>
        <Circle cx={260} cy={260} r={260} fill={`url(#${id}o)`} />
      </Svg>
    </View>
  );
}

/**
 * Page: side margin 20, room for the tab bar, mist tints, and a short fade + rise when the screen opens.
 * `enter={false}` for urgent screens: they appear instantly and stay still.
 */
export function Page({ children, bg = color.paper, tabs = true, enter = true }: { children: ReactNode; bg?: string; tabs?: boolean; enter?: boolean }) {
  const i = useSafeAreaInsets();
  const column: ViewStyle = { width: "100%", maxWidth: 560, alignSelf: "center", flexGrow: 1 };
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {bg === color.paper && <Mist />}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingTop: i.top + space[4], paddingBottom: (tabs ? layout.patient.tabBar + i.bottom : i.bottom) + space[6], paddingHorizontal: layout.patient.sideMargin }}>
        {/* `enter` is fixed per screen, so switching element types here never remounts a live screen. */}
        {enter ? <Enter dy={6} style={column}>{children}</Enter> : <View style={column}>{children}</View>}
      </ScrollView>
    </View>
  );
}
