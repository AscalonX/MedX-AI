import type { Lang } from "@medx/shared";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { File, Paths } from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { fetchSpeech } from "@/api";

export type SpeechReq = { kind: "first_question" | "next_question" | "red_flag"; lang: Lang; sessionId?: string };
export type ListenState = "idle" | "loading" | "playing";

/**
 * Server read-aloud (AMD OmniVoice). `listen` resolves true if audio played (or the patient stopped it), false if the
 * server voice is not available (the caller then uses the device voice). Never autoplays: call it from a button press.
 */
export function useListen() {
  const [state, setState] = useState<ListenState>("idle");
  const cur = useRef<{ id: number; ctl: AbortController; stop: () => void } | null>(null);
  const seq = useRef(0);

  const stop = useCallback(() => {
    const c = cur.current; cur.current = null;
    if (c) { c.ctl.abort(); c.stop(); }
    setState("idle");
  }, []);
  useEffect(() => stop, [stop]);

  const listen = useCallback(async (req: SpeechReq): Promise<boolean> => {
    stop();
    const id = ++seq.current;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 25000);
    cur.current = { id, ctl, stop: () => {} };
    setState("loading");
    const live = () => cur.current?.id === id;
    try {
      const bytes = await fetchSpeech(req, ctl.signal);
      if (!live()) return true; // stopped or replaced by the patient: not a failure
      const done = () => { if (live()) { cur.current = null; setState("idle"); } };
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
        const a = new Audio(url);
        cur.current = { id, ctl, stop: () => { a.pause(); URL.revokeObjectURL(url); } };
        a.onended = () => { URL.revokeObjectURL(url); done(); };
        a.onerror = () => { URL.revokeObjectURL(url); done(); };
        await a.play();
      } else {
        const f = new File(Paths.cache, `medx-tts-${id}.mp3`);
        f.create({ overwrite: true });
        f.write(new Uint8Array(bytes));
        const p: AudioPlayer = createAudioPlayer({ uri: f.uri });
        const sub = p.addListener("playbackStatusUpdate", (st) => { if (st.didJustFinish) { sub.remove(); p.remove(); done(); } });
        cur.current = { id, ctl, stop: () => { sub.remove(); p.pause(); p.remove(); try { f.delete(); } catch { /* already gone */ } } };
        p.play();
      }
      if (live()) setState("playing");
      return true;
    } catch {
      const wasLive = live();
      if (wasLive) { cur.current = null; setState("idle"); }
      return !wasLive;
    } finally {
      clearTimeout(timer);
    }
  }, [stop]);

  return { state, listen, stop };
}
