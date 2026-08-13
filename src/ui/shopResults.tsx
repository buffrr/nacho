import React, { useEffect, useState } from "react";
import { Host, ListItem, Icon, Text, RNHostView } from "@expo/ui";
import { listRowBackground } from "@expo/ui/swift-ui/modifiers";
import { PlainList } from "@/ui/PlainList";
import { useStore } from "@/Store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { NativeEmpty } from "@/ui/nativeEmpty";
import { searchHandles, formatPrice, SearchMatch } from "@/api";

// The shop search results (native list + searching / error / empty states),
// driven by a query string. Shared by the Shop screen and the Search tab (which
// falls back to shopping when the query isn't a handle). Debounces and filters
// out handles already in the keystore; taps on an available handle call onBuy.
export function ShopResults({
  query,
  onBuy,
}: {
  query: string;
  onBuy: (handle: string) => void;
}) {
  const { handles } = useStore();
  const { scheme, colors } = useTheme();
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

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

  if (error) {
    return (
      <NativeEmpty
        sf="wifi.slash"
        title="Something went wrong"
        message="Couldn’t reach the shop. Check your connection."
        primary={{ label: "Try again", onPress: () => setNonce((n) => n + 1) }}
      />
    );
  }
  if (searching) {
    return <NativeEmpty sf="magnifyingglass" title="Searching…" />;
  }
  if (shown.length === 0) {
    return (
      <NativeEmpty
        sf="magnifyingglass"
        title="No handles found"
        message={`Nothing available for “${query}”.`}
      />
    );
  }

  const rowBg = [listRowBackground(colors.background)];
  return (
    <Host style={{ flex: 1 }} colorScheme={scheme}>
      <PlainList>
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
              onPress={() => isAvailable && onBuy(item.handle)}
            >
              <Text textStyle={{ fontSize: 17, fontWeight: "600" }}>{item.handle}</Text>
            </ListItem>
          );
        })}
      </PlainList>
    </Host>
  );
}
