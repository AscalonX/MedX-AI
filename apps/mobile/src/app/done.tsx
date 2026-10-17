import { color, space, type Lang } from "@medx/shared";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import Animated, { Easing, FadeIn, ZoomIn, useReducedMotion } from "react-native-reanimated";
import { getSession, type PatientPickup, type PickupStatus } from "@/api";
import { Mascot } from "@/components/mascot";
import { Check } from "@/components/icons";
import { Card, GradientHero, Page, T } from "@/components/ui";
import { friendly, STR } from "@/i18n";
import { screenFor, useStore } from "@/store";
import { LOCALE } from "@/voice";

type St = "done" | "active" | "pending";
type Step = { label: string; st: St; at: string; hint?: string };
const POLL_MS = 4000;
const hhmm = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "");
const spell = (code: string) => code.split("").join(" ");

/** Medicine ready: one calm haptic, one screen-reader announcement, read aloud once if the patient turned that on. */
function announceReady(lang: Lang, aloud: boolean, code: string, pk: PatientPickup) {
  const t = STR[lang];
  const counter = pk?.counter ? friendly(pk.counter, lang) : undefined;
  const msg = `${t.pickupReadyTitle} ${t.pickupReadyBody(spell(code), counter)}`;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  AccessibilityInfo.announceForAccessibility(msg);
  if (aloud) Speech.speak(msg, { language: LOCALE[lang], rate: 0.9 });
}

export default function Done() {
  const { lang, session, update, offline, speak } = useStore();
  const s = STR[lang];
  const reduced = useReducedMotion();
  const [reviewedAt, setReviewedAt] = useState<string | null>(null);
  // No timestamps reach the patient: these are the times this phone first saw each pickup step.
  const [pickupAt, setPickupAt] = useState<Partial<Record<PickupStatus, string>>>({});
  const prev = useRef<string | null>(null);
  const lastPickup = useRef<PickupStatus | null>(session?.pickup?.status ?? null);
  const voice = useRef({ lang, speak });
  useEffect(() => { voice.current = { lang, speak }; });
  useEffect(() => { if (!session) router.replace("/"); else if (screenFor(session) !== "/done") router.replace(screenFor(session)); }, [session]);

  // Live status: poll the session every 4 s through nurse review and the pharmacy, until the medicine is collected.
  const id = session?.id;
  const final = session?.status === "approved" || session?.status === "taken_over";
  const collected = session?.pickup?.status === "collected";
  useEffect(() => {
    if (!id || collected) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Single-flight: the next poll is scheduled only after the previous one settles; nothing runs after unmount.
    const tick = async () => {
      try {
        const r = await getSession(id);
        if (!alive) return;
        const now = new Date().toISOString();
        if (r.session.status === "approved" || r.session.status === "taken_over") setReviewedAt((v) => v ?? now); // no audit for patients: time = when this phone first saw it
        const next = r.session.pickup?.status ?? null;
        if (next && next !== lastPickup.current) {
          setPickupAt((m) => ({ ...m, [next]: now }));
          if (next === "ready") announceReady(voice.current.lang, voice.current.speak, r.session.code, r.session.pickup);
        }
        lastPickup.current = next;
        update(r.session);
        if (r.session.status === "escalated") router.replace("/redflag"); // a red flag can never be missed
      } catch { /* offline: keep what we show, try again */ }
      if (alive) timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [id, collected]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = session?.status;
  useEffect(() => {
    if (status && prev.current && prev.current !== status) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (status) prev.current = status;
  }, [status]);

  if (!session) return null;
  const human = session.status === "needs_human";
  const pk = session.pickup;
  // A prescription reached the pharmacy: a clinician has seen this patient, whatever the intake status says.
  const seen = final || !!pk;
  const steps: Step[] = [
    { label: s.stepSent, st: "done", at: hhmm(session.turns.at(-1)?.at) },
    { label: s.stepReview, st: seen ? "done" : "active", at: "", hint: s.reviewingNote },
    { label: s.stepReviewed, st: seen ? "done" : "pending", at: final ? hhmm(reviewedAt) : "" },
  ];
  if (pk) {
    steps.push({ label: s.stepPreparing, st: pk.status === "preparing" ? "active" : "done", at: hhmm(pickupAt.preparing) });
    steps.push(pk.status === "collected"
      ? { label: s.stepCollected, st: "done", at: hhmm(pickupAt.collected) }
      : { label: s.stepReady, st: pk.status === "ready" ? "active" : "pending", at: hhmm(pickupAt.ready) });
  }
  const title = pk?.status === "ready" ? s.pickupReadyTitle : pk?.status === "collected" ? s.pickupCollectedTitle : pk ? s.pickupPreparingTitle : final ? s.reviewedTitle : human ? s.humanTitle : s.doneTitle;
  const note = pk ? "" : final ? s.reviewedNext : !seen ? s.reviewingNote : "";
  const calm = session.status === "awaiting_review" || final || !!pk;

  return (
    <Page>
      <GradientHero style={{ overflow: "hidden" }}>
        {calm && <View pointerEvents="none" style={{ position: "absolute", right: 4, bottom: 0, width: 110, height: 110, alignItems: "center", justifyContent: "flex-end" }}><View style={{ position: "absolute", bottom: 10, width: 88, height: 88, borderRadius: 44, backgroundColor: "rgba(255,255,255,0.16)" }} /><Mascot pose="happy" size={100} /></View>}
        <T lang={lang} token="body" tone="onPrimary" style={{ opacity: 0.92 }}>{s.doneCode}</T>
        <T lang="en" token="code" weight="bold" tone="onPrimary" accessibilityLabel={`${s.doneCode} ${spell(session.code)}`} style={{ marginVertical: space[2] }}>{session.code}</T>
        <T lang={lang} token="lead" weight="bold" tone="onPrimary" accessibilityRole="header" accessibilityLiveRegion="polite" style={calm ? { maxWidth: "66%" } : undefined}>{title}</T>
      </GradientHero>

      {pk && <PickupCard lang={lang} code={session.code} pickup={pk} reduced={reduced} />}

      {human && !final && !pk && <Card tone="warn" style={{ marginTop: space[4] }}><T lang={lang} tone="ink">{s.humanBody}</T></Card>}

      <Card style={{ marginTop: space[4], gap: space[4] }}>
        {steps.map(({ label, st, at, hint }, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space[3] }} accessible accessibilityLabel={`${label}${at ? ", " + s.stepAt(at) : ""}${st === "active" && hint ? ", " + hint : ""}`}>
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

      {offline && <T lang={lang} token="small" tone="warn" style={{ marginTop: space[3] }}>{s.offlineNote}</T>}
      <Card style={{ marginTop: space[4], gap: space[3] }}>
        <T lang={lang} token="body" weight="bold">{s.nextTitle}</T>
        {(pk ? [s.doneNext3] : [s.doneNext1, s.doneNext3]).map((l, i) => <T key={i} lang={lang} token="body" tone="inkSoft">{l}</T>)}
      </Card>
    </Page>
  );
}

/** Medicine pickup, in the live status area. Status and counter only: the patient phone never shows drug names, staff or notes. */
function PickupCard({ lang, code, pickup, reduced }: { lang: Lang; code: string; pickup: NonNullable<PatientPickup>; reduced: boolean }) {
  const s = STR[lang];
  const counter = pickup.counter ? friendly(pickup.counter, lang) : undefined;
  const ready = pickup.status === "ready";
  // Non-breaking hyphen: the code never wraps as "B-" / "042" (screen readers get the spelled-out code below).
  const body = ready ? s.pickupReadyBody(code.replace(/-/g, "‑"), counter) : pickup.status === "collected" ? s.pickupCollectedBody : s.pickupPreparingBody;
  const a11y = ready ? `${s.pickupReadyTitle} ${s.pickupReadyBody(spell(code), counter)}` : body;
  return (
    <Animated.View key={pickup.status} entering={FadeIn.duration(reduced ? 0 : 240).easing(Easing.bezier(0.22, 1, 0.36, 1))} style={{ marginTop: space[4] }}>
      <Card tone={ready ? "tint" : "sheet"} style={ready ? { borderWidth: 2, borderColor: color.teal, gap: space[3] } : { gap: space[2] }}>
        <View accessible accessibilityLabel={a11y} accessibilityLiveRegion="polite" style={{ gap: space[3] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            {pickup.status === "collected" ? (
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color.teal, alignItems: "center", justifyContent: "center" }}><Check color={color.onPrimary} size={13} /></View>
            ) : (
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color.teal }} />
            )}
            <T lang={lang} token="body" weight="bold" tone="teal">{s.pickupEyebrow}</T>
          </View>
          {ready && !!counter && (
            <View>
              <T lang={lang} token="body" tone="inkSoft">{s.pickupCounter}</T>
              <T lang={lang} token={counter.length <= 4 ? "code" : "title"} weight="bold" tone="teal">{counter}</T>
            </View>
          )}
          <T lang={lang} token={ready ? "title" : "bodyPatient"} weight={ready ? "bold" : "regular"} tone={ready ? "ink" : "inkSoft"}>{body}</T>
        </View>
      </Card>
    </Animated.View>
  );
}
