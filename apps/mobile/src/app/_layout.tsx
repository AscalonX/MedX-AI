import { color } from "@medx/shared";
import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { NewVisitSheet } from "@/components/newvisit";
import { TabBar } from "@/components/tabbar";
import { FONT_FILES } from "@/fonts";
import { screenFor, StoreProvider, useStore } from "@/store";

SplashScreen.preventAutoHideAsync();

/** After storage is read, send the patient back to where their session belongs (red flag always wins). */
function Restore() {
  const { restored } = useStore();
  useEffect(() => { if (restored) router.replace(screenFor(restored)); }, [restored]);
  return null;
}

export default function Root() {
  // Plus Jakarta Sans + Noto Sans Thai (fonts.ts), loaded before the first frame so no text ever re-flows into the brand face.
  const [loaded, error] = useFonts(FONT_FILES);
  // Web: expo-font appends one @font-face per font to a single <style>, and Chrome can leave a face it already fetched
  // "unloaded" after the re-parse (seen: Noto Sans Thai 600). Loading each family by name again resolves from cache in ~0 ms.
  const [faces, setFaces] = useState(Platform.OS !== "web");
  useEffect(() => {
    if (!loaded || faces) return;
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    const all = fonts?.load ? Promise.all(Object.keys(FONT_FILES).map((f) => fonts.load(`1em "${f}"`))) : Promise.resolve();
    const cap = new Promise((r) => setTimeout(r, 2500)); // never hold the patient back for a font
    Promise.race([all, cap]).catch(() => {}).finally(() => setFaces(true));
  }, [loaded, faces]);
  const ready = (loaded && faces) || !!error; // a font failure must never block the patient: the stacks fall back to the system face
  useEffect(() => { if (ready) SplashScreen.hideAsync(); }, [ready]);
  if (!ready) return null;
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: color.paper }}>
        <Stack screenOptions={{ headerShown: false, animation: "none", contentStyle: { backgroundColor: color.paper }, gestureEnabled: false }} />
        <Restore />
        <TabBar />
        <NewVisitSheet />
      </View>
    </StoreProvider>
  );
}
