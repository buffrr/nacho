import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Colors, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { Search, ChevronRight, MoreVertical } from "@/ui/icons";
import {
  registryGroups,
  RecordDef,
  RecordGroup,
} from "@/recordRegistry";

// mocks2 §04 — "Add · search, then pick". Adding a record starts from what it's
// FOR, not from a key string: the registry supplies rtype + key. Search covers
// the person who knows what they want; the groups cover the one who's browsing.
// "Other" stays reachable for anything the table doesn't label.

const GROUP_TITLES: Record<RecordGroup, string> = {
  payments: "Payments",
  identity: "Identity",
  general: "General",
};
const GROUP_ORDER: RecordGroup[] = ["payments", "identity", "general"];

export default function AddRecord() {
  const router = useRouter();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => registryGroups(), []);
  const q = query.trim().toLowerCase();
  const match = (d: RecordDef) =>
    !q ||
    d.label.toLowerCase().includes(q) ||
    d.key.includes(q) ||
    `${d.rtype}:${d.key}`.includes(q);

  const pick = (d: RecordDef) =>
    router.push({
      pathname: "/(main)/edit-record",
      params: { handle, rtype: d.rtype, key: d.key },
    });

  const custom = () =>
    router.push({ pathname: "/(main)/edit-record", params: { handle } });

  const Row = ({ d, first }: { d: RecordDef; first: boolean }) => (
    <TouchableOpacity activeOpacity={0.7} onPress={() => pick(d)}>
      {!first && <View style={styles.divider} />}
      <View style={styles.pick}>
        <View style={[styles.ico, { backgroundColor: d.color + "22" }]}>
          <d.Icon size={18} color={d.color} />
        </View>
        <View style={styles.mid}>
          <Text style={styles.label}>{d.label}</Text>
          <Text style={styles.sub}>
            {d.rtype} · {d.key}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.chevron} />
      </View>
    </TouchableOpacity>
  );

  return (
    <Layout underHeader keyboardAware>
      <Stack.Screen options={{ title: "Add a record" }} />

      <View style={styles.search}>
        <Search size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search record types"
          placeholderTextColor={colors.placeholder}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {GROUP_ORDER.map((g) => {
        const defs = groups[g].filter(match);
        if (defs.length === 0) return null;
        return (
          <View key={g} style={styles.group}>
            <Text style={styles.groupLabel}>{GROUP_TITLES[g]}</Text>
            <View style={styles.card}>
              {defs.map((d, i) => (
                <Row key={`${d.rtype}:${d.key}`} d={d} first={i === 0} />
              ))}
            </View>
          </View>
        );
      })}

      {/* Other — a freeform key/value record for anything the table doesn't label. */}
      <View style={styles.group}>
        <View style={styles.card}>
          <TouchableOpacity activeOpacity={0.7} onPress={custom}>
            <View style={styles.pick}>
              <View style={[styles.ico, { backgroundColor: colors.surfaceSunken }]}>
                <MoreVertical size={18} color={colors.textMuted} />
              </View>
              <View style={styles.mid}>
                <Text style={styles.label}>Other</Text>
                <Text style={styles.subSans}>
                  Tor, age, DID, or a custom key
                </Text>
              </View>
              <ChevronRight size={18} color={colors.chevron} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.field,
      borderRadius: 11,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginTop: 6,
      marginBottom: 6,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: c.text,
      padding: 0,
      // @ts-ignore web-only
      outlineStyle: "none",
    } as never,
    group: { marginTop: 14 },
    groupLabel: {
      fontFamily: "monospace",
      fontSize: 10.5,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: c.textMuted,
      marginBottom: 7,
      marginLeft: 4,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 14,
      overflow: "hidden",
    },
    pick: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    ico: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    mid: { flex: 1, gap: 2 },
    label: { fontSize: 14.5, color: c.text, fontWeight: "500" },
    sub: { fontSize: 11.5, color: c.textMuted, fontFamily: "monospace" },
    subSans: { fontSize: 12, color: c.textMuted },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginLeft: 56,
    },
  });
