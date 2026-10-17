import type { IntakeSession, Lang } from "@medx/shared";
import type { Href } from "expo-router";
import { createContext, useContext, useState, type ReactNode } from "react";

type Ctx = {
  lang: Lang; session: IntakeSession | null; speak: boolean;
  set: (p: Partial<Pick<Ctx, "lang" | "session" | "speak">>) => void; reset: () => void;
};
const C = createContext<Ctx>(null as never);
export const useStore = () => useContext(C);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Pick<Ctx, "lang" | "session" | "speak">>({ lang: "en", session: null, speak: false });
  const value: Ctx = {
    ...s,
    set: (p) => setS((o) => ({ ...o, ...p })),
    reset: () => setS((o) => ({ ...o, session: null })),
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

/** Which screen a session status belongs on. Red flag always wins; collecting without a next question hands over. */
export function screenFor(s: IntakeSession): Href {
  if (s.status === "escalated") return "/redflag";
  if (s.status === "collecting" && s.summary?.nextQuestion) return "/intake";
  return "/done";
}
