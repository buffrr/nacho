import React, { useEffect, useState } from "react";
import { Host, ListItem, Icon, Text, Button, RNHostView } from "@expo/ui";
import {
  listRowBackground,
  listRowSeparator,
  controlSize,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { PlainList } from "@/ui/PlainList";
import { useStore } from "@/Store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { NativeEmpty } from "@/ui/nativeEmpty";
import { searchHandles, formatPrice, SearchMatch } from "@/api";

// The shop search results (native list + searching / error / empty states),
// driven by a query string. Shared by the Shop screen and the Search tab (which
// falls back to shopping when the query isn't a handle). Debounces and filters
// out handles already in the keystore. Tapping an available handle (row or the
// Buy button) calls onBuy; tapping a taken handle calls onOpen to resolve it.
export function ShopResults({
  query,
  onBuy,
  onOpen,
}: {
  query: string;
  onBuy: (handle: string) => void;
  onOpen: (handle: string) => void;
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

  // Hide the plain-style List's hairline above the first cell and below the last
  // (stray dividers at the ends).
  const rowBg = [listRowBackground(colors.background)];
  const rowMods = (i: number, count: number) => {
    const m = [...rowBg];
    if (i === 0) m.push(listRowSeparator("hidden", "top"));
    if (i === count - 1) m.push(listRowSeparator("hidden", "bottom"));
    return m;
  };
  // Trailing "Buy <price>" button: a filled (accent background, white text)
  // prominent button — tapping it (or the row) opens the buy flow.
  const pill = [controlSize("small"), tint(colors.accent)];

  return (
    <Host style={{ flex: 1 }} colorScheme={scheme}>
      <PlainList>
        {shown.map((item, i) => {
          const isAvailable = item.status === "available";
          const price =
            isAvailable && typeof item.price === "number" ? item.price : undefined;
          return (
            <ListItem
              key={item.handle}
              modifiers={rowMods(i, shown.length)}
              leading={
                <RNHostView matchContents style={{ width: 50, height: 50 }}>
                  <Avatar handle={item.handle} size={50} />
                </RNHostView>
              }
              supportingText={isAvailable ? undefined : "Taken · tap to resolve"}
              trailing={
                isAvailable ? (
                  <Button
                    label={price !== undefined ? `Buy ${formatPrice(price)}` : "Buy"}
                    variant="filled"
                    modifiers={pill}
                    onPress={() => onBuy(item.handle)}
                  />
                ) : (
                  <Icon name="chevron.forward" size={14} color={colors.chevron} />
                )
              }
              onPress={() =>
                isAvailable ? onBuy(item.handle) : onOpen(item.handle)
              }
            >
              <Text textStyle={{ fontSize: 17, fontWeight: "600" }}>{item.handle}</Text>
            </ListItem>
          );
        })}
      </PlainList>
    </Host>
  );
}
