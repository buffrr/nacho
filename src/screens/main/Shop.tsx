import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Colors, useTheme } from "@/theme";
import { ShopResults } from "@/ui/shopResults";
import { fetchNamespaces, formatPrice, Namespace } from "@/api";

const CHIPS_COLLAPSED = 4;

export default function Shop() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const [query, setQuery] = useState(prefill ?? "");
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [expanded, setExpanded] = useState(false);

  const searchRef = useRef<{
    focus: () => void;
    blur: () => void;
    clearText: () => void;
    toggleCancelButton: (show: boolean) => void;
    setText: (text: string) => void;
    cancelSearch: () => void;
  } | null>(null);

  // Available namespaces (@bitcoin, @key, …) to show as suffix chips — gives
  // someone with no name in mind something to tap, and signals it's a naming
  // system. The empty query returns the operator's open subspaces.
  useEffect(() => {
    let active = true;
    fetchNamespaces().then((ns) => {
      if (active) setNamespaces(ns);
    });
    return () => {
      active = false;
    };
  }, []);

  const buy = (handle: string) =>
    router.push({ pathname: "/(main)/(tabs)/handles/show-handle", params: { handle } });
  const view = (handle: string) =>
    router.push({ pathname: "/(main)/(tabs)/handles/view-handle", params: { handle } });

  // Auto-focus the native search field on open. Focusing a large-title search
  // bar across the push transition is flaky (autoFocus and a single delayed
  // focus() often miss while the header is still animating), so retry a few
  // times over ~1s until it takes. Skip when arriving with a prefill.
  useFocusEffect(
    useCallback(() => {
      if (prefill) return;
      let n = 0;
      const iv = setInterval(() => {
        searchRef.current?.focus();
        if (++n >= 8) clearInterval(iv);
      }, 130);
      return () => clearInterval(iv);
    }, [prefill]),
  );

  const searchScreen = (
    <Stack.Screen
      options={{
        title: "Find a handle",
        headerLargeTitle: true,
        headerSearchBarOptions: {
          ref: searchRef,
          autoFocus: true,
          placeholder: "Search a name",
          autoCapitalize: "none",
          hideWhenScrolling: false,
          textColor: colors.text,
          tintColor: colors.accent,
          hintTextColor: colors.textMuted,
          headerIconColor: colors.text,
          onChangeText: (e) =>
            setQuery(e.nativeEvent.text.toLowerCase().replace(/[^a-z0-9@.\-]/g, "")),
        },
      }}
    />
  );

  const shown = expanded ? namespaces : namespaces.slice(0, CHIPS_COLLAPSED);
  const moreCount = namespaces.length - shown.length;
  const prices = namespaces.map((n) => n.price).filter((p) => p > 0);
  const fromPrice = prices.length ? formatPrice(Math.min(...prices)) : null;

  return (
    <>
      {searchScreen}
      {query ? (
        <ShopResults query={query} onBuy={buy} onOpen={view} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.empty}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          {namespaces.length > 0 ? (
            <>
              {/* Informational only — they name the open spaces and signal this
                  is a naming system; not tappable, so it never reads as buying
                  "@bitcoin" itself. */}
              <Text style={styles.label}>Available namespaces</Text>
              <View style={styles.chips}>
                {shown.map((ns) => (
                  <View key={ns.tld} style={styles.chip}>
                    <Text style={styles.chipText}>@{ns.tld}</Text>
                  </View>
                ))}
                {moreCount > 0 ? (
                  <TouchableOpacity
                    style={[styles.chip, styles.moreChip]}
                    onPress={() => setExpanded(true)}
                  >
                    <Text style={styles.moreText}>+{moreCount} more</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          ) : null}
          {/* Always shown — the price is the first thing a browser wants, even if
              the namespaces list is slow. Falls back to just the permanence line
              until prices load. */}
          <Text style={styles.price}>
            {fromPrice
              ? `Pick a name once. It’s yours permanently - from ${fromPrice}, no rent.`
              : "Pick a name once. It’s yours permanently - no rent."}
          </Text>
        </ScrollView>
      )}
    </>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    empty: { paddingHorizontal: 20, paddingTop: 12, gap: 12 },
    label: { fontSize: 13, color: c.textSecondary },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 18,
      borderCurve: "continuous",
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    chipText: {
      fontSize: 15,
      fontWeight: "600",
      color: c.accent,
      fontFamily: "Menlo",
    },
    moreChip: { backgroundColor: "transparent" },
    moreText: { fontSize: 15, fontWeight: "500", color: c.textSecondary, fontFamily: "Menlo" },
    price: { fontSize: 13, color: c.textSecondary, lineHeight: 18, marginTop: 4 },
  });
