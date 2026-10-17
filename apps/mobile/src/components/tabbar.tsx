import { color, gradient, layout, radius, shadow, space, type Lang } from "@medx/shared";
import { LinearGradient } from "expo-linear-gradient";
import { router, usePathname, type Href } from "expo-router";
import type { ComponentType } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Globe, Help, Home, Plus, Visit } from "@/components/icons";
import { sh, T } from "@/components/ui";
import { STR } from "@/i18n";
import { screenFor, useStore } from "@/store";

type Kind = "home" | "visit" | "help" | "lang" | "new";

/** Bottom bar, symmetric: Home, My visit, (raised New intake), Help, Language. Hidden on the red-flag screen: the patient has no way out of it. */
export function TabBar() {
  const { lang, session, reset } = useStore();
  const path = usePathname();
  const i = useSafeAreaInsets();
  const s = STR[lang];
  if (path === "/redflag") return null;
  const escalated = session?.status === "escalated"; // staff-only exit lives on the red-flag screen
  const active = session?.status === "collecting";
  // The session language is fixed on the server, so the Language tab only works before an intake starts.
  const langLocked = !!session;

  const go = (kind: Kind) => {
    if (kind === "home" || (kind === "lang" && !langLocked)) router.replace("/");
    else if (kind === "help") router.replace("/help" as Href);
    else if (kind === "visit") router.replace(session ? screenFor(session) : "/");
    else if (kind === "new" && !escalated) {
      if (active) router.replace("/intake");
      else { reset(); router.replace("/"); }
    }
  };
  const visitOn = path === "/intake" || path === "/done";
  return (
    <View style={[{ position: "absolute", left: 0, right: 0, bottom: 0, height: layout.patient.tabBar + i.bottom, paddingBottom: i.bottom, backgroundColor: color.sheet, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, flexDirection: "row", alignItems: "center", paddingHorizontal: space[2] }, { boxShadow: sh(shadow.sheetLifted) } as ViewStyle]}>
      <TabItem lang={lang} Icon={Home} label={s.tabHome} on={path === "/"} onPress={() => go("home")} />
      <TabItem lang={lang} Icon={Visit} label={s.tabVisit} on={visitOn} onPress={() => go("visit")} />
      <View style={{ width: layout.patient.centreAction + space[4], alignItems: "center" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={s.tabNew} accessibilityState={{ disabled: escalated }} disabled={escalated} onPress={() => go("new")}
          style={{ marginTop: -(layout.patient.centreAction / 2 + space[4]), opacity: escalated ? 0.35 : 1 }}>
          <LinearGradient colors={[gradient.primary.from, gradient.primary.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ width: layout.patient.centreAction, height: layout.patient.centreAction, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: color.sheet }, { boxShadow: sh(shadow.hero) } as ViewStyle]}>
            <Plus color={color.onPrimary} />
          </LinearGradient>
        </Pressable>
      </View>
      <TabItem lang={lang} Icon={Help} label={s.tabHelp} on={path === "/help"} onPress={() => go("help")} />
      <TabItem lang={lang} Icon={Globe} label={s.tabLang} on={false} disabled={langLocked} onPress={() => go("lang")} />
    </View>
  );
}

type IconC = ComponentType<{ size?: number; color: string }>;
function TabItem({ lang, Icon, label, on, onPress, disabled }: { lang: Lang; Icon: IconC; label: string; on: boolean; onPress: () => void; disabled?: boolean }) {
  const tone = on ? "teal" : "graphite";
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on, disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={{ flex: 1, minHeight: layout.hitTarget, alignItems: "center", justifyContent: "center", gap: 2, opacity: disabled ? 0.4 : 1 }}>
      <Icon size={22} color={color[tone]} />
      <T lang={lang} token="micro" weight={on ? "bold" : "regular"} tone={tone} numberOfLines={1}>{label}</T>
    </Pressable>
  );
}
