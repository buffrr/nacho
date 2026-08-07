import React, { useState, useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { HandleData, useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { scriptForHandle } from "@/keys";
import { handleTileInfo, avatarColors } from "@/handleTile";
import { recordsCounts } from "@/db";
import { Layout } from "@/ui/Layout";
import { HandleTile } from "@/ui/HandleTile";
import { ShoppingBag } from "@/ui/icons";

export default function ListHandles() {
  const router = useRouter();
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

  return (
    <Layout scrollable tabBarInset underHeader>
      {handlesList.length === 0 ? (
        <Text style={styles.empty}>No handles yet. Tap + to add one.</Text>
      ) : (
        // Plain edge-to-edge list: no card, no dividers — just rows.
        <View style={styles.list}>
          {handlesList.map(([name, handleData]) => (
            <HandleTile
              key={name}
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
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.shopButton}
        onPress={() => router.navigate("/(main)/(tabs)/shop")}
      >
        <ShoppingBag size={18} color={colors.text} />
        <Text style={styles.shopText}>Shop handles</Text>
      </TouchableOpacity>
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    list: {
      // Break out of the Layout's horizontal padding so rows span full width
      // (their own paddingHorizontal aligns content to the standard margin).
      marginHorizontal: -20,
      marginBottom: 12,
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
