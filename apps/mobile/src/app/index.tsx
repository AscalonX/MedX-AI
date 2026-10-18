import { color, space } from "@medx/shared";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { createSession, pickupPending } from "@/api";
import { Info } from "@/components/icons";
import { LogoLockup } from "@/components/logo";
import { Mascot } from "@/components/mascot";
import { Enter, MS } from "@/components/motion";
import { NewVisitCard } from "@/components/newvisit";
import { Card, Eyebrow, GradientHero, Page, Pill, Segmented, T } from "@/components/ui";
import { STR } from "@/i18n";
import { screenFor, useStore } from "@/store";

const BRAND = "MedX";

export default function Home() {
  const { lang, session, ready, set, startOver } = useStore();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const s = STR[lang];
  // The visit language is fixed while a session is active; a finished visit unlocks it (not while medicine is still on its way).
  const locked = !!session && (pickupPending(session) || (session.status !== "approved" && session.status !== "taken_over"));

  async function start() {
    // A double tap or a tap before the stored visit has loaded must not create a second session.
    if (busy || !ready) return;
    // A visit already on this phone opens instead of being replaced: clearing it goes through "Start a new visit"
    // (confirm sheet), so a tap here never loses a visit, or the counter call for medicine still on its way.
    if (session) { router.replace(screenFor(session)); return; }
    setFailed(false); setBusy(true);
    try {
      set({ session: await createSession(lang) });
      router.replace("/intake");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  // Two-tone headline: the brand word in ocean, the rest in ink.
  const [lead, tail] = s.greetSub.includes(BRAND) ? [s.greetSub.slice(0, s.greetSub.indexOf(BRAND)), s.greetSub.slice(s.greetSub.indexOf(BRAND) + BRAND.length)] : [s.greetSub, ""];
  const hasBrand = s.greetSub.includes(BRAND);

  return (
    <Page>
      {/* Staff only: long-press the logo for 2 s to forget the stored session and start fresh (no sheet). */}
      <Pressable onLongPress={() => { startOver(); router.replace("/"); }} delayLongPress={2000} accessible={false} style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <LogoLockup height={36} />
      </Pressable>
      <View style={{ height: space[6] }} />
      {/* Language switch: the copy fades and rises 2 pt (DIRECTION 6e); the control itself stays put. */}
      <Enter key={`greet-${lang}`} dy={2} ms={MS.morph}>
        <Eyebrow lang={lang} label={s.hello} />
        <T lang={lang} token="display" weight="extrabold" accessibilityRole="header" style={{ marginTop: space[3] }}>
          {lead}{hasBrand && <Text style={{ color: color.ocean }}>{BRAND}</Text>}{tail}
        </T>
      </Enter>
      <View style={{ height: space[5] }} />
      <Segmented value={lang} onChange={(l) => set({ lang: l })} disabled={busy || locked || !ready} />
      {locked && <T lang={lang} token="small" tone="graphite" style={{ marginTop: space[2] }}>{s.langLocked}</T>}
      <View style={{ height: space[5] }} />

      {/* Hero card: one soft entrance (fade + 14 pt rise), then Fin floats. */}
      <Enter dy={14} ms={MS.hero} delay={60}>
        <GradientHero style={{ minHeight: 236, overflow: "hidden" }}>
          <Enter dy={10} ms={MS.hero} delay={180} style={{ position: "absolute", right: -6, bottom: -6, width: 150, height: 150, alignItems: "center", justifyContent: "flex-end", pointerEvents: "none" }}>
            <View pointerEvents="none" style={{ position: "absolute", bottom: 14, width: 118, height: 118, borderRadius: 59, backgroundColor: "rgba(255,255,255,0.16)" }} />
            <Mascot pose="wave" size={132} />
          </Enter>
          <Enter key={`hero-${lang}-${session ? "visit" : "new"}`} dy={2} ms={MS.morph}>
            <T lang={lang} token="title" weight="bold" tone="onPrimary" style={{ maxWidth: "70%" }}>{session ? s.heroVisitTitle : s.heroTitle}</T>
            <T lang={lang} token="body" tone="onPrimary" style={{ marginTop: space[2], marginBottom: space[5], opacity: 0.92, maxWidth: "62%" }}>{session ? s.heroVisitSub(session.code.replace(/-/g, "‑")) : s.heroSub}</T>
          </Enter>
          <View style={{ alignSelf: "flex-start" }}>
            {busy ? <ActivityIndicator color={color.onPrimary} style={{ minHeight: 48 }} /> : <Pill lang={lang} variant="white" label={session ? (locked ? s.resume : s.openVisit) : s.start} onPress={start} disabled={!ready} />}
          </View>
        </GradientHero>
      </Enter>

      {/* Errors appear at once and stay still. */}
      {failed && (
        <Card tone="warn" style={{ marginTop: space[4], gap: space[3] }}>
          <View accessibilityRole="alert" style={{ gap: space[3] }}>
            <T lang={lang} weight="bold" tone="warn">{s.deskNoCode}</T>
            <View style={{ alignSelf: "flex-start" }}><Pill lang={lang} variant="quiet" label={s.retry} onPress={start} /></View>
          </View>
        </Card>
      )}

      <NewVisitCard style={{ marginTop: space[4] }} />

      <Enter key={`cards-${lang}`} dy={2} ms={MS.morph}>
        {/* Synthetic-data notice: always on the Home card, in the visit language. */}
        <Card style={{ marginTop: space[4], flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color.tealTint, alignItems: "center", justifyContent: "center" }}>
            <Info color={color.teal} size={18} />
          </View>
          <View style={{ flex: 1 }}>
            <T lang={lang} token="body" weight="bold" style={{ marginBottom: space[1] }}>{s.synthetic}</T>
            <T lang={lang} token="small" tone="inkSoft">{s.privacy}</T>
          </View>
        </Card>

        <T lang={lang} token="title" weight="bold" accessibilityRole="header" style={{ marginTop: space[8], marginBottom: space[3] }}>{s.howTitle}</T>
        <Card style={{ gap: space[4] }}>
          {s.how.map(([t, d], i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: i === s.how.length - 1 ? color.oceanTint : color.tealTint, alignItems: "center", justifyContent: "center" }}>
                <T lang="en" token="small" weight="bold" tone={i === s.how.length - 1 ? "ocean" : "teal"}>{i + 1}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T lang={lang} token="body" weight="bold">{t}</T>
                <T lang={lang} token="small" tone="inkSoft">{d}</T>
              </View>
            </View>
          ))}
        </Card>
      </Enter>

      <View style={{ flexGrow: 1, minHeight: space[6] }} />
      <T lang={lang} token="small" tone="graphite">{s.disclaimer}</T>
    </Page>
  );
}
