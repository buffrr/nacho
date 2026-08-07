import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
  Platform,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useFocusEffect, useRouter } from "expo-router";
import { HandleData, useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { scriptForHandle } from "@/keys";
import { handleTileInfo, avatarColors } from "@/handleTile";
import { recordsCounts } from "@/db";
import { Layout } from "@/ui/Layout";
import { HandleTile } from "@/ui/HandleTile";
import { Plus, ShoppingBag } from "@/ui/icons";

export default function ListHandles() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { handles, xpub } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const handlesList = Object.entries(handles || {});

  // Refresh the cached record counts each time the list gains focus (e.g. after
  // publishing records on a handle detail screen).
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

  const renderItem = ({ item }: { item: [string, HandleData] }) => {
    const [name, handleData] = item;
    return (
      <HandleTile
        handle={name}
        info={infoFor(name, handleData)}
        avatar={avatarColors(colors, name)}
        onPress={() =>
          router.push({
            pathname: "/(main)/show-handle",
            params: { handle: name },
          })
        }
      />
    );
  };

  return (
    <Layout scrollable={false} padTop>
      <View style={styles.header}>
        <Text style={styles.title}>Your handles</Text>
        {isLiquidGlassAvailable() ? (
          // iOS 26 Liquid Glass button, accent-tinted (matches the tab bar).
          <Pressable
            onPress={() => router.push("/(main)/register-hub")}
            accessibilityLabel="Add handle"
          >
            <GlassView
              style={styles.add}
              glassEffectStyle="regular"
              isInteractive
              tintColor={colors.accent}
            >
              <Plus size={20} color={colors.accentText} />
            </GlassView>
          </Pressable>
        ) : (
          // Fallback (web / pre-iOS-26): solid accent circle.
          <TouchableOpacity
            style={[styles.add, { backgroundColor: colors.accent }]}
            onPress={() => router.push("/(main)/register-hub")}
            accessibilityLabel="Add handle"
          >
            <Plus size={20} color={colors.accentText} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={handlesList}
        renderItem={renderItem}
        keyExtractor={(item) => item[0]}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        // Let content scroll under the floating native tab bar (iOS auto-insets;
        // Android/web get an explicit bottom pad).
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingBottom: Platform.OS === "ios" ? 0 : insets.bottom + 64,
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No handles yet. Tap + to add one.</Text>
        }
        ListFooterComponent={
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => router.navigate("/(main)/(tabs)/shop")}
          >
            <ShoppingBag size={18} color={colors.text} />
            <Text style={styles.shopText}>Shop handles</Text>
          </TouchableOpacity>
        }
      />
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 4,
      marginBottom: 20,
    },
    title: {
      flex: 1,
      fontSize: 24,
      fontWeight: "700",
      color: c.text,
    },
    add: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    list: {
      flex: 1,
    },
    empty: {
      color: c.textMuted,
      fontSize: 15,
      textAlign: "center",
      marginTop: 40,
      marginBottom: 20,
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
      marginTop: 4,
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
