import { useRef, useCallback } from "react";
import { ScrollView, FlatList } from "react-native";
import { useFocusEffect } from "expo-router";

/**
 * Preserves scroll position when the user switches tabs and returns.
 *
 * Usage — ScrollView:
 *   const { scrollRef, onScroll } = useScrollPersist<ScrollView>();
 *   <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} ... />
 *
 * Usage — FlatList:
 *   const { scrollRef, onScroll } = useScrollPersist<FlatList>('flatlist');
 *   <FlatList ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} ... />
 */
export function useScrollPersist<T extends ScrollView | FlatList>(
  type: "scrollview" | "flatlist" = "scrollview"
) {
  const scrollRef = useRef<T>(null);
  const offsetRef = useRef(0);

  const onScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      offsetRef.current = e.nativeEvent.contentOffset.y;
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      const saved = offsetRef.current;
      if (saved <= 0) return;

      // Defer slightly so the TabScreenWrapper slide-up animation doesn't
      // fight with the programmatic scroll — 50 ms is imperceptible.
      const id = setTimeout(() => {
        if (type === "flatlist") {
          (scrollRef.current as FlatList | null)?.scrollToOffset({
            offset: saved,
            animated: false,
          });
        } else {
          (scrollRef.current as ScrollView | null)?.scrollTo({
            y: saved,
            animated: false,
          });
        }
      }, 50);

      return () => clearTimeout(id);
    }, [type])
  );

  return { scrollRef, onScroll };
}
