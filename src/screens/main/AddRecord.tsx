import React, { useMemo, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Host, FieldGroup, ListItem, Icon, Text } from "@expo/ui";
import { useTheme } from "@/theme";
import { registryGroups, RecordDef, RecordGroup } from "@/recordRegistry";
import { sfFor } from "@/ui/handleProfileNative";

// Add a record — pick what it's FOR, not a key string (the registry supplies
// rtype + key). Native @expo/ui grouped sections, plus a native search bar to
// jump to a type without scrolling. "Other" stays reachable for anything
// unlabelled.
const GROUP_TITLES: Record<RecordGroup, string> = {
  payments: "Payments",
  identity: "Identity",
  general: "General",
};
const GROUP_ORDER: RecordGroup[] = ["payments", "identity", "general"];

export default function AddRecord() {
  const router = useRouter();
  const { scheme, colors } = useTheme();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const groups = useMemo(() => registryGroups(), []);
  const [query, setQuery] = useState("");

  const pick = (d: RecordDef) =>
    router.push({
      pathname: "/(main)/edit-record",
      params: { handle, rtype: d.rtype, key: d.key },
    });
  const custom = () =>
    router.push({ pathname: "/(main)/edit-record", params: { handle } });

  const q = query.trim().toLowerCase();
  const matches = (d: RecordDef) =>
    !q ||
    d.label.toLowerCase().includes(q) ||
    d.key.toLowerCase().includes(q) ||
    d.rtype.toLowerCase().includes(q);

  const filtered = useMemo(
    () =>
      GROUP_ORDER.flatMap((g) => groups[g]).filter(matches),
    [groups, q],
  );

  const row = (d: RecordDef) => (
    <ListItem
      key={`${d.rtype}:${d.key}`}
      leading={<Icon name={sfFor(d.key)} size={22} color={d.color} />}
      supportingText={`${d.rtype} · ${d.key}`}
      trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
      onPress={() => pick(d)}
    >
      <Text>{d.label}</Text>
    </ListItem>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Add record",
          // Give the search bar a settled home under the large title. Without
          // this, react-native-screens places it inline first and re-lays it out
          // below the title a frame later, which reads as a jump on entry.
          headerLargeTitle: true,
          headerSearchBarOptions: {
            placeholder: "Search record types",
            autoCapitalize: "none",
            hideWhenScrolling: false,
            textColor: colors.text,
            tintColor: colors.accent,
            onChangeText: (e) => setQuery(e.nativeEvent.text),
          },
        }}
      />
      <Host style={{ flex: 1 }} colorScheme={scheme}>
        <FieldGroup>
          {q ? (
            <FieldGroup.Section title={filtered.length ? "Results" : undefined}>
              {filtered.length ? (
                filtered.map(row)
              ) : (
                <ListItem
                  leading={<Icon name="magnifyingglass" size={22} color={colors.textMuted} />}
                  supportingText="Try “Other” for a custom key"
                >
                  <Text>{`No record type matches “${query.trim()}”`}</Text>
                </ListItem>
              )}
            </FieldGroup.Section>
          ) : (
            GROUP_ORDER.map((g) => (
              <FieldGroup.Section key={g} title={GROUP_TITLES[g]}>
                {groups[g].map(row)}
              </FieldGroup.Section>
            ))
          )}

          <FieldGroup.Section>
            <ListItem
              leading={<Icon name="ellipsis.circle" size={22} color={colors.textMuted} />}
              supportingText="Tor, age, DID, or a custom key"
              trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
              onPress={custom}
            >
              <Text>Other</Text>
            </ListItem>
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
    </>
  );
}
