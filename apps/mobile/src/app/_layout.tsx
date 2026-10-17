import { IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold } from "@expo-google-fonts/ibm-plex-sans";
import { IBMPlexSansThaiLooped_400Regular, IBMPlexSansThaiLooped_500Medium, IBMPlexSansThaiLooped_600SemiBold } from "@expo-google-fonts/ibm-plex-sans-thai-looped";
import { Newsreader_400Regular, Newsreader_500Medium, Newsreader_600SemiBold } from "@expo-google-fonts/newsreader";
import { NotoSerifThai_400Regular, NotoSerifThai_500Medium, NotoSerifThai_600SemiBold } from "@expo-google-fonts/noto-serif-thai";
import { color } from "@medx/shared";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StoreProvider } from "@/store";

SplashScreen.preventAutoHideAsync();

export default function Root() {
  const [loaded, error] = useFonts({
    IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold,
    IBMPlexSansThaiLooped_400Regular, IBMPlexSansThaiLooped_500Medium, IBMPlexSansThaiLooped_600SemiBold,
    Newsreader_400Regular, Newsreader_500Medium, Newsreader_600SemiBold,
    NotoSerifThai_400Regular, NotoSerifThai_500Medium, NotoSerifThai_600SemiBold,
  });
  const ready = loaded || !!error; // a font failure must never block the patient
  useEffect(() => { if (ready) SplashScreen.hideAsync(); }, [ready]);
  if (!ready) return null;
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: "none", contentStyle: { backgroundColor: color.paper }, gestureEnabled: false }} />
    </StoreProvider>
  );
}
