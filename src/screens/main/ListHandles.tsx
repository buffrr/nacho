import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HandleData, useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { scriptForHandle } from "@/keys";
import { handleTileInfo } from "@/handleTile";
import { recordsCounts } from "@/db";
import { refreshSemiTrust, resolveHandle } from "@/fabric";
import { HandleTile } from "@/ui/HandleTile";
import { ShoppingBag, Plus, AtSign, ChevronRight } from "@/ui/icons";

// The FlatList is the screen's PRIMARY scroll view (no Layout wrapper) with
// contentInsetAdjustmentBehavior="automatic", so the native large title
// (handles/_layout) can track scroll offset — left-aligned at rest, collapsing
// into the centred nav-bar title as the list scrolls (Messages/Settings style).
export default function ListHandles() {
  const router = useRouter();
  const { handles, xpub, setHandleResolution } = useStore();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);

  const handlesList = Object.entries(handles || {});

  // Pull-to-refresh: EXPLICITLY refresh the semi-trusted anchor (the only place we
  // re-fetch it — never automatically), then re-resolve each handle so the tiles'
  // status is current. User-initiated, so the extra network is fine.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshSemiTrust();
      await Promise.all(
        Object.entries(handles || {}).map(async ([name, data]) => {
          try {
            const resolved = await resolveHandle(name);
            if (resolved) {
              await setHandleResolution(name, {
                found: true,
                sovereignty: resolved.zone.sovereignty ?? "unknown",
                scriptPubkey: resolved.zone.script_pubkey,
                updatedAt: Date.now(),
              });
            } else if (!data.resolution?.found) {
              // Don't downgrade a handle we've already seen resolve (propagation lag).
              await setHandleResolution(name, { found: false, updatedAt: Date.now() });
            }
          } catch {
            // skip this handle; others still refresh
          }
        }),
      );
      setCounts(await recordsCounts());
    } finally {
      setRefreshing(false);
    }
  }, [handles, setHandleResolution]);

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

  const isEmpty = handlesList.length === 0;
  const emptyState = (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <AtSign size={30} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No handles yet</Text>
      <Text style={styles.emptySub}>
        Register a new handle or buy one — it lives in this keystore, yours to
        control.
      </Text>
      <TouchableOpacity
        style={styles.emptyPrimary}
        onPress={() => router.push("/(main)/register-hub")}
      >
        <Plus size={18} color={colors.accentText} />
        <Text style={styles.emptyPrimaryText}>Register a handle</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.emptySecondary}
        onPress={() => router.push("/(main)/shop")}
      >
        <ShoppingBag size={18} color={colors.text} />
        <Text style={styles.emptySecondaryText}>Shop handles</Text>
        <ChevronRight size={18} color={colors.chevron} />
      </TouchableOpacity>
    </View>
  );

  return (
    <FlatList
      style={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.iconDefault}
        />
      }
      data={handlesList}
      keyExtractor={([name]) => name}
      renderItem={({ item: [name, handleData] }) => (
        <HandleTile
          handle={name}
          info={infoFor(name, handleData)}
          onPress={() =>
            router.push({ pathname: "/(main)/show-handle", params: { handle: name } })
          }
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={emptyState}
      // The shop button repeats in the footer only once there are handles; the
      // empty state already offers both actions.
      ListFooterComponent={
        isEmpty ? null : <View style={styles.footer}>{shopButton}</View>
      }
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
    // Hairline inset to the text start (row pad 20 + avatar 50 + gap 14),
    // full-bleed to the right edge — Messages style.
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginLeft: 84,
    },
    empty: {
      alignItems: "center",
      marginTop: 56,
      paddingHorizontal: 32,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: c.surfaceSunken,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
    },
    emptyTitle: { fontSize: 20, fontWeight: "700", color: c.text },
    emptySub: {
      fontSize: 14,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      marginTop: 8,
      marginBottom: 24,
    },
    emptyPrimary: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      alignSelf: "stretch",
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 14,
    },
    emptyPrimaryText: { fontSize: 15, fontWeight: "600", color: c.accentText },
    emptySecondary: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      alignSelf: "stretch",
      backgroundColor: c.card,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginTop: 12,
    },
    emptySecondaryText: { flex: 1, fontSize: 15, fontWeight: "500", color: c.text },
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
