import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { HandleData, useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { scriptForHandle } from "@/keys";
import { scriptMatchesStatus } from "@/handleStatus";
import { handlePill, avatarColors } from "@/handleTile";
import { Layout } from "@/ui/Layout";
import { BottomNav } from "@/ui/BottomNav";
import { HandleTile } from "@/ui/HandleTile";
import { Plus, ShoppingBag } from "@/ui/icons";
import { fetchHandlesStatuses, HandleStatus } from "@/api";

type Nav = NativeStackNavigationProp<HandlesStackParamList, "ListHandles">;

export default function ListHandles({ navigation }: { navigation: Nav }) {
  const { handles, xpub } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [statuses, setStatuses] = useState<Record<string, HandleStatus>>({});

  const handlesList = Object.entries(handles || {});
  const handlesKey = handlesList.map(([name]) => name).join(",");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const names = handlesKey ? handlesKey.split(",") : [];
        if (names.length === 0) {
          setStatuses({});
          return;
        }
        const results = await fetchHandlesStatuses(names);
        if (!active) return;
        setStatuses((prev) => {
          const next = { ...prev };
          for (const s of results) next[s.handle] = s;
          return next;
        });
      })();
      return () => {
        active = false;
      };
    }, [handlesKey]),
  );

  const pillFor = (name: string, handleData: HandleData) => {
    const ourScript = xpub ? scriptForHandle(xpub, handleData) : null;
    const status = statuses[name];
    const scriptMatches =
      status && ourScript ? scriptMatchesStatus(status, ourScript) : null;
    const resolution = handleData.resolution;
    const keyMismatch = !!(
      resolution?.found &&
      resolution.scriptPubkey &&
      ourScript &&
      resolution.scriptPubkey !== ourScript
    );
    return handlePill(colors, {
      resolution,
      keyMismatch,
      hasCert: !!handleData.certRef || !!handleData.cert,
      status: status?.status,
      scriptMatches,
    });
  };

  const renderItem = ({ item }: { item: [string, HandleData] }) => {
    const [name, handleData] = item;
    return (
      <HandleTile
        handle={name}
        pill={pillFor(name, handleData)}
        avatar={avatarColors(colors, name)}
        onPress={() => navigation.navigate("ShowHandle", { handle: name })}
      />
    );
  };

  return (
    <Layout scrollable={false} padTop footer={<BottomNav active="handles" />}>
      <View style={styles.header}>
        <Text style={styles.title}>Your handles</Text>
        <TouchableOpacity
          style={styles.add}
          onPress={() => navigation.navigate("RegisterHub")}
          accessibilityLabel="Add handle"
        >
          <Plus size={20} color={colors.accentText} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={handlesList}
        renderItem={renderItem}
        keyExtractor={(item) => item[0]}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No handles yet. Tap + to add one.</Text>
        }
        ListFooterComponent={
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => navigation.navigate("Shop")}
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
      borderRadius: 12,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
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
