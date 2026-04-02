import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_500Medium,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider, useApp } from "@/context/AppContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootNavigator() {
  const { isOnboarded, isLocked, loaded, hasPin, biometricEnabled, setLocked } = useApp();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!loaded) return;
    if (!isOnboarded) {
      router.replace("/onboarding");
    } else if (isLocked) {
      router.replace("/lock");
    } else {
      router.replace("/(tabs)");
    }
  }, [loaded, isOnboarded, isLocked]);

  useEffect(() => {
    if (!loaded || !isOnboarded) return;

    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        const wasActive = appState.current === "active";
        const isBackground =
          nextAppState === "background" || nextAppState === "inactive";
        if (wasActive && isBackground && (hasPin || biometricEnabled)) {
          setLocked(true);
        }
        appState.current = nextAppState;
      }
    );

    return () => subscription.remove();
  }, [loaded, isOnboarded, hasPin, biometricEnabled, setLocked]);

  return <Slot />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
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
