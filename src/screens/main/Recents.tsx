import React, { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import type { NativeStackHeaderItem } from "@react-navigation/native-stack";
import {
  Host,
  ListItem,
  Icon,
  Text as UIText,
  Row,
  RNHostView,
} from "@expo/ui";
import { listRowBackground, listRowSeparator } from "@expo/ui/swift-ui/modifiers";
import { PlainList } from "@/ui/PlainList";
import type { SFSymbol } from "sf-symbols-typescript";
import { Colors, useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { NativeEmpty } from "@/ui/nativeEmpty";
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
    router.push({ pathname: "/(main)/(tabs)/recents/view-handle", params: { handle } });

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
      <>
        {screen}
        <NativeEmpty
          sf="clock.arrow.circlepath"
          title="No recents yet"
          message="Handles you resolve from Search appear here, with their trust status."
        />
      </>
    );
  }

  // Hide the plain-style List's hairline above the first cell and below the last
  // (stray dividers at the ends). When editing, the trailing "Clear All" row is
  // the last one, so the entries don't hide their bottom then.
  const rowBg = [listRowBackground(colors.background)];
  const rowMods = (i: number) => {
    const m = [...rowBg];
    if (i === 0) m.push(listRowSeparator("hidden", "top"));
    if (!editing && i === entries.length - 1) m.push(listRowSeparator("hidden", "bottom"));
    return m;
  };

  return (
    <>
      {screen}
      <Host style={{ flex: 1 }} colorScheme={scheme}>
        <PlainList>
          {entries.map((item, i) => {
            const count =
              item.recordCount > 0
                ? `${item.recordCount} record${item.recordCount === 1 ? "" : "s"}`
                : "No records";
            const g = trustGlyph(item.badge, colors);
            return (
              <ListItem
                key={item.handle}
                modifiers={rowMods(i)}
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
            <ListItem
              modifiers={[...rowBg, listRowSeparator("hidden", "bottom")]}
              onPress={confirmClear}
            >
              <UIText textStyle={{ color: colors.danger }}>Clear All</UIText>
            </ListItem>
          ) : null}
        </PlainList>
      </Host>
    </>
  );
}
