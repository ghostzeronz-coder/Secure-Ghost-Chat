import { useFocusEffect } from "expo-router";
import React, { useCallback } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface TabScreenWrapperProps {
  children: React.ReactNode;
}

export function TabScreenWrapper({ children }: TabScreenWrapperProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useFocusEffect(
    useCallback(() => {
      opacity.value = 0;
      translateY.value = 16;
      const config = { duration: 220, easing: Easing.out(Easing.quad) };
      opacity.value = withTiming(1, config);
      translateY.value = withTiming(0, config);
    }, [])
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
