"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Minimal Web Speech API typings (not in lib.dom for all TS versions).
interface Alt { transcript: string }
interface Res { isFinal: boolean; 0: Alt }
interface Ev { resultIndex: number; results: ArrayLike<Res> }
interface Rec {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void;
  onresult: ((e: Ev) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
}
type Ctor = new () => Rec;

const ctor = (): Ctor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Continuous browser speech recognition. Final phrases go to `onFinal`; `interim` is the live partial text. */
export function useSpeech(lang: string, onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Rec | null>(null);
  const want = useRef(false);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => setSupported(!!ctor()), []);

  const start = useCallback(() => {
    const C = ctor();
    if (!C) return;
    want.current = true;
    setError(null);
    const r = new C();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) { const clean = t.trim(); if (clean) cb.current(clean); } else live += t;
      }
      setInterim(live);
    };
    r.onerror = (e) => { if (e.error !== "no-speech" && e.error !== "aborted") { setError(e.error); want.current = false; } };
    r.onend = () => { setInterim(""); if (want.current) { try { r.start(); } catch { setListening(false); } } else setListening(false); }; // browsers end sessions on silence: keep listening
    rec.current = r;
    try { r.start(); setListening(true); } catch { setListening(false); }
  }, [lang]);

  const stop = useCallback(() => {
    want.current = false;
    rec.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  useEffect(() => () => { want.current = false; rec.current?.stop(); }, []);
  return { supported, listening, interim, error, start, stop };
}
