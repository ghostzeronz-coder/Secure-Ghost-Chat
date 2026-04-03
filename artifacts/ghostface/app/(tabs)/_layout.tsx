import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();
  const safeAreaInsets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          paddingBottom: safeAreaInsets.bottom,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
        tabBarLabelStyle: {
          fontSize: 10,
          letterSpacing: 1,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "HOME",
          tabBarIcon: ({ color }) => (
            <Feather name="home" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "MESSAGES",
          tabBarIcon: ({ color }) => (
            <Ionicons name="chatbubble-outline" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "WALLET",
          tabBarIcon: ({ color }) => (
            <Ionicons name="wallet-outline" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="vpn"
        options={{
          title: "VPN",
          tabBarIcon: ({ color }) => (
            <Ionicons name="shield-outline" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: "TOOLS",
          tabBarIcon: ({ color }) => (
            <Ionicons name="lock-closed-outline" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "SETTINGS",
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings-outline" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
