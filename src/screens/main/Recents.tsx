import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import type { NativeStackHeaderItem } from "@react-navigation/native-stack";
import {
  Host,
  List,
  ListItem,
  Icon,
  Text as UIText,
  Row,
  RNHostView,
} from "@expo/ui";
import { listRowBackground } from "@expo/ui/swift-ui/modifiers";
import type { SFSymbol } from "sf-symbols-typescript";
import { Colors, useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Clock } from "@/ui/icons";
import {
  listHistory,
  removeHistory,
  clearHistory,
  ResolveHistoryEntry,
} from "@/resolveHistory";

// Trust snapshot glyph (SF Symbol) for a recents row.
function trustGlyph(
  badge: ResolveHistoryEntry["badge"],
  c: Colors,
): { sf: SFSymbol; color: string } {
  if (badge === "orange") return { sf: "checkmark.seal.fill", color: c.statusGreenFg };
  if (badge === "unverified") return { sf: "exclamationmark.shield.fill", color: c.statusAmberFg };
  return { sf: "checkmark.shield", color: c.textMuted };
}

export default function Recents() {
  const router = useRouter();
  const { scheme, colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [entries, setEntries] = useState<ResolveHistoryEntry[]>([]);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => setEntries(await listHistory()), []);

  // Reload from the kv log on focus; leaving exits edit mode.
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

  const headerItems: NativeStackHeaderItem[] = useMemo(
    () =>
      entries.length === 0
        ? []
        : [
            {
              type: "button",
              label: editing ? "Done" : "Edit",
              tintColor: colors.text,
              onPress: () => setEditing((v) => !v),
            },
          ],
    [entries.length, editing, colors.text],
  );

  const screen = (
    <Stack.Screen options={{ unstable_headerRightItems: () => headerItems }} />
  );

  if (entries.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        {screen}
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Clock size={28} color={colors.textMuted} strokeWidth={2} />
          </View>
          <Text style={styles.emptyTitle}>No recents yet</Text>
          <Text style={styles.emptySub}>
            Handles you resolve from Search appear here, with their trust status.
          </Text>
        </View>
      </View>
    );
  }

  const rowBg = [listRowBackground(colors.background)];

  return (
    <>
      {screen}
      <Host style={{ flex: 1 }} colorScheme={scheme}>
        <List>
          {entries.map((item) => {
            const count =
              item.recordCount > 0
                ? `${item.recordCount} record${item.recordCount === 1 ? "" : "s"}`
                : "No records";
            const g = trustGlyph(item.badge, colors);
            return (
              <ListItem
                key={item.handle}
                modifiers={rowBg}
                leading={
                  <RNHostView matchContents style={{ width: 50, height: 50 }}>
                    <Avatar handle={item.handle} size={50} />
                  </RNHostView>
                }
                supportingText={
                  <Row alignment="center" spacing={5}>
                    <Icon name={g.sf} size={13} color={g.color} />
                    <UIText textStyle={{ fontSize: 14, color: colors.textMuted }}>
                      {count}
                    </UIText>
                  </Row>
                }
                trailing={
                  editing ? (
                    <Icon
                      name="minus.circle.fill"
                      size={20}
                      color={colors.danger}
                      onPress={() => remove(item.handle)}
                    />
                  ) : (
                    <Icon name="chevron.forward" size={14} color={colors.chevron} />
                  )
                }
                onPress={() => (editing ? remove(item.handle) : open(item.handle))}
              >
                <UIText textStyle={{ fontSize: 17, fontWeight: "600" }}>
                  {item.handle}
                </UIText>
              </ListItem>
            );
          })}

          {editing ? (
            <ListItem modifiers={rowBg} onPress={confirmClear}>
              <UIText textStyle={{ color: colors.danger }}>Clear All</UIText>
            </ListItem>
          ) : null}
        </List>
      </Host>
    </>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    emptyWrap: { flex: 1, backgroundColor: c.background },
    empty: { alignItems: "center", marginTop: 56, paddingHorizontal: 32 },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderCurve: "continuous",
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
  });
