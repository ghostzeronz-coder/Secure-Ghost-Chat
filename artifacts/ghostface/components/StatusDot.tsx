import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

interface StatusDotProps {
  active: boolean;
  size?: number;
  pulse?: boolean;
}

export function StatusDot({ active, size = 8, pulse = true }: StatusDotProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const color = active ? "#00FF88" : "#FF3B30";

  useEffect(() => {
    if (!active || !pulse) {
      pulseAnim.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.6,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [active, pulse]);

  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: "center", justifyContent: "center" }}>
      {active && pulse && (
        <Animated.View
          style={[
            styles.ring,
            {
              width: size * 2,
              height: size * 2,
              borderRadius: size,
              borderColor: color,
              opacity: 0.3,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
      )}
      <View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            position: "absolute",
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 1.5,
    position: "absolute",
  },
  dot: {},
});
