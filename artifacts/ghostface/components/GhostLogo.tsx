import React, { useEffect, useRef } from "react";
import { Animated, Image } from "react-native";

interface GhostLogoProps {
  size?: number;
  color?: string;
}

export function GhostLogo({ size = 64, color }: GhostLogoProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.delay(1200),
        Animated.timing(opacity, {
          toValue: 0.08,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.delay(300),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.Image
      source={require("../assets/images/ghostlogo.png")}
      style={{ width: size, height: size, tintColor: color, opacity }}
      resizeMode="contain"
    />
  );
}
