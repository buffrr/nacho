import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HandleData, useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { scriptForHandle } from "@/keys";
import { handleTileInfo, avatarColors } from "@/handleTile";
import { recordsCounts } from "@/db";
import { HandleTile } from "@/ui/HandleTile";
import { ShoppingBag } from "@/ui/icons";

// The FlatList is the screen's PRIMARY scroll view (no Layout wrapper) with
// contentInsetAdjustmentBehavior="automatic", so the native large title
// (handles/_layout) can track scroll offset — left-aligned at rest, collapsing
// into the centred nav-bar title as the list scrolls (Messages/Settings style).
export default function ListHandles() {
  const router = useRouter();
  const { handles, xpub } = useStore();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const handlesList = Object.entries(handles || {});

  // Refresh the cached record counts each time the list gains focus (e.g. after
  // publishing records on a handle detail screen). Local DB only — no network.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      recordsCounts().then((c) => {
        if (active) setCounts(c);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const infoFor = (name: string, handleData: HandleData) => {
    const ourScript = xpub ? scriptForHandle(xpub, handleData) : null;
    const resolution = handleData.resolution;
    const keyMismatch = !!(
      resolution?.found &&
      resolution.scriptPubkey &&
      ourScript &&
      resolution.scriptPubkey !== ourScript
    );
    return handleTileInfo({
      resolution,
      keyMismatch,
      hasCert: !!handleData.certRef || !!handleData.cert,
      isImported: handleData.source === "imported",
      recordCount: counts[name] ?? 0,
    });
  };

  const shopButton = (
    <TouchableOpacity
      style={styles.shopButton}
      onPress={() => router.push("/(main)/shop")}
    >
      <ShoppingBag size={18} color={colors.text} />
      <Text style={styles.shopText}>Shop handles</Text>
    </TouchableOpacity>
  );

  return (
    <FlatList
      style={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      data={handlesList}
      keyExtractor={([name]) => name}
      renderItem={({ item: [name, handleData] }) => (
        <HandleTile
          handle={name}
          info={infoFor(name, handleData)}
          avatar={avatarColors(colors, name)}
          onPress={() =>
            router.push({ pathname: "/(main)/show-handle", params: { handle: name } })
          }
        />
      )}
      ListEmptyComponent={
        <Text style={styles.empty}>No handles yet. Tap + to add one.</Text>
      }
      ListFooterComponent={<View style={styles.footer}>{shopButton}</View>}
      // iOS auto-insets for the nav + floating tab bar; other platforms need an
      // explicit bottom pad so the last row / shop button clears the tab bar.
      contentContainerStyle={
        Platform.OS === "ios" ? undefined : { paddingBottom: insets.bottom + 64 }
      }
    />
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    list: {
      flex: 1,
      backgroundColor: c.background,
    },
    empty: {
      color: c.textMuted,
      fontSize: 15,
      textAlign: "center",
      marginTop: 40,
      marginHorizontal: 20,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    shopButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 14,
      height: 54,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    shopText: {
      fontSize: 16,
      fontWeight: "500",
      color: c.text,
    },
  });
