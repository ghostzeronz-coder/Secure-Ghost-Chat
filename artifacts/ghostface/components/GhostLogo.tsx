import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import { Animated, PanResponder } from "react-native";

interface GhostLogoProps {
  size?: number;
  color?: string;
}

export function GhostLogo({ size = 64, color }: GhostLogoProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const touching = useRef(false);

  const startLoop = () => {
    loopRef.current = Animated.loop(
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
    loopRef.current.start();
  };

  const stopLoop = () => {
    loopRef.current?.stop();
    loopRef.current = null;
  };

  useEffect(() => {
    startLoop();
    return () => stopLoop();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        touching.current = true;
        stopLoop();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.parallel([
          Animated.spring(opacity, {
            toValue: 1,
            useNativeDriver: true,
            speed: 40,
            bounciness: 0,
          }),
          Animated.spring(scale, {
            toValue: 1.06,
            useNativeDriver: true,
            speed: 30,
            bounciness: 8,
          }),
        ]).start();
      },

      onPanResponderMove: () => {
        if (!touching.current) return;
        opacity.setValue(1);
      },

      onPanResponderRelease: () => {
        touching.current = false;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 20,
          bounciness: 4,
        }).start();
        // Brief hold at full opacity then restart the loop
        Animated.timing(opacity, {
          toValue: 1,
          duration: 0,
          useNativeDriver: true,
        }).start(() => {
          if (!touching.current) startLoop();
        });
      },

      onPanResponderTerminate: () => {
        touching.current = false;
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 0 }).start();
        if (!touching.current) startLoop();
      },
    })
  ).current;

  return (
    <Animated.Image
      source={require("../assets/images/ghostlogo.png")}
      style={{ width: size, height: size, tintColor: color, opacity, transform: [{ scale }] }}
      resizeMode="contain"
      {...panResponder.panHandlers}
    />
  );
}
