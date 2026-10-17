import type { FontRole, FontWeightName, Lang, TypeToken } from "@medx/shared";
import { color, layout, lineHeightPx, mobileFont, radius, space, type as scale } from "@medx/shared";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View, type TextProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TProps = TextProps & {
  lang: Lang; token?: TypeToken; family?: FontRole; weight?: FontWeightName; tone?: keyof typeof color; children: ReactNode;
};

/** Text in the patient's language: picks the font family per language (no per-glyph fallback on native). */
export function T({ lang, token = "bodyPatient", family = "sans", weight = "regular", tone = "ink", style, ...p }: TProps) {
  return (
    <Text
      {...p}
      accessibilityLanguage={lang}
      maxFontSizeMultiplier={1.6}
      style={[{ fontFamily: mobileFont(family, lang, weight), fontSize: scale[token].size, lineHeight: lineHeightPx(token, lang), letterSpacing: scale[token].tracking * scale[token].size, color: color[tone] }, style]}
    />
  );
}

export function Button({ lang, label, onPress, disabled, onSignal, a11yHint }: { lang: Lang; label: string; onPress: () => void; disabled?: boolean; onSignal?: boolean; a11yHint?: string }) {
  const fill = onSignal ? color.onSignal : color.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={a11yHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: layout.hitTarget, backgroundColor: fill, borderRadius: radius.control, justifyContent: "center", alignItems: "center", paddingHorizontal: space[6], opacity: disabled ? 0.45 : 1, transform: [{ translateY: pressed ? 1 : 0 }] })}
    >
      <T lang={lang} weight="semibold" tone={onSignal ? "signal" : "onSignal"}>{label}</T>
    </Pressable>
  );
}

export function Rule({ strong }: { strong?: boolean }) {
  return <View style={{ height: 1, backgroundColor: strong ? color.ruleStrong : color.rule }} />;
}


/** Paper page: safe areas, 24pt side margin, readable measure on wide (web) screens. */
export function Page({ children, bg = color.paper, footer }: { children: ReactNode; bg?: string; footer?: ReactNode }) {
  const i = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingTop: i.top + space[4], paddingBottom: i.bottom + space[6], paddingHorizontal: layout.patient.sideMargin }}
      >
        <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", flexGrow: 1 }}>{children}</View>
      </ScrollView>
      {footer}
    </View>
  );
}
