import type { IntakeSession, Lang } from "@medx/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Href } from "expo-router";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getSession } from "@/api";

type S = { lang: Lang; session: IntakeSession | null; speak: boolean };
type Ctx = S & { ready: boolean; restored: IntakeSession | null; set: (p: Partial<S>) => void; reset: () => void };
const C = createContext<Ctx>(null as never);
export const useStore = () => useContext(C);

const KEY = "medx.patient.v1"; // { session, lang }: native AsyncStorage, localStorage on web

/** Which screen a session status belongs on. Red flag always wins; collecting without a next question hands over. */
export function screenFor(s: IntakeSession): Href {
  if (s.status === "escalated") return "/redflag";
  if (s.status === "collecting" && (s.summary?.nextQuestion || !s.turns.some((t) => t.role === "patient"))) return "/intake";
  return "/done";
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<S>({ lang: "en", session: null, speak: false });
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState<IntakeSession | null>(null);
  const booted = useRef(false);

  // Restore on start: an escalated session always returns to the red-flag screen, in the right language.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const saved = JSON.parse(raw) as { session: IntakeSession | null; lang: Lang };
          if (saved.session) {
            let session = saved.session;
            if (session.status !== "escalated") {
              try { session = (await getSession(session.id)).session; } catch { /* offline: keep the stored one */ }
            }
            setS((o) => ({ ...o, lang: saved.lang, session }));
            setRestored(session);
          } else if (saved.lang) setS((o) => ({ ...o, lang: saved.lang }));
        }
      } catch { /* storage unavailable: start fresh */ }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(KEY, JSON.stringify({ session: s.session, lang: s.lang })).catch(() => {});
  }, [ready, s.session, s.lang]);

  const value: Ctx = {
    ...s, ready, restored,
    set: (p) => setS((o) => ({ ...o, ...p })),
    reset: () => setS((o) => ({ ...o, session: null })),
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
