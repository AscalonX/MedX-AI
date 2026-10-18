import type { Lang } from "@medx/shared";
import { NAV_COPY } from "./demoCopy";
import { LANDING_PATHS } from "./site";

/** In-page anchor on this language's landing; from another page it points at the landing ("/th#features"). */
export const landingAnchor = (lang: Lang, id: string, local: boolean) => (local ? `#${id}` : `${LANDING_PATHS[lang]}#${id}`);

/** Nav links (DIRECTION.md 12.10): How it works, Features, Safety, Try a role. Client-safe (no server imports). */
export function landingNavLinks(lang: Lang, local = true) {
  const n = NAV_COPY[lang];
  return [
    { href: landingAnchor(lang, "how-it-works", local), label: n.how },
    { href: landingAnchor(lang, "features", local), label: n.features },
    { href: landingAnchor(lang, "safety", local), label: n.safety },
    { href: landingAnchor(lang, "demo-accounts", local), label: n.roles },
  ];
}
