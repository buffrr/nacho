import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Host,
  List,
  ListItem,
  Icon,
  Text,
  Row,
  RNHostView,
} from "@expo/ui";
import { listRowBackground } from "@expo/ui/swift-ui/modifiers";
import { useStore } from "@/Store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { NativeEmpty } from "@/ui/nativeEmpty";
import { searchHandles, formatPrice, SearchMatch } from "@/api";

export default function Shop() {
  const router = useRouter();
  const { handles } = useStore();
  const { scheme, colors } = useTheme();
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const [query, setQuery] = useState(prefill ?? "");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  const searchRef = useRef<{
    focus: () => void;
    blur: () => void;
    clearText: () => void;
    toggleCancelButton: (show: boolean) => void;
    setText: (text: string) => void;
    cancelSearch: () => void;
  } | null>(null);

  useEffect(() => {
    if (!query) {
      setMatches([]);
      setSearching(false);
      setError(false);
      return;
    }
    setSearching(true);
    setError(false);
    let active = true;
    const id = setTimeout(async () => {
      try {
        const results = await searchHandles(query);
        if (!active) return;
        setMatches(results);
        setSearching(false);
      } catch {
        if (!active) return;
        setError(true);
        setMatches([]);
        setSearching(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [query, nonce]);

  const shown = matches
    .filter(
      (m) => m.status !== "invalid" && m.status !== "unknown" && !handles?.[m.handle],
    )
    .sort(
      (a, b) =>
        (a.status === "available" ? 0 : 1) - (b.status === "available" ? 0 : 1),
    );

  const buy = (handle: string) =>
    router.push({ pathname: "/(main)/show-handle", params: { handle } });

  const focusSearch = useCallback(() => {
    setTimeout(() => searchRef.current?.focus(), 60);
  }, []);
  useEffect(() => {
    if (!prefill) focusSearch();
  }, [prefill, focusSearch]);

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

  // ── States ────────────────────────────────────────────────────────────────
  if (!query) {
    return (
      <>
        {searchScreen}
        <NativeEmpty
          sf="bag"
          title="Find a handle"
          message="Search a name to see what’s available to buy."
        />
      </>
    );
  }
  if (error) {
    return (
      <>
        {searchScreen}
        <NativeEmpty
          sf="wifi.slash"
          title="Something went wrong"
          message="Couldn’t reach the handle shop. Check your connection and try again."
          primary={{ label: "Try again", onPress: () => setNonce((n) => n + 1) }}
        />
      </>
    );
  }
  if (searching) {
    return (
      <>
        {searchScreen}
        <NativeEmpty sf="magnifyingglass" title="Searching…" />
      </>
    );
  }
  if (shown.length === 0) {
    return (
      <>
        {searchScreen}
        <NativeEmpty
          sf="magnifyingglass"
          title="No handles found"
          message={`Nothing available for “${query}”. Try another name.`}
        />
      </>
    );
  }

  const rowBg = [listRowBackground(colors.background)];

  return (
    <>
      {searchScreen}
      <Host style={{ flex: 1 }} colorScheme={scheme}>
        <List>
          {shown.map((item) => {
            const isAvailable = item.status === "available";
            const price =
              isAvailable && typeof item.price === "number" ? item.price : undefined;
            return (
              <ListItem
                key={item.handle}
                modifiers={rowBg}
                leading={
                  <RNHostView matchContents style={{ width: 50, height: 50 }}>
                    <Avatar handle={item.handle} size={50} />
                  </RNHostView>
                }
                supportingText={price !== undefined ? formatPrice(price) : "Unavailable"}
                trailing={
                  isAvailable ? (
                    <Text textStyle={{ color: colors.accent, fontWeight: "600" }}>Buy</Text>
                  ) : (
                    <Text textStyle={{ color: colors.textMuted }}>Taken</Text>
                  )
                }
                onPress={() => isAvailable && buy(item.handle)}
              >
                <Row alignment="center" spacing={0}>
                  <Text textStyle={{ fontSize: 17, fontWeight: "600" }}>
                    {item.handle}
                  </Text>
                </Row>
              </ListItem>
            );
          })}
        </List>
      </Host>
    </>
  );
}
