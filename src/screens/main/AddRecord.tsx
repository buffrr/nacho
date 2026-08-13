import React, { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Host, FieldGroup, ListItem, Icon, Text } from "@expo/ui";
import { useTheme } from "@/theme";
import { registryGroups, RecordDef, RecordGroup } from "@/recordRegistry";
import { sfFor } from "@/ui/handleProfileNative";

// Add a record — pick what it's FOR, not a key string (the registry supplies
// rtype + key). Native @expo/ui grouped sections; the groups are short enough to
// scan without a search field. "Other" stays reachable for anything unlabelled.
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

  const pick = (d: RecordDef) =>
    router.push({
      pathname: "/(main)/edit-record",
      params: { handle, rtype: d.rtype, key: d.key },
    });
  const custom = () =>
    router.push({ pathname: "/(main)/edit-record", params: { handle } });

  return (
    <Host style={{ flex: 1 }} colorScheme={scheme}>
      <FieldGroup>
        {GROUP_ORDER.map((g) => (
          <FieldGroup.Section key={g} title={GROUP_TITLES[g]}>
            {groups[g].map((d) => (
              <ListItem
                key={`${d.rtype}:${d.key}`}
                leading={<Icon name={sfFor(d.key)} size={22} color={d.color} />}
                supportingText={`${d.rtype} · ${d.key}`}
                trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
                onPress={() => pick(d)}
              >
                <Text>{d.label}</Text>
              </ListItem>
            ))}
          </FieldGroup.Section>
        ))}

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
  );
}
