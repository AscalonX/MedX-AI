import type React from "react";
import { color, mobileFont, space, type as scale } from "@medx/shared";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Animated, { Easing, FadeIn, useReducedMotion } from "react-native-reanimated";
import { addTurn } from "@/api";
import { Button, Page, Rule, T } from "@/components/ui";
import { friendly, LANG_NAME, STR } from "@/i18n";
import { screenFor, useStore } from "@/store";

const PITCH = 34; // ruled-line pitch (>= Thai line height at 19px)

export default function Intake() {
  const { lang, session, set } = useStore();
  const s = STR[lang];
  const reduced = useReducedMotion();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [h, setH] = useState(PITCH * 4);

  useEffect(() => { if (!session) router.replace("/"); }, [session]);
  const answered = session?.turns.filter((t) => t.role === "patient").length ?? 0;
  useEffect(() => { if (!busy && !failed) input.current?.focus(); }, [busy, failed, answered]);
  if (!session) return null;
  // Ledger = redacted patient turns returned by the API, never the raw text typed.
  const ledger = session.turns.filter((t) => t.role === "patient").map((t) => friendly(t.text, lang));

  const question = answered === 0 ? s.q1 : session.summary?.nextQuestion?.text[lang] ?? "";
  const lines = Math.max(4, Math.ceil(h / PITCH));

  async function submit() {
    const t = text.trim();
    if (!t || busy || !session) return;
    setFailed(false); setBusy(true);
    try {
      const next = await addTurn(session.id, t);
      set({ session: next });
      setText(""); setH(PITCH * 4);
      router.replace(screenFor(next));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const fade = FadeIn.duration(reduced ? 0 : 260).easing(Easing.bezier(0.2, 0.8, 0.2, 1));

  return (
    <Page>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <T lang="en" token="small" tone="inkSoft" accessibilityLabel={`Code ${session.code}`}>{session.code}</T>
        <T lang={lang} token="small" tone="inkSoft">{LANG_NAME[lang]}</T>
      </View>
      <View style={{ height: space[6] }} />

      {(ledger.length > 0 || busy) && (
        <View accessibilityLabel={s.told} style={{ marginBottom: space[8] }}>
          <T lang={lang} token="small" tone="inkSoft" style={{ marginBottom: space[2] }}>{s.told}</T>
          <Rule />
          {ledger.map((a, i) => (
            <View key={i}>
              <T lang={lang} token="body" style={{ paddingVertical: space[2] }}>{a}</T>
              <Rule />
            </View>
          ))}
          {busy && (
            <View>
              <T lang={lang} token="body" tone="graphite" style={{ paddingVertical: space[2] }}>{s.sending}…</T>
              <Rule />
            </View>
          )}
        </View>
      )}

      {answered > 0 && !busy && (
        <T lang={lang} token="small" tone="inkSoft" style={{ marginBottom: space[2] }}>{s.counter(Math.min(answered, 3))}</T>
      )}

      {busy ? (
        <View accessibilityLabel={s.sending} accessibilityLiveRegion="polite" style={{ height: scale.question.size * 1.2, justifyContent: "center" }}>
          <View style={{ height: 1, backgroundColor: color.graphite, width: "70%" }} />
        </View>
      ) : (
        <Animated.View key={question} entering={fade}>
          <T lang={lang} token="question" family="serif" weight="medium" accessibilityRole="header">{question}</T>
        </Animated.View>
      )}
      <View style={{ height: space[6] }} />

      {failed ? (
        <View accessibilityRole="alert" style={{ gap: space[3] }}>
          <T lang={lang} token="lead" family="serif" weight="medium" tone="signal">{s.deskTitle(session.code)}</T>
          <T lang={lang} tone="inkSoft">{s.deskBody}</T>
          <Button lang={lang} label={s.retry} onPress={submit} />
        </View>
      ) : !busy ? (
        <>
          <Pressable accessible={false} onPress={() => input.current?.focus()} style={{ minHeight: lines * PITCH }}>
            {Array.from({ length: lines }, (_, i) => (
              <View key={i} pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: (i + 1) * PITCH - 1, height: 1, backgroundColor: color.ruleStrong }} />
            ))}
            <TextInput
              ref={input}
              value={text}
              onChangeText={setText}
              multiline
              autoCorrect={false}
              spellCheck={false}
              autoFocus
              textAlignVertical="top"
              accessibilityLabel={question}
              accessibilityHint={s.placeholderA11y}
              onContentSizeChange={(e) => setH(e.nativeEvent.contentSize.height)}
              cursorColor={color.ink}
              selectionColor={color.inkSoft}
              style={{ fontFamily: mobileFont("sans", lang), fontSize: scale.bodyPatient.size, lineHeight: PITCH, color: color.ink, padding: 0, margin: 0, minHeight: lines * PITCH, paddingBottom: 3, outlineStyle: "none" } as object}
            />
          </Pressable>
          <T lang={lang} token="small" tone="graphite" style={{ marginTop: space[3] }}>{answered === 0 ? s.hint : s.hintFollow}</T>
        </>
      ) : null}

      <View style={{ flexGrow: 1, minHeight: space[8] }} />
      {!failed && <Button lang={lang} label={busy ? s.sending : s.cont} onPress={submit} disabled={busy || !text.trim()} />}
    </Page>
  );
}
