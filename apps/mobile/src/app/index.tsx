import { color, gradient, space } from "@medx/shared";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { createSession } from "@/api";
import { Card, GradientHero, Page, Pill, Segmented, T } from "@/components/ui";
import { STR } from "@/i18n";
import { useStore } from "@/store";

export default function Home() {
  const { lang, set, reset } = useStore();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const s = STR[lang];

  async function start() {
    setFailed(false); setBusy(true); reset();
    try {
      set({ session: await createSession(lang) });
      router.replace("/intake");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <LinearGradient colors={[gradient.primary.from, gradient.primary.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
          <T lang="en" token="body" weight="bold" tone="onPrimary" importantForAccessibility="no">M</T>
        </LinearGradient>
        <T lang="en" token="lead" weight="bold">MedX Bridge</T>
      </View>
      <View style={{ height: space[5] }} />
      <T lang={lang} token="body" tone="inkSoft">{s.hello}</T>
      <T lang={lang} token="title" weight="bold" accessibilityRole="header">{s.greetSub}</T>
      <View style={{ height: space[4] }} />
      <Segmented value={lang} onChange={(l) => set({ lang: l })} disabled={busy} />
      <View style={{ height: space[4] }} />

      <GradientHero>
        <T lang={lang} token="title" weight="bold" tone="onPrimary">{s.heroTitle}</T>
        <T lang={lang} token="body" tone="onPrimary" style={{ marginTop: space[2], marginBottom: space[5], opacity: 0.92 }}>{s.heroSub}</T>
        <View style={{ alignSelf: "flex-start" }}>
          {busy ? <ActivityIndicator color={color.onPrimary} style={{ minHeight: 48 }} /> : <Pill lang={lang} variant="white" label={s.start} onPress={start} />}
        </View>
      </GradientHero>

      {failed && (
        <Card tone="warn" style={{ marginTop: space[4], gap: space[3] }}>
          <View accessibilityRole="alert" style={{ gap: space[3] }}>
            <T lang={lang} weight="bold" tone="warn">{s.deskNoCode}</T>
            <View style={{ alignSelf: "flex-start" }}><Pill lang={lang} variant="quiet" label={s.retry} onPress={start} /></View>
          </View>
        </Card>
      )}

      <Card style={{ marginTop: space[4] }}>
        <T lang={lang} token="body" weight="bold" style={{ marginBottom: space[1] }}>{s.privacyTitle}</T>
        <T lang={lang} token="small" tone="inkSoft">{s.privacy}</T>
      </Card>

      <T lang={lang} token="body" weight="bold" style={{ marginTop: space[6], marginBottom: space[3] }}>{s.howTitle}</T>
      <Card style={{ gap: space[4] }}>
        {s.how.map(([t, d], i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color.tealTint, alignItems: "center", justifyContent: "center" }}>
              <T lang="en" token="small" weight="bold" tone="teal">{i + 1}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T lang={lang} token="body" weight="bold">{t}</T>
              <T lang={lang} token="small" tone="inkSoft">{d}</T>
            </View>
          </View>
        ))}
      </Card>

      <View style={{ flexGrow: 1, minHeight: space[6] }} />
      <T lang={lang} token="small" tone="graphite">{s.disclaimer}</T>
    </Page>
  );
}
