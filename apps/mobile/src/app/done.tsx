import { color, space } from "@medx/shared";
import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { Page, Rule, T } from "@/components/ui";
import { STR } from "@/i18n";
import { useStore } from "@/store";

export default function Done() {
  const { lang, session, reset } = useStore();
  const s = STR[lang];
  useEffect(() => { if (!session) router.replace("/"); }, [session]);
  if (!session) return null;
  const human = session.status === "needs_human";
  return (
    <Page>
      <T lang={lang} token="title" family="serif" weight="semibold" tone="inkSoft">MedX Bridge</T>
      <View style={{ height: space[8] }} />
      <T lang={lang} token="display" family="serif" weight="medium" accessibilityRole="header">{human ? s.humanTitle : s.doneTitle}</T>
      <View style={{ height: space[6] }} />
      {human && <T lang={lang} tone="inkSoft" style={{ marginBottom: space[6] }}>{s.humanBody}</T>}
      <T lang={lang} token="small" tone="inkSoft">{s.doneCode}</T>
      <T lang="en" token="code" weight="semibold" accessibilityLabel={`${s.doneCode} ${session.code.split("").join(" ")}`} style={{ marginVertical: space[2] }}>{session.code}</T>
      <View style={{ height: space[6] }} />
      <Rule strong />
      {(human ? [s.doneNext1, s.doneNext3] : [s.doneNext1, s.doneNext3]).map((line, i) => (
        <View key={i}>
          <T lang={lang} style={{ paddingVertical: space[3] }}>{line}</T>
          <Rule />
        </View>
      ))}
      <View style={{ flexGrow: 1, minHeight: space[8] }} />
      <Pressable
        accessibilityRole="button"
        onPress={() => { reset(); router.replace("/"); }}
        style={{ minHeight: 48, justifyContent: "center", alignSelf: "flex-start" }}
      >
        <T lang={lang} token="small" tone="inkSoft" style={{ textDecorationLine: "underline", textDecorationColor: color.graphite }}>{s.newIntake}</T>
      </Pressable>
    </Page>
  );
}
