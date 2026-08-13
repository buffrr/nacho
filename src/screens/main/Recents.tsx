import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
  Alert,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackHeaderItem } from "@react-navigation/native-stack";
import { Colors, useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import {
  ChevronRight,
  ShieldCheck,
  ShieldX,
  Clock,
  Trash,
} from "@/ui/icons";
import {
  listHistory,
  removeHistory,
  clearHistory,
  ResolveHistoryEntry,
} from "@/resolveHistory";

// Trust snapshot glyph for a recents row: your-anchor verified → green shield,
// default-anchor → neutral shield, observed-only → amber shield-x.
function TrustGlyph({ badge, c }: { badge: ResolveHistoryEntry["badge"]; c: Colors }) {
  if (badge === "orange")
    return <ShieldCheck size={14} color={c.statusGreenFg} strokeWidth={2.2} />;
  if (badge === "unverified")
    return <ShieldX size={14} color={c.statusAmberFg} strokeWidth={2.2} />;
  return <ShieldCheck size={14} color={c.textMuted} strokeWidth={2.2} />;
}

export default function Recents() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [entries, setEntries] = useState<ResolveHistoryEntry[]>([]);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => setEntries(await listHistory()), []);

  // Reload from the kv log each time the tab gains focus (picks up new resolves).
  // Leaving the tab exits edit mode, so returning never lands in a stale "Done".
  useFocusEffect(
    useCallback(() => {
      let active = true;
      listHistory().then((e) => active && setEntries(e));
      return () => {
        active = false;
        setEditing(false);
      };
    }, []),
  );

  const remove = useCallback(
    async (handle: string) => {
      await removeHistory(handle);
      await load();
    },
    [load],
  );

  const confirmClear = useCallback(() => {
    Alert.alert("Clear Recents", "Remove all resolved handles from history?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: async () => {
          await clearHistory();
          setEditing(false);
          await load();
        },
      },
    ]);
  }, [load]);

  const open = (handle: string) =>
    router.push({ pathname: "/(main)/view-handle", params: { handle } });

  // Edit / Done toggle as a native header button (only when there are entries).
  const headerItems: NativeStackHeaderItem[] = useMemo(
    () =>
      entries.length === 0
        ? []
        : [
            {
              // Neutral tint — native bar buttons aren't the brand colour.
              type: "button",
              label: editing ? "Done" : "Edit",
              tintColor: colors.text,
              onPress: () => setEditing((v) => !v),
            },
          ],
    [entries.length, editing, colors.text],
  );

  const renderItem = ({ item }: { item: ResolveHistoryEntry }) => {
    const count =
      item.recordCount > 0
        ? `${item.recordCount} record${item.recordCount === 1 ? "" : "s"}`
        : "No records";
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.6}
        onPress={() => (editing ? remove(item.handle) : open(item.handle))}
        onLongPress={() => !editing && remove(item.handle)}
      >
        {editing && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => remove(item.handle)}
            hitSlop={8}
          >
            <Trash size={15} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <Avatar handle={item.handle} size={50} />
        <View style={styles.mid}>
          <Text style={styles.name} numberOfLines={1}>
            {item.handle}
          </Text>
          <View style={styles.subRow}>
            <TrustGlyph badge={item.badge} c={colors} />
            <Text style={styles.subtitle} numberOfLines={1}>
              {count}
            </Text>
          </View>
        </View>
        {!editing && <ChevronRight size={15} color={colors.chevron} strokeWidth={2} />}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Stack.Screen options={{ unstable_headerRightItems: () => headerItems }} />
      <FlatList
        style={styles.list}
        contentInsetAdjustmentBehavior="automatic"
        data={entries}
        keyExtractor={(e) => e.handle}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Clock size={28} color={colors.textMuted} strokeWidth={2} />
            </View>
            <Text style={styles.emptyTitle}>No recents yet</Text>
            <Text style={styles.emptySub}>
              Handles you resolve from Search appear here, with their trust
              status.
            </Text>
          </View>
        }
        ListFooterComponent={
          editing && entries.length > 0 ? (
            <TouchableOpacity style={styles.clearBtn} onPress={confirmClear}>
              <Text style={styles.clearText}>Clear All</Text>
            </TouchableOpacity>
          ) : null
        }
        contentContainerStyle={
          Platform.OS === "ios"
            ? undefined
            : { paddingBottom: insets.bottom + 64 }
        }
      />
    </>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    list: { flex: 1, backgroundColor: c.background },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingLeft: 24,
      paddingRight: 18,
      paddingVertical: 14,
    },
    removeBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.danger,
      alignItems: "center",
      justifyContent: "center",
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginLeft: 88,
    },
    mid: { flex: 1, gap: 3 },
    name: { fontSize: 17, fontWeight: "600", color: c.text },
    subRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    subtitle: { fontSize: 14, color: c.textMuted, flexShrink: 1 },
    empty: { alignItems: "center", marginTop: 56, paddingHorizontal: 32 },
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
    },
    clearBtn: { alignItems: "center", paddingVertical: 18 },
    clearText: { fontSize: 15, fontWeight: "500", color: c.danger },
  });
