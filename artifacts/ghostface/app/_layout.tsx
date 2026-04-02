import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_500Medium,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  ShareTechMono_400Regular,
} from "@expo-google-fonts/share-tech-mono";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot, router, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { AppState, AppStateStatus, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider, useApp } from "@/context/AppContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootNavigator() {
  const { isOnboarded, isLocked, loaded, setLocked } = useApp();
  const appState = useRef(AppState.currentState);
  const pathname = usePathname();

  useEffect(() => {
    if (!loaded) return;

    if (isLocked) {
      if (pathname !== "/lock") {
        router.replace("/lock");
      }
      return;
    }

    if (!isOnboarded) {
      if (pathname !== "/onboarding") {
        router.replace("/onboarding");
      }
      return;
    }

    if (pathname === "/lock" || pathname === "/onboarding") {
      router.replace("/(tabs)");
    }
  }, [loaded, isLocked, isOnboarded, pathname]);

  useEffect(() => {
    if (!loaded || !isOnboarded) return;

    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        const wasActive = appState.current === "active";
        const isBackground =
          nextAppState === "background" || nextAppState === "inactive";
        if (wasActive && isBackground) {
          setLocked(true);
        }
        appState.current = nextAppState;
      }
    );

    return () => subscription.remove();
  }, [loaded, isOnboarded, setLocked]);

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: "#000000" }} />;
  }

  return <Slot />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ShareTechMono_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AppProvider>
                <RootNavigator />
              </AppProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
