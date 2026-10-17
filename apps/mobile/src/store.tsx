import type { IntakeSession, Lang } from "@medx/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, type Href } from "expo-router";
import { Platform } from "react-native";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getSession } from "@/api";

type S = { lang: Lang; session: IntakeSession | null; speak: boolean };
type Ctx = S & { ready: boolean; restored: IntakeSession | null; offline: boolean; set: (p: Partial<S>) => void; reset: () => void };
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
  const [offline, setOffline] = useState(false);
  const [restored, setRestored] = useState<IntakeSession | null>(null);
  const booted = useRef(false);

  // Restore on start: an escalated session always returns to the red-flag screen, in the right language.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    (async () => {
      try {
        const fresh = Platform.OS === "web" && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("new") === "1";
        const raw = fresh ? null : await AsyncStorage.getItem(KEY);
        if (fresh) {
          const keep = await AsyncStorage.getItem(KEY).then((r) => (r ? (JSON.parse(r) as { lang: Lang }).lang : null)).catch(() => null);
          await AsyncStorage.setItem(KEY, JSON.stringify({ session: null, lang: keep ?? "en" }));
          if (keep) setS((o) => ({ ...o, lang: keep }));
        }
        if (raw) {
          const saved = JSON.parse(raw) as { session: IntakeSession | null; lang: Lang };
          if (saved.lang) setS((o) => ({ ...o, lang: saved.lang }));
          if (saved.session) {
            // Validate against the server: the stored copy is never trusted. 404 or no answer after a retry: forget it, go Home.
            let session: IntakeSession | null = null;
            let gone = false;
            for (let i = 0; i < 2 && !session; i++) {
              try { session = (await getSession(saved.session.id)).session; }
              catch (e) {
                if ((e as { status?: number }).status === 404) { gone = true; break; }
                if (i === 0) await new Promise((r) => setTimeout(r, 1500));
              }
            }
            if (session) { setS((o) => ({ ...o, session })); setRestored(session); } // routed by the SERVER status
            else if (gone) router.replace("/"); // only a definitive 404 clears it
            else { setOffline(true); setS((o) => ({ ...o, session: saved.session })); setRestored(saved.session); } // offline: keep the stored screen
          }
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
    ...s, ready, restored, offline,
    set: (p) => setS((o) => ({ ...o, ...p })),
    reset: () => setS((o) => ({ ...o, session: null })),
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
