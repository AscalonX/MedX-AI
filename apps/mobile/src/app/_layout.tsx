import { color } from "@medx/shared";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { TabBar } from "@/components/tabbar";
import { StoreProvider } from "@/store";

SplashScreen.preventAutoHideAsync();

export default function Root() {
  // Exact names SCBXBeta2-{Light,Regular,Bold}: also what tokens' mobileFont() returns.
  const [loaded, error] = useFonts({
    "SCBXBeta2-Light": require("../../assets/fonts/SCBXBeta2-Light.otf"),
    "SCBXBeta2-Regular": require("../../assets/fonts/SCBXBeta2-Regular.otf"),
    "SCBXBeta2-Bold": require("../../assets/fonts/SCBXBeta2-Bold.otf"),
  });
  const ready = loaded || !!error; // a font failure must never block the patient
  useEffect(() => { if (ready) SplashScreen.hideAsync(); }, [ready]);
  if (!ready) return null;
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: color.paper }}>
        <Stack screenOptions={{ headerShown: false, animation: "none", contentStyle: { backgroundColor: color.paper }, gestureEnabled: false }} />
        <TabBar />
      </View>
    </StoreProvider>
  );
}
