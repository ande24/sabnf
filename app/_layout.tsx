import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from "react";
import { FontProvider } from "components/FontProvider";

SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const [loaded, error] = useFonts({
      'Orbitron': require('../assets/fonts/orbitron-light.otf'),
      'Orbitron-medium': require('../assets/fonts/orbitron-medium.otf'),
      'Orbitron-bold': require('../assets/fonts/orbitron-bold.otf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }
  
  return (
    <>
      <SafeAreaProvider>
        <FontProvider>
          {<Stack screenOptions={{ headerShown: false }}/>}
        </FontProvider>
      </SafeAreaProvider>
      <StatusBar style="light"  translucent={true} />
    </>
  );
}