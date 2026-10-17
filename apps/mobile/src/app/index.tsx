import { color, LANGS, layout, mobileFont, space, type Lang } from "@medx/shared";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { createSession } from "@/api";
import { Page, Rule, T, Button } from "@/components/ui";
import { LANG_NAME, STR } from "@/i18n";
import { useStore } from "@/store";

export default function Pick() {
  const { set, reset } = useStore();
  const [busy, setBusy] = useState<Lang | null>(null);
  const [failed, setFailed] = useState<Lang | null>(null);
  const en = STR.en;

  async function choose(l: Lang) {
    setFailed(null); setBusy(l); reset(); set({ lang: l });
    try {
      set({ session: await createSession(l) });
      router.replace("/intake");
    } catch {
      setFailed(l);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page>
      <T lang="en" token="title" family="serif" weight="semibold">MedX Bridge</T>
      <View style={{ height: space[8] }} />
      <T lang="en" token="question" family="serif" weight="medium">{en.pickTitle}</T>
      <View style={{ height: space[3] }} />
      <T lang="en" tone="inkSoft">{en.pickSub}</T>
      <View style={{ height: space[8] }} />
      <Rule strong />
      {LANGS.map((l) => (
        <View key={l}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={LANG_NAME[l]}
            accessibilityHint={STR[l].pickA11y(LANG_NAME[l])}
            disabled={busy !== null}
            onPress={() => choose(l)}
            style={({ pressed }) => ({ minHeight: layout.hitTarget + space[3], flexDirection: "row", alignItems: "center", justifyContent: "space-between", transform: [{ translateY: pressed ? 1 : 0 }] })}
          >
            <T lang={l} token="lead" weight="medium">{LANG_NAME[l]}</T>
            {busy === l ? <ActivityIndicator color={color.inkSoft} /> : <T lang="en" token="lead" tone="inkSoft" importantForAccessibility="no">{">"}</T>}
          </Pressable>
          <Rule strong />
        </View>
      ))}
      {failed && (
        <View style={{ marginTop: space[5], gap: space[3] }} accessibilityRole="alert">
          <T lang={failed} tone="signal" weight="medium">{STR[failed].deskNoCode}</T>
          <Button lang={failed} label={STR[failed].retry} onPress={() => choose(failed)} />
        </View>
      )}
      <View style={{ height: space[6] }} />
      <T lang="en" token="small" tone="inkSoft">{en.privacy}</T>
      <View style={{ flexGrow: 1, minHeight: space[6] }} />
      <T lang="en" token="small" tone="graphite" style={{ fontFamily: mobileFont("sans", "en") }}>{en.disclaimer}</T>
    </Page>
  );
}
