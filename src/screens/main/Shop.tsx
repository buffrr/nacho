import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Layout } from "@/ui/Layout";
import { Search, ShoppingBag, WifiOff } from "@/ui/icons";
import { searchHandles, formatPrice, SearchMatch } from "@/api";

export default function Shop() {
  const router = useRouter();
  const { handles } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Prefill from a handed-off query (e.g. a not-found resolve → "check availability").
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const [query, setQuery] = useState(prefill ?? "");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0); // bump to retry the same query

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
        // The purchase API is optional infrastructure — if it's down, say so and
        // offer a retry rather than spinning forever on "Searching…".
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

  // Show the operator's real candidates (name expanded across its spaces), minus
  // handles already in the keystore and unusable statuses. Available first.
  const shown = matches
    .filter(
      (m) =>
        m.status !== "invalid" &&
        m.status !== "unknown" &&
        !handles?.[m.handle],
    )
    .sort(
      (a, b) =>
        (a.status === "available" ? 0 : 1) - (b.status === "available" ? 0 : 1),
    );
  const openCount = shown.filter((m) => m.status === "available").length;
  const takenCount = shown.length - openCount;

  // Don't persist the handle here — just open its detail in a prospective state.
  // It's committed to the keystore only once the purchase is reserved.
  const buy = (handle: string) =>
    router.push({ pathname: "/(main)/show-handle", params: { handle } });

  const focusSearch = useCallback(() => {
    setTimeout(() => searchRef.current?.focus(), 60);
  }, []);
  // Auto-focus on entry so the keyboard is up immediately.
  useEffect(() => {
    if (!prefill) focusSearch();
  }, [prefill, focusSearch]);

  return (
    <Layout underHeader keyboardAware={false}>
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
              setQuery(
                e.nativeEvent.text.toLowerCase().replace(/[^a-z0-9@.\-]/g, ""),
              ),
          },
        }}
      />

      {!query ? (
        <View style={styles.center}>
          <View style={styles.bigIcon}>
            <ShoppingBag size={26} color={colors.textMuted} />
          </View>
          <Text style={styles.centerTitle}>Find a handle</Text>
          <Text style={styles.centerSub}>
            Search a name to see what’s available to buy.
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.bigIcon}>
            <WifiOff size={26} color={colors.textMuted} />
          </View>
          <Text style={styles.centerTitle}>Something went wrong</Text>
          <Text style={styles.centerSub}>
            Couldn’t reach the handle shop. Check your connection and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => setNonce((n) => n + 1)}
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : searching ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        </View>
      ) : shown.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.bigIcon}>
            <Search size={24} color={colors.textMuted} />
          </View>
          <Text style={styles.centerTitle}>No handles found</Text>
          <Text style={styles.centerSub}>
            Nothing available for “{query}”. Try another name.
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionLabel}>
            {openCount} open · {takenCount} taken
          </Text>
          <View style={styles.card}>
            {shown.map((item, i) => {
              const isAvailable = item.status === "available";
              const price =
                isAvailable && typeof item.price === "number"
                  ? item.price
                  : undefined;
              return (
                <View key={item.handle}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.row}>
                    <Avatar handle={item.handle} size={50} />
                    <View style={styles.mid}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.handle}
                      </Text>
                      <Text style={styles.price}>
                        {price !== undefined ? formatPrice(price) : "Unavailable"}
                      </Text>
                    </View>
                    {isAvailable ? (
                      <TouchableOpacity
                        style={styles.buyBtn}
                        onPress={() => buy(item.handle)}
                      >
                        <Text style={styles.buyText}>Buy</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.takenChip}>
                        <Text style={styles.takenText}>Taken</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    center: { alignItems: "center", paddingTop: 48, paddingHorizontal: 8 },
    bigIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: c.surfaceSunken,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    centerTitle: { fontSize: 19, fontWeight: "600", color: c.text },
    centerSub: {
      fontSize: 14,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      marginTop: 8,
      maxWidth: 300,
    },
    retryBtn: {
      backgroundColor: c.accentMuted,
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 32,
      marginTop: 18,
    },
    retryText: { fontSize: 15, fontWeight: "600", color: c.accentText },
    sectionLabel: {
      fontFamily: "monospace",
      fontSize: 10.5,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: c.textMuted,
      marginTop: 6,
      marginBottom: 7,
      marginLeft: 4,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginLeft: 76,
    },
    mid: { flex: 1, gap: 3 },
    name: { fontSize: 16, fontWeight: "500", color: c.text },
    price: { fontSize: 13, color: c.textMuted },
    buyBtn: {
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingHorizontal: 18,
      paddingVertical: 8,
    },
    buyText: { color: c.accentText, fontSize: 14, fontWeight: "600" },
    takenChip: {
      backgroundColor: c.chip,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    takenText: { color: c.textMuted, fontSize: 14, fontWeight: "500" },
  });
