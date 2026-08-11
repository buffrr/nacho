import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Platform,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Layout } from "@/ui/Layout";
import { AtSign, Search } from "@/ui/icons";
import { searchHandles, formatPrice, SearchMatch } from "@/api";

export default function Shop() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { handles } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query) {
      setMatches([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let active = true;
    const id = setTimeout(async () => {
      const results = await searchHandles(query);
      if (!active) return;
      setMatches(results);
      setSearching(false);
    }, 300);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [query]);

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
  const buy = (handle: string) => {
    router.push({ pathname: "/(main)/show-handle", params: { handle } });
  };

  const renderItem = ({ item }: { item: SearchMatch }) => {
    const isAvailable = item.status === "available";
    const price =
      isAvailable && typeof item.price === "number" ? item.price : undefined;
    return (
      <View style={styles.row}>
        <Avatar handle={item.handle} size={46} />
        <View style={styles.mid}>
          <Text style={styles.name} numberOfLines={1}>
            {item.handle}
          </Text>
          <Text style={styles.price}>
            {price !== undefined ? formatPrice(price) : "Unavailable"}
          </Text>
        </View>
        {isAvailable ? (
          <TouchableOpacity style={styles.buyBtn} onPress={() => buy(item.handle)}>
            <Text style={styles.buyText}>Buy</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.takenChip}>
            <Text style={styles.takenText}>Taken</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Layout scrollable={false} underHeader>
      <FlatList
        data={shown}
        renderItem={renderItem}
        keyExtractor={(m) => m.handle}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingBottom: Platform.OS === "ios" ? 0 : insets.bottom + 64,
        }}
        ListHeaderComponent={
          <>
            <View style={styles.searchWrap}>
              <TextInput
                value={query}
                onChangeText={(t) =>
                  setQuery(t.toLowerCase().replace(/[^a-z0-9@.\-]/g, ""))
                }
                placeholder="Search a name"
                placeholderTextColor={colors.placeholder}
                style={styles.search}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.searchIcon}>
                <Search size={18} color={colors.textMuted} />
              </View>
            </View>
            {shown.length > 0 && (
              <Text style={styles.sectionLabel}>
                AVAILABLE HANDLES{"   "}
                <Text style={styles.count}>
                  {openCount} open · {takenCount} taken
                </Text>
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {!query
              ? "Search for a handle to buy."
              : searching
                ? "Searching…"
                : "No handles found"}
          </Text>
        }
      />
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: c.text,
      marginTop: 8,
      marginBottom: 16,
    },
    searchWrap: {
      marginBottom: 20,
      justifyContent: "center",
    },
    search: {
      backgroundColor: c.field,
      borderRadius: 14,
      paddingLeft: 16,
      paddingRight: 44,
      paddingVertical: 15,
      fontSize: 16,
      color: c.text,
      // @ts-ignore web-only
      outlineStyle: "none",
    } as any,
    searchIcon: {
      position: "absolute",
      right: 16,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.5,
      color: c.textMuted,
      marginBottom: 12,
    },
    count: {
      fontWeight: "500",
      color: c.textMuted,
    },
    list: {
      flex: 1,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      padding: 12,
      marginBottom: 10,
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    mid: {
      flex: 1,
      gap: 3,
    },
    name: {
      fontSize: 16,
      fontWeight: "500",
      color: c.text,
    },
    price: {
      fontSize: 13,
      color: c.textMuted,
    },
    buyBtn: {
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingHorizontal: 18,
      paddingVertical: 8,
    },
    buyText: {
      color: c.accentText,
      fontSize: 14,
      fontWeight: "600",
    },
    takenChip: {
      backgroundColor: c.chip,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    takenText: {
      color: c.textMuted,
      fontSize: 14,
      fontWeight: "500",
    },
    empty: {
      color: c.textMuted,
      fontSize: 15,
      textAlign: "center",
      marginTop: 40,
    },
  });
