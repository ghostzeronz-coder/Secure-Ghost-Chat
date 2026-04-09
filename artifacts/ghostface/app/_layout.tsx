import "react-native-get-random-values";
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
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState, AppStateStatus, PanResponder, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider, useApp } from "@/context/AppContext";
import LockScreen from "@/app/lock";
import OnboardingScreen from "@/app/onboarding";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootNavigator() {
  const { isOnboarded, isLocked, loaded, setLocked, autoLockTimeout } = useApp();
  const appState = useRef(AppState.currentState);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    clearInactivityTimer();
    if (typeof autoLockTimeout !== "number" || isLocked) return;
    inactivityTimer.current = setTimeout(() => {
      setLocked(true);
    }, autoLockTimeout);
  }, [autoLockTimeout, isLocked, clearInactivityTimer, setLocked]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => {
          resetInactivityTimer();
          return false;
        },
        onMoveShouldSetPanResponderCapture: () => {
          resetInactivityTimer();
          return false;
        },
      }),
    [resetInactivityTimer]
  );

  useEffect(() => {
    if (!loaded || !isOnboarded) return;
    if (isLocked) {
      clearInactivityTimer();
      return;
    }
    resetInactivityTimer();
    return () => clearInactivityTimer();
  }, [loaded, isOnboarded, isLocked, autoLockTimeout, resetInactivityTimer, clearInactivityTimer]);

  useEffect(() => {
    if (!isLocked && loaded && isOnboarded) {
      resetInactivityTimer();
    }
  }, [pathname]);

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

  if (isLocked) {
    return <LockScreen />;
  }

  if (!isOnboarded) {
    return <OnboardingScreen />;
  }

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <Stack screenOptions={{ headerShown: false, animation: "none" }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="call" />
        <Stack.Screen name="paywall" />
      </Stack>
    </View>
  );
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
