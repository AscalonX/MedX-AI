import type { Lang } from "@medx/shared";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useCallback, useEffect, useRef, useState } from "react";

export const LOCALE: Record<Lang, string> = { th: "th-TH", it: "it-IT", en: "en-US" };
// Test-only: with EXPO_PUBLIC_VOICE_FAKE=1 the mic "hears" a scripted sentence (no microphone needed).
const FAKE = process.env.EXPO_PUBLIC_VOICE_FAKE === "1";
const FAKE_TEXT: Record<Lang, string> = { th: "ปวดหัวมา 2 วัน", it: "Ho mal di testa da ieri sera", en: "I have had a headache since yesterday" };

export type Phase = "idle" | "listening" | "confirm";
export type VoiceIssue = "denied" | "unavailable" | "nospeech" | null;

/** Speech to text. The result is never sent: it lands in `transcript` and the patient confirms it first. */
export function useVoice(lang: Lang, onDone: (text: string) => void) {
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [level, setLevel] = useState(0); // 0..1
  const [issue, setIssue] = useState<VoiceIssue>(null);
  const heard = useRef("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useSpeechRecognitionEvent("result", (e) => {
    const t = e.results?.[0]?.transcript ?? "";
    heard.current = t;
    setTranscript(t);
  });
  useSpeechRecognitionEvent("volumechange", (e) => setLevel(Math.max(0, Math.min(1, (e.value + 2) / 12))));
  useSpeechRecognitionEvent("end", () => {
    setLevel(0);
    if (heard.current.trim()) { setPhase("confirm"); done.current(heard.current); }
    else { setPhase("idle"); setIssue((i) => i ?? "nospeech"); }
  });
  useSpeechRecognitionEvent("error", (e) => {
    setLevel(0);
    if (e.error === "not-allowed" || e.error === "service-not-allowed") { setIssue("denied"); setPhase("idle"); }
    else if (e.error === "no-speech" || e.error === "aborted") { /* "end" follows and decides */ }
    else { setIssue("unavailable"); setPhase("idle"); }
  });

  const reset = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; heard.current = ""; setTranscript(""); setPhase("idle"); setIssue(null); setLevel(0); }, []);

  const start = useCallback(async () => {
    setIssue(null); heard.current = ""; setTranscript("");
    if (FAKE) {
      setPhase("listening");
      const words = FAKE_TEXT[lang].split(" ");
      words.forEach((_, i) => timers.current.push(setTimeout(() => { heard.current = words.slice(0, i + 1).join(" "); setTranscript(heard.current); setLevel(0.3 + 0.6 * Math.random()); }, 600 + i * 450)));
      timers.current.push(setTimeout(() => { setLevel(0); setPhase("confirm"); done.current(heard.current); }, 1200 + words.length * 450));
      return;
    }
    try {
      const p = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!p.granted) { setIssue("denied"); return; }
      setPhase("listening");
      ExpoSpeechRecognitionModule.start({ lang: LOCALE[lang], interimResults: true, continuous: false, volumeChangeEventOptions: { enabled: true, intervalMillis: 120 } });
    } catch {
      setIssue("unavailable"); setPhase("idle");
    }
  }, [lang]);

  const stop = useCallback(() => {
    if (FAKE) { timers.current.forEach(clearTimeout); timers.current = []; setLevel(0); if (heard.current.trim()) { setPhase("confirm"); done.current(heard.current); } else setPhase("idle"); return; }
    try { ExpoSpeechRecognitionModule.stop(); } catch { setPhase("idle"); return; }
    // iOS may not emit "end" when nothing was heard: never leave the patient stuck on "Listening".
    timers.current.push(setTimeout(() => {
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* already stopped */ }
      setLevel(0);
      setPhase((p) => (p === "listening" ? (heard.current.trim() ? "confirm" : "idle") : p));
      if (!heard.current.trim()) setIssue((i) => i ?? "nospeech");
      else done.current(heard.current);
    }, 2000));
  }, []);

  return { phase, transcript, setTranscript, level, issue, start, stop, reset };
}
