import { color, radius, scbxFont, space, type as scale } from "@medx/shared";
import type React from "react";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import * as Speech from "expo-speech";
import { Pressable, TextInput, View } from "react-native";
import Animated, { Easing, FadeIn, useReducedMotion } from "react-native-reanimated";
import { addTurn, getSession, isTimeout, uuid } from "@/api";
import { Speaker } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { LevelBars, MicButton } from "@/components/mic";
import { LOCALE, useVoice } from "@/voice";
import { Badge, Card, Chip, Page, Pill, sh, T } from "@/components/ui";
import { friendly, STR } from "@/i18n";
import { screenFor, useStore } from "@/store";

const MAX = 3;

export default function Intake() {
  const { lang, session, speak, set, update, offline } = useStore();
  const s = STR[lang];
  const reduced = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [focus, setFocus] = useState(false);
  const [fromVoice, setFromVoice] = useState(false);
  const [text, setText] = useState("");
  const v = useVoice(lang, (t) => { setText(t); setFromVoice(true); });
  const [speakTouched, setSpeakTouched] = useState(false);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const gen = useRef(0); // request generation: only the newest request may apply its response
  const mounted = useRef(true);
  const turn = useRef<{ text: string; id: string } | null>(null); // same text => same clientTurnId on Retry
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const answered = session?.turns.filter((t) => t.role === "patient").length ?? 0;
  useEffect(() => { if (!busy && !failed) input.current?.focus(); }, [busy, failed, answered]);
  useEffect(() => { if (!session) router.replace("/"); }, [session]);
  const qText = session ? (answered === 0 ? s.q1 : session.summary?.nextQuestion?.text[lang] ?? "") : "";
  useEffect(() => {
    if (!speak || !qText || busy) return;
    Speech.stop();
    Speech.speak(qText, { language: LOCALE[lang], rate: 0.95 });
    return () => { Speech.stop(); };
  }, [speak, qText, busy, lang]);
  if (!session) return null;

  // Ledger = redacted patient turns returned by the API, never the raw text typed.
  const ledger = session.turns.filter((t) => t.role === "patient").map((t) => friendly(t.text, lang));
  const next = session.summary?.nextQuestion;
  const question = answered === 0 ? s.q1 : next?.text[lang] ?? "";
  const chips: string[] =
    next?.field === "severity" ? Array.from({ length: 11 }, (_, n) => String(n))
    : next?.field === "onset" || next?.field === "duration" ? [s.chipToday, s.chipYesterday, s.chipWeek]
    : next?.field === "pregnancy_status" ? [s.chipYes, s.chipNo, s.chipUnknown]
    : next?.field === "allergies" || next?.field === "medications" || next?.field === "medical_history" ? [s.chipNone]
    : [];

  async function submit(override?: string) {
    const mode = override === undefined && fromVoice ? "voice" : "text";
    const t = (override ?? text).trim();
    if (!t || busy || !session) return;
    const sid = session.id;
    const before = session.turns.filter((x) => x.role === "patient").length;
    if (turn.current?.text !== t) turn.current = { text: t, id: uuid() };
    const myGen = ++gen.current;
    const live = () => mounted.current && gen.current === myGen;
    setFailed(false); setBusy(true);
    const apply = (nx: typeof session) => {
      update(nx!); // no-op unless this is still the active session
      turn.current = null; setText(""); setFromVoice(false); v.reset();
      router.replace(screenFor(nx!));
    };
    try {
      const nx = await addTurn(sid, t, mode, turn.current.id);
      if (live()) apply(nx);
    } catch (e) {
      if (!live()) return;
      if (isTimeout(e)) {
        // The server may have finished after we gave up: reconcile before offering Retry.
        try {
          const r = (await getSession(sid)).session;
          if (live() && r.turns.filter((x) => x.role === "patient").length > before) { apply(r); return; }
        } catch { /* fall through to Retry */ }
      }
      if (live()) setFailed(true);
    } finally {
      if (live()) setBusy(false);
    }
  }

  const fade = FadeIn.duration(reduced ? 0 : 240).easing(Easing.bezier(0.22, 1, 0.36, 1));
  const pct = Math.min(answered, MAX) / MAX;

  return (
    <Page>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Badge lang="en" tone="tint" label={session.code} a11y={`Code ${session.code}`} />
        {answered > 0 && <Badge lang={lang} label={s.pill(Math.min(answered, MAX))} />}
      </View>
      <View accessibilityElementsHidden style={{ height: 4, borderRadius: 2, backgroundColor: color.muted, marginTop: space[3], overflow: "hidden" }}>
        <View style={{ width: `${pct * 100}%`, height: 4, backgroundColor: color.ocean }} />
      </View>
      {offline && <T lang={lang} token="small" tone="warn" style={{ marginTop: space[2] }}>{s.offlineNote}</T>}
      <View style={{ height: space[5] }} />

      {busy ? (
        <Card style={{ minHeight: 96, justifyContent: "center", flexDirection: "row", alignItems: "center", gap: space[3] }} >
          <Mascot pose="thinking" size={72} />
          <View accessibilityLabel={s.sending} accessibilityLiveRegion="polite" style={{ height: 6, borderRadius: 3, flex: 1, backgroundColor: color.muted }} />
        </Card>
      ) : (
        <Animated.View key={question} entering={fade}>
          <Card style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}><T lang={lang} token="question" weight="bold" accessibilityRole="header">{question}</T></View>
            <Pressable accessibilityRole="switch" accessibilityLabel={s.speakToggle} accessibilityState={{ checked: speak }} hitSlop={4}
              onPress={() => { setSpeakTouched(true); if (speak) Speech.stop(); set({ speak: !speak }); }}
              style={{ width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: speak ? color.tealTint : color.muted }}>
              <Speaker color={speak ? color.teal : color.graphite} off={!speak} />
            </Pressable>
          </Card>
        </Animated.View>
      )}
      <View style={{ height: space[4] }} />

      {failed ? (
        <Card tone="warn" style={{ gap: space[3] }}>
          <View accessibilityRole="alert" style={{ gap: space[3] }}>
            <T lang={lang} token="lead" weight="bold" tone="warn">{s.deskTitle(session.code)}</T>
            <T lang={lang} tone="inkSoft">{s.deskBody}</T>
            <View style={{ alignSelf: "flex-start" }}><Pill lang={lang} variant="quiet" label={s.retry} onPress={() => submit()} /></View>
          </View>
        </Card>
      ) : !busy ? (
        <>
          <Card>
            <TextInput
              ref={input}
              value={v.phase === "listening" ? v.transcript : text}
              onChangeText={setText}
              editable={v.phase !== "listening"}
              multiline
              autoCorrect={false}
              spellCheck={false}
              textAlignVertical="top"
              accessibilityLabel={question}
              accessibilityHint={s.placeholderA11y}
              onFocus={() => setFocus(true)}
              onBlur={() => setFocus(false)}
              cursorColor={color.ocean}
              selectionColor={color.ocean}
              style={{ fontFamily: scbxFont.light, fontSize: scale.bodyPatient.size, lineHeight: Math.round(scale.bodyPatient.size * (lang === "th" ? 1.7 : 1.5)), color: color.ink, minHeight: 108, padding: space[3], borderRadius: radius.control, borderWidth: focus ? 2 : 1.5, borderColor: focus ? color.ocean : color.ruleStrong, backgroundColor: color.paper, outlineStyle: "none" } as object}
            />
            {v.phase === "confirm" ? (
              <View accessibilityRole="alert" style={{ marginTop: space[3] }}>
                <T lang={lang} token="body" weight="bold">{s.confirmTitle}</T>
                <T lang={lang} token="small" tone="inkSoft">{s.confirmSub}</T>
              </View>
            ) : (
              <View style={{ alignItems: "center", marginTop: space[3] }}>
                {v.phase === "listening" && <View style={{ position: "absolute", left: 0, top: 12 }}><Mascot pose="listening" size={72} /></View>}
                <View style={{ minHeight: 28, justifyContent: "center" }}>{v.phase === "listening" && <LevelBars level={v.level} />}</View>
                <MicButton listening={v.phase === "listening"} level={v.level} label={v.phase === "listening" ? s.micStop : s.micStart}
                  onPress={() => {
                    if (v.phase === "listening") { v.stop(); return; }
                    Speech.stop();
                    if (!speakTouched && !speak) set({ speak: true }); // voice mode: questions are read aloud by default
                    setText(""); setFromVoice(false); v.start();
                  }} />
                <T lang={lang} token="small" weight="bold" tone={v.phase === "listening" ? "ocean" : "inkSoft"} accessibilityLiveRegion="polite">{v.phase === "listening" ? `${s.listening}…` : s.micStart}</T>
                {v.issue && <T lang={lang} token="small" tone="warn" accessibilityRole="alert" style={{ marginTop: space[2], textAlign: "center" }}>{v.issue === "denied" ? s.micDenied : v.issue === "nospeech" ? s.noSpeech : s.micUnavailable}</T>}
                <T lang={lang} token="small" tone="graphite" style={{ marginTop: space[2], alignSelf: "flex-start" }}>{answered === 0 ? s.hint : s.hintFollow}</T>
              </View>
            )}
          </Card>
          {chips.length > 0 && v.phase !== "confirm" && v.phase !== "listening" && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[3] }}>
              {chips.map((c) => (
                <Chip key={c} lang={lang} label={c} a11y={next?.field === "severity" ? s.chipSeverityA11y(Number(c)) : c} onPress={() => { setText(c); submit(c); }} />
              ))}
            </View>
          )}
          <View style={{ height: space[5] }} />
          {v.phase === "confirm" ? (
            <View style={{ gap: space[3] }}>
              <Pill lang={lang} label={s.send} onPress={() => submit()} disabled={!text.trim()} />
              <Pill lang={lang} variant="quiet" label={s.tryAgain} onPress={() => { v.reset(); setText(""); setFromVoice(false); }} />
            </View>
          ) : (
            <Pill lang={lang} label={s.cont} onPress={() => submit()} disabled={!text.trim() || v.phase === "listening"} />
          )}
        </>
      ) : null}

      {(ledger.length > 0 || busy) && (
        <View accessibilityLabel={s.told} style={{ marginTop: space[8] }}>
          <T lang={lang} token="small" weight="bold" tone="inkSoft" style={{ marginBottom: space[3] }}>{s.told}</T>
          {ledger.map((a, i) => (
            <Row key={i} last={i === ledger.length - 1 && !busy}>
              <T lang={lang} token="body">{a}</T>
            </Row>
          ))}
          {busy && <Row last><T lang={lang} token="body" tone="graphite">{s.sending}…</T></Row>}
        </View>
      )}
    </Page>
  );
}

/** Timeline entry: dot + connector on the left, rounded card on the right. Not a chat bubble: no alignment, no tail. */
function Row({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: space[3] }}>
      <View style={{ alignItems: "center", width: 14 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color.teal, marginTop: space[4] }} />
        {!last && <View style={{ flex: 1, width: 2, backgroundColor: color.rule }} />}
      </View>
      <View style={[{ flex: 1, backgroundColor: color.sheet, borderRadius: radius.card, padding: space[4], marginBottom: space[3], borderWidth: 1, borderColor: color.rule }, { boxShadow: sh({ x: 0, y: 1, blur: 2, spread: 0, color: "rgba(15, 45, 80, 0.06)" }) } as object]}>{children}</View>
    </View>
  );
}
