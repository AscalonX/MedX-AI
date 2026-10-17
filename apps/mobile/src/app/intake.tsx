import { color, radius, scbxFont, space, type as scale } from "@medx/shared";
import type React from "react";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import Animated, { Easing, FadeIn, useReducedMotion } from "react-native-reanimated";
import { addTurn } from "@/api";
import { Badge, Card, Chip, Page, Pill, sh, T } from "@/components/ui";
import { friendly, STR } from "@/i18n";
import { screenFor, useStore } from "@/store";

const MAX = 3;

export default function Intake() {
  const { lang, session, set } = useStore();
  const s = STR[lang];
  const reduced = useReducedMotion();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [focus, setFocus] = useState(false);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const answered = session?.turns.filter((t) => t.role === "patient").length ?? 0;
  useEffect(() => { if (!busy && !failed) input.current?.focus(); }, [busy, failed, answered]);
  useEffect(() => { if (!session) router.replace("/"); }, [session]);
  if (!session) return null;

  // Ledger = redacted patient turns returned by the API, never the raw text typed.
  const ledger = session.turns.filter((t) => t.role === "patient").map((t) => friendly(t.text, lang));
  const next = session.summary?.nextQuestion;
  const question = answered === 0 ? s.q1 : next?.text[lang] ?? "";
  const chips: string[] =
    next?.field === "severity" ? Array.from({ length: 11 }, (_, n) => String(n))
    : next?.field === "onset" || next?.field === "duration" ? [s.chipToday, s.chipYesterday, s.chipWeek]
    : next?.field === "allergies" || next?.field === "medications" || next?.field === "medical_history" ? [s.chipNone]
    : [];

  async function submit() {
    const t = text.trim();
    if (!t || busy || !session) return;
    setFailed(false); setBusy(true);
    try {
      const nx = await addTurn(session.id, t);
      set({ session: nx });
      setText("");
      router.replace(screenFor(nx));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
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
      <View style={{ height: space[5] }} />

      {busy ? (
        <Card style={{ minHeight: 96, justifyContent: "center" }} >
          <View accessibilityLabel={s.sending} accessibilityLiveRegion="polite" style={{ height: 6, borderRadius: 3, width: "60%", backgroundColor: color.muted }} />
        </Card>
      ) : (
        <Animated.View key={question} entering={fade}>
          <Card>
            <T lang={lang} token="question" weight="bold" accessibilityRole="header">{question}</T>
          </Card>
        </Animated.View>
      )}
      <View style={{ height: space[4] }} />

      {failed ? (
        <Card tone="warn" style={{ gap: space[3] }}>
          <View accessibilityRole="alert" style={{ gap: space[3] }}>
            <T lang={lang} token="lead" weight="bold" tone="warn">{s.deskTitle(session.code)}</T>
            <T lang={lang} tone="inkSoft">{s.deskBody}</T>
            <View style={{ alignSelf: "flex-start" }}><Pill lang={lang} variant="quiet" label={s.retry} onPress={submit} /></View>
          </View>
        </Card>
      ) : !busy ? (
        <>
          <Card>
            <TextInput
              ref={input}
              value={text}
              onChangeText={setText}
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
            <T lang={lang} token="small" tone="graphite" style={{ marginTop: space[3] }}>{answered === 0 ? s.hint : s.hintFollow}</T>
          </Card>
          {chips.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[3] }} accessibilityRole="radiogroup">
              {chips.map((c) => (
                <Chip key={c} lang={lang} label={c} selected={text === c} onPress={() => { setText(c); }} />
              ))}
            </View>
          )}
          <View style={{ height: space[5] }} />
          <Pill lang={lang} label={s.cont} onPress={submit} disabled={!text.trim()} />
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
