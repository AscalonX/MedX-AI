import { color, gradient, layout, radius, shadow, space } from "@medx/shared";
import { router, usePathname, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import type { Lang } from "@medx/shared";
import { Pressable, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sh, T } from "@/components/ui";
import { STR } from "@/i18n";
import { screenFor, useStore } from "@/store";

/** Bottom bar: Home / My visit / (raised New intake) / Help. Hidden on the red-flag screen: the patient has no way out of it. */
export function TabBar() {
  const { lang, session, reset } = useStore();
  const path = usePathname();
  const i = useSafeAreaInsets();
  const s = STR[lang];
  if (path === "/redflag") return null;
  const escalated = session?.status === "escalated"; // staff-only exit lives on the red-flag screen
  const active = session?.status === "collecting";

  const go = (kind: "home" | "visit" | "help" | "new") => {
    if (kind === "home") router.replace("/");
    else if (kind === "help") router.replace("/help" as Href);
    else if (kind === "visit") router.replace(session ? screenFor(session) : "/");
    else if (!escalated) {
      if (active) router.replace("/intake");
      else { reset(); router.replace("/"); }
    }
  };
  const visitOn = path === "/intake" || path === "/done";
  return (
    <View style={[{ position: "absolute", left: 0, right: 0, bottom: 0, height: layout.patient.tabBar + i.bottom, paddingBottom: i.bottom, backgroundColor: color.sheet, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, flexDirection: "row", alignItems: "center", paddingHorizontal: space[4] }, { boxShadow: sh(shadow.sheetLifted) } as ViewStyle]}>
      <TabItem lang={lang} label={s.tabHome} on={path === "/"} onPress={() => go("home")} />
      <TabItem lang={lang} label={s.tabVisit} on={visitOn} onPress={() => go("visit")} />
      <View style={{ width: layout.patient.centreAction + space[4], alignItems: "center" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={s.tabNew} accessibilityState={{ disabled: escalated }} disabled={escalated} onPress={() => go("new")}
          style={{ marginTop: -(layout.patient.centreAction / 2 + space[4]), opacity: escalated ? 0.35 : 1 }}>
          <LinearGradient colors={[gradient.primary.from, gradient.primary.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ width: layout.patient.centreAction, height: layout.patient.centreAction, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: color.sheet }, { boxShadow: sh(shadow.hero) } as ViewStyle]}>
            <View style={{ width: 22, height: 3, borderRadius: 2, backgroundColor: color.onPrimary }} />
            <View style={{ position: "absolute", width: 3, height: 22, borderRadius: 2, backgroundColor: color.onPrimary }} />
          </LinearGradient>
        </Pressable>
      </View>
      <TabItem lang={lang} label={s.tabHelp} on={path === "/help"} onPress={() => go("help")} />
      <View style={{ flex: 1 }} />
    </View>
  );
}

function TabItem({ lang, label, on, onPress }: { lang: Lang; label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress} style={{ flex: 1, minHeight: layout.hitTarget, alignItems: "center", justifyContent: "center", gap: 6 }}>
      <View style={{ width: 28, height: 4, borderRadius: 2, backgroundColor: on ? color.teal : "transparent" }} />
      <T lang={lang} token="micro" weight={on ? "bold" : "regular"} tone={on ? "teal" : "graphite"}>{label}</T>
    </Pressable>
  );
}
