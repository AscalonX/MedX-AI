import { color, space } from "@medx/shared";
import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { Check } from "@/components/icons";
import { Card, GradientHero, Page, T } from "@/components/ui";
import { STR } from "@/i18n";
import { useStore } from "@/store";

export default function Done() {
  const { lang, session } = useStore();
  const s = STR[lang];
  useEffect(() => { if (!session) router.replace("/"); }, [session]);
  if (!session) return null;
  const human = session.status === "needs_human";
  const steps: [string, "done" | "pending"][] = [[s.stepSent, "done"], [s.stepReview, "pending"], [s.stepReviewed, "pending"]];
  return (
    <Page>
      <GradientHero>
        <T lang={lang} token="body" tone="onPrimary" style={{ opacity: 0.92 }}>{s.doneCode}</T>
        <T lang="en" token="code" weight="bold" tone="onPrimary" accessibilityLabel={`${s.doneCode} ${session.code.split("").join(" ")}`} style={{ marginVertical: space[2] }}>{session.code}</T>
        <T lang={lang} token="lead" weight="bold" tone="onPrimary" accessibilityRole="header">{human ? s.humanTitle : s.doneTitle}</T>
      </GradientHero>

      {human && <Card tone="warn" style={{ marginTop: space[4] }}><T lang={lang} tone="ink">{s.humanBody}</T></Card>}

      <Card style={{ marginTop: space[4], gap: space[4] }}>
        {steps.map(([label, st], i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space[3] }} accessible accessibilityLabel={`${label}${st === "done" ? "" : ""}`}>
            <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: st === "done" ? color.teal : "transparent", borderWidth: st === "done" ? 0 : 2, borderColor: color.ruleStrong }}>
              {st === "done" && <Check color={color.onPrimary} size={14} />}
            </View>
            <T lang={lang} weight={st === "done" ? "bold" : "regular"} tone={st === "done" ? "ink" : "graphite"}>{label}</T>
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: space[4], gap: space[3] }}>
        <T lang={lang} token="body" weight="bold">{s.nextTitle}</T>
        {[s.doneNext1, s.doneNext3].map((l, i) => <T key={i} lang={lang} token="body" tone="inkSoft">{l}</T>)}
      </Card>
    </Page>
  );
}
