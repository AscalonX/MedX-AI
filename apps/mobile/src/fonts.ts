import type { FontWeightName, Lang } from "@medx/shared";
import { Platform } from "react-native";

/**
 * Patient app type, the same families as the web (owner decision, 17 Oct 2026 late evening; DIRECTION.md section 3):
 * Plus Jakarta Sans for English and Italian, Noto Sans Thai for Thai. Both SIL Open Font License 1.1 (assets/fonts/OFL-*.txt).
 *
 * Files in assets/fonts (bundled, so they never come from node_modules and always ship with the /patient export):
 * - NotoSansThai-{400,600,700}.ttf: unchanged from @expo-google-fonts/noto-sans-thai 0.4.2. They also carry Latin, so a code
 *   or "MedX" inside Thai text keeps one face.
 * - PlusJakartaSans-Latin-{400,600,700,800}.ttf: from @expo-google-fonts/plus-jakarta-sans 0.4.2, subset with fontTools
 *   (`fontTools.subset --layout-features='*' --name-IDs='*'`) to the Google Fonts "latin" range (U+0000-00FF, U+0131,
 *   U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193,
 *   U+2212, U+2215, U+FEFF, U+FFFD). All Italian accents and the tnum feature are kept; 4 cuts weigh 157 KB instead of 379 KB.
 *
 * Weights follow DIRECTION section 3: 400 body and inputs, 600 buttons, chips, nav and eyebrows, 700 headings and values,
 * 800 the big Home headline. There is no light cut on the patient phone (300 hurts legibility at arm's length).
 */
export const FONT_FILES = {
  PlusJakartaSans_400Regular: require("../assets/fonts/PlusJakartaSans-Latin-400.ttf"),
  PlusJakartaSans_600SemiBold: require("../assets/fonts/PlusJakartaSans-Latin-600.ttf"),
  PlusJakartaSans_700Bold: require("../assets/fonts/PlusJakartaSans-Latin-700.ttf"),
  PlusJakartaSans_800ExtraBold: require("../assets/fonts/PlusJakartaSans-Latin-800.ttf"),
  NotoSansThai_400Regular: require("../assets/fonts/NotoSansThai-400.ttf"),
  NotoSansThai_600SemiBold: require("../assets/fonts/NotoSansThai-600.ttf"),
  NotoSansThai_700Bold: require("../assets/fonts/NotoSansThai-700.ttf"),
} as const;

export type Weight = FontWeightName | "extrabold";

const LATIN: Record<Weight, keyof typeof FONT_FILES> = {
  light: "PlusJakartaSans_400Regular",
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_600SemiBold",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
};
// Thai stays at 700 for the headline: heavier Thai closes up its loops at patient sizes.
const THAI: Record<Weight, keyof typeof FONT_FILES> = {
  light: "NotoSansThai_400Regular",
  regular: "NotoSansThai_400Regular",
  medium: "NotoSansThai_600SemiBold",
  semibold: "NotoSansThai_600SemiBold",
  bold: "NotoSansThai_700Bold",
  extrabold: "NotoSansThai_700Bold",
};

/**
 * The font family for text in `lang`. Native: one registered face (the OS falls back per glyph). Web: a real stack, so a Thai
 * word inside English text, or the reverse, still gets the matching face.
 */
export function fontFor(lang: Lang, weight: Weight = "regular"): string {
  const latin = LATIN[weight];
  const thai = THAI[weight];
  if (Platform.OS !== "web") return lang === "th" ? thai : latin;
  return lang === "th" ? `"${thai}", "${latin}", system-ui, sans-serif` : `"${latin}", "${thai}", system-ui, sans-serif`;
}
