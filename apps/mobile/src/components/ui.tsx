import { color, gradient, layout, lineHeightPx, radius, shadow, space, type as scale } from "@medx/shared";
import type { FontWeightName, Lang, TypeToken } from "@medx/shared";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View, type TextProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// SCBXBeta2 for every language (owner decision). Registered in _layout.tsx under these exact names.
const FONT = { light: "SCBXBeta2-Light", regular: "SCBXBeta2-Regular", bold: "SCBXBeta2-Bold" };
const weightFont = (w: FontWeightName) => (w === "regular" ? FONT.regular : FONT.bold);
export const fontLight = FONT.light;

export const sh = (s: { x: number; y: number; blur: number; spread: number; color: string }) =>
  `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`;
export const cardShadow = { boxShadow: sh(shadow.sheet) } as ViewStyle;

type TProps = TextProps & { lang: Lang; token?: TypeToken; weight?: FontWeightName; tone?: keyof typeof color; light?: boolean; children: ReactNode };

/** Text in the patient's language. `lang` drives line height (Thai stacked marks) and VoiceOver voice. */
export function T({ lang, token = "bodyPatient", weight = "regular", tone = "ink", light, style, ...p }: TProps) {
  const t = scale[token];
  return (
    <Text
      {...p}
      accessibilityLanguage={lang}
      maxFontSizeMultiplier={1.6}
      style={[{ fontFamily: light ? FONT.light : weightFont(weight), fontSize: t.size, lineHeight: lineHeightPx(token, lang), letterSpacing: t.tracking * t.size, color: color[tone] }, style]}
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

/** Pill button. variant: gradient (primary), white (on gradient/red), quiet (outline). */
export function Pill({ lang, label, onPress, disabled, variant = "gradient", tone, a11yHint }: { lang: Lang; label: string; onPress: () => void; disabled?: boolean; variant?: "gradient" | "white" | "quiet"; tone?: keyof typeof color; a11yHint?: string }) {
  const inner = (
    <T lang={lang} token="lead" weight="bold" tone={tone ?? (variant === "gradient" ? "onPrimary" : variant === "white" ? "ocean" : "ink")}>{label}</T>
  );
  const base: ViewStyle = { minHeight: layout.hitTarget, borderRadius: radius.pill, justifyContent: "center", alignItems: "center", paddingHorizontal: space[6] };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={a11yHint} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      {variant === "gradient" ? (
        <LinearGradient colors={[gradient.primary.from, gradient.primary.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={base}>{inner}</LinearGradient>
      ) : (
        <View style={[base, variant === "white" ? { backgroundColor: color.sheet } : { borderWidth: 1.5, borderColor: color.ruleStrong }]}>{inner}</View>
      )}
    </Pressable>
  );
}

export function Chip({ lang, label, onPress, selected }: { lang: Lang; label: string; onPress?: () => void; selected?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!selected }} onPress={onPress}
      style={{ minHeight: 44, minWidth: 44, paddingHorizontal: space[4], borderRadius: radius.pill, justifyContent: "center", alignItems: "center", backgroundColor: selected ? color.tealTint : color.sheet, borderWidth: 1.5, borderColor: selected ? color.teal : color.rule }}>
      <T lang={lang} token="body" weight={selected ? "bold" : "regular"} tone={selected ? "teal" : "ink"}>{label}</T>
    </Pressable>
  );
}

/** Small non-interactive pill (code, progress). */
export function Badge({ lang, label, tone = "muted", a11y }: { lang: Lang; label: string; tone?: "muted" | "tint"; a11y?: string }) {
  return (
    <View accessible accessibilityLabel={a11y ?? label} style={{ paddingHorizontal: space[3], minHeight: 32, borderRadius: radius.pill, justifyContent: "center", backgroundColor: tone === "tint" ? color.tealTint : color.muted }}>
      <T lang={lang} token="small" weight="bold" tone={tone === "tint" ? "teal" : "inkSoft"}>{label}</T>
    </View>
  );
}

const SEG: { l: Lang; label: string }[] = [{ l: "th", label: "ไทย" }, { l: "it", label: "Italiano" }, { l: "en", label: "English" }];
/** Language segmented control: muted track, white raised thumb, labels in their own language. */
export function Segmented({ value, onChange, disabled }: { value: Lang; onChange: (l: Lang) => void; disabled?: boolean }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", backgroundColor: color.muted, borderRadius: radius.pill, padding: 4 }}>
      {SEG.map(({ l, label }) => {
        const on = l === value;
        return (
          <Pressable key={l} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on, disabled }} disabled={disabled} onPress={() => onChange(l)}
            style={[{ flex: 1, minHeight: 44, borderRadius: radius.pill, justifyContent: "center", alignItems: "center" }, on && ({ backgroundColor: color.sheet, boxShadow: sh(shadow.hairline) } as ViewStyle)]}>
            <T lang={l} token="body" weight={on ? "bold" : "regular"} tone={on ? "ink" : "inkSoft"}>{label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Page: side margin 20, room for the tab bar. */
export function Page({ children, bg = color.paper, tabs = true }: { children: ReactNode; bg?: string; tabs?: boolean }) {
  const i = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingTop: i.top + space[4], paddingBottom: (tabs ? layout.patient.tabBar + i.bottom : i.bottom) + space[6], paddingHorizontal: layout.patient.sideMargin }}>
        <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", flexGrow: 1 }}>{children}</View>
      </ScrollView>
    </View>
  );
}
