import { color, space } from "@medx/shared";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { Easing, ZoomIn, useReducedMotion } from "react-native-reanimated";
import { getSession } from "@/api";
import { Check } from "@/components/icons";
import { Card, GradientHero, Page, T } from "@/components/ui";
import { STR } from "@/i18n";
import { screenFor, useStore } from "@/store";

type St = "done" | "active" | "pending";
const POLL_MS = 4000;
const hhmm = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "");

export default function Done() {
  const { lang, session, set } = useStore();
  const s = STR[lang];
  const reduced = useReducedMotion();
  const [reviewedAt, setReviewedAt] = useState<string | null>(null);
  const prev = useRef<string | null>(null);
  useEffect(() => { if (!session) router.replace("/"); else if (screenFor(session) !== "/done") router.replace(screenFor(session)); }, [session]);

  // Live status: poll the session every 4 s until a nurse has reviewed it.
  const id = session?.id;
  const final = session?.status === "approved" || session?.status === "taken_over";
  useEffect(() => {
    if (!id || final) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await getSession(id);
        if (!alive) return;
        setReviewedAt(r.reviewedAt);
        set({ session: r.session });
        if (r.session.status === "escalated") router.replace("/redflag"); // a red flag can never be missed
      } catch { /* offline: keep what we show, try again */ }
    };
    const t = setInterval(tick, POLL_MS);
    tick();
    return () => { alive = false; clearInterval(t); };
  }, [id, final]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = session?.status;
  useEffect(() => {
    if (status && prev.current && prev.current !== status) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (status) prev.current = status;
  }, [status]);

  if (!session) return null;
  const human = session.status === "needs_human";
  const steps: [string, St, string][] = [
    [s.stepSent, "done", hhmm(session.turns.at(-1)?.at ?? session.updatedAt)],
    [s.stepReview, final ? "done" : "active", ""],
    [s.stepReviewed, final ? "done" : "pending", final ? hhmm(reviewedAt) : ""],
  ];
  const title = final ? s.reviewedTitle : human ? s.humanTitle : s.doneTitle;
  const note = final ? s.reviewedNext : steps[1][1] === "active" ? s.reviewingNote : "";

  return (
    <Page>
      <GradientHero>
        <T lang={lang} token="body" tone="onPrimary" style={{ opacity: 0.92 }}>{s.doneCode}</T>
        <T lang="en" token="code" weight="bold" tone="onPrimary" accessibilityLabel={`${s.doneCode} ${session.code.split("").join(" ")}`} style={{ marginVertical: space[2] }}>{session.code}</T>
        <T lang={lang} token="lead" weight="bold" tone="onPrimary" accessibilityRole="header" accessibilityLiveRegion="polite">{title}</T>
      </GradientHero>

      {human && !final && <Card tone="warn" style={{ marginTop: space[4] }}><T lang={lang} tone="ink">{s.humanBody}</T></Card>}

      <Card style={{ marginTop: space[4], gap: space[4] }}>
        {steps.map(([label, st, at], i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space[3] }} accessible accessibilityLabel={`${label}${at ? ", " + s.stepAt(at) : ""}${st === "done" ? "" : st === "active" ? ", " + s.reviewingNote : ""}`}>
            <View style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}>
              {st === "done" ? (
                <Animated.View key="d" entering={ZoomIn.duration(reduced ? 0 : 240).easing(Easing.bezier(0.22, 1, 0.36, 1))} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color.teal, alignItems: "center", justifyContent: "center" }}>
                  <Check color={color.onPrimary} size={16} />
                </Animated.View>
              ) : (
                <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: st === "active" ? color.teal : color.ruleStrong, alignItems: "center", justifyContent: "center" }}>
                  {st === "active" && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color.teal }} />}
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <T lang={lang} weight={st === "pending" ? "regular" : "bold"} tone={st === "pending" ? "graphite" : "ink"}>{label}</T>
            </View>
            {!!at && <T lang={lang} token="small" tone="inkSoft">{at}</T>}
          </View>
        ))}
        {!!note && <T lang={lang} token="body" tone="inkSoft">{note}</T>}
      </Card>

      <Card style={{ marginTop: space[4], gap: space[3] }}>
        <T lang={lang} token="body" weight="bold">{s.nextTitle}</T>
        {[s.doneNext1, s.doneNext3].map((l, i) => <T key={i} lang={lang} token="body" tone="inkSoft">{l}</T>)}
      </Card>
    </Page>
  );
}
