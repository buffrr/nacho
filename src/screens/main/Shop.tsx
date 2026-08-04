import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { avatarColors } from "@/handleTile";
import { Layout } from "@/ui/Layout";
import { BottomNav } from "@/ui/BottomNav";
import { AtSign, Search } from "@/ui/icons";
import {
  fetchProposedHandles,
  fetchHandlesStatuses,
  formatPrice,
  HandleStatus,
} from "@/api";

type Props = NativeStackScreenProps<HandlesStackParamList, "Shop">;

export default function Shop({ navigation }: Props) {
  const { handles } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState("");
  const [proposed, setProposed] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Record<string, HandleStatus>>({});

  useEffect(() => {
    const id = setTimeout(async () => {
      if (!query) {
        setProposed([]);
        return;
      }
      const results = await fetchProposedHandles(query);
      setProposed(results);
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (proposed.length === 0) return;
    let active = true;
    (async () => {
      const results = await fetchHandlesStatuses(proposed);
      if (!active) return;
      const map: Record<string, HandleStatus> = {};
      for (const s of results) map[s.handle] = s;
      setStatuses(map);
    })();
    return () => {
      active = false;
    };
  }, [proposed]);

  const available = proposed.filter((h) => !handles?.[h]);
  const openCount = available.filter(
    (h) => statuses[h]?.status === "available",
  ).length;
  const takenCount = available.length - openCount;

  // Don't persist the handle here — just open its detail in a prospective state.
  // It's committed to the keystore only once the purchase is reserved.
  const buy = (handle: string) => {
    navigation.navigate("ShowHandle", { handle });
  };

  const renderItem = ({ item }: { item: string }) => {
    const status = statuses[item];
    const isTaken = status?.status && status.status !== "available";
    const price =
      status?.status === "available" && typeof status.price === "number"
        ? status.price
        : undefined;
    return (
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: avatarColors(colors, item).bg }]}>
          <AtSign size={22} color={avatarColors(colors, item).fg} />
        </View>
        <View style={styles.mid}>
          <Text style={styles.name} numberOfLines={1}>
            {item}
          </Text>
          {price !== undefined ? (
            <Text style={styles.price}>{formatPrice(price)}</Text>
          ) : isTaken ? (
            <Text style={styles.price}>Unavailable</Text>
          ) : null}
        </View>
        {isTaken ? (
          <View style={styles.takenChip}>
            <Text style={styles.takenText}>Taken</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.buyBtn} onPress={() => buy(item)}>
            <Text style={styles.buyText}>Buy</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Layout scrollable={false} padTop footer={<BottomNav active="shop" />}>
      <Text style={styles.title}>Shop handles</Text>

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

      {available.length > 0 && (
        <Text style={styles.sectionLabel}>
          AVAILABLE HANDLES{"   "}
          <Text style={styles.count}>
            {openCount} open · {takenCount} taken
          </Text>
        </Text>
      )}

      <FlatList
        data={available}
        renderItem={renderItem}
        keyExtractor={(h) => h}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {query ? "No handles found" : "Search for a handle to buy."}
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
