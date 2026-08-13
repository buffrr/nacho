import React, { useState, useEffect, useRef, useCallback } from "react";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/theme";
import { NativeEmpty } from "@/ui/nativeEmpty";
import { ShopResults } from "@/ui/shopResults";

export default function Shop() {
  const router = useRouter();
  const { colors } = useTheme();
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const [query, setQuery] = useState(prefill ?? "");

  const searchRef = useRef<{
    focus: () => void;
    blur: () => void;
    clearText: () => void;
    toggleCancelButton: (show: boolean) => void;
    setText: (text: string) => void;
    cancelSearch: () => void;
  } | null>(null);

  const buy = (handle: string) =>
    router.push({ pathname: "/(main)/show-handle", params: { handle } });

  // Focus the native search field once the screen is settled. `autoFocus` on the
  // search bar is unreliable across a push transition (the keyboard is dismissed
  // as the screen slides in), so we focus explicitly after the animation. Skip
  // when arriving with a prefill (nothing to type).
  useFocusEffect(
    useCallback(() => {
      if (prefill) return;
      const id = setTimeout(() => searchRef.current?.focus(), 450);
      return () => clearTimeout(id);
    }, [prefill]),
  );

  const searchScreen = (
    <Stack.Screen
      options={{
        headerLargeTitle: true,
        headerSearchBarOptions: {
          ref: searchRef,
          autoFocus: true,
          placeholder: "Search a name",
          autoCapitalize: "none",
          hideWhenScrolling: false,
          textColor: colors.text,
          tintColor: colors.accent,
          onChangeText: (e) =>
            setQuery(e.nativeEvent.text.toLowerCase().replace(/[^a-z0-9@.\-]/g, "")),
        },
      }}
    />
  );

  return (
    <>
      {searchScreen}
      {query ? (
        <ShopResults query={query} onBuy={buy} />
      ) : (
        <NativeEmpty
          sf="bag"
          title="Find a handle"
          message="Search a name to see what’s available."
        />
      )}
    </>
  );
}
