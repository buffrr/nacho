import React from "react";
import {
  Host,
  FieldGroup,
  ListItem,
  Icon,
  Text,
  Column,
  Row,
  Spacer,
  RNHostView,
} from "@expo/ui";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import type { EditableRecord } from "@/fabricResolver";
import { lookupRecord } from "@/recordRegistry";
import { sfFor } from "@/ui/handleProfileNative";
import type { Pill } from "@/handleTile";

// The OWNER's handle view (ShowHandle manage state) rendered with @expo/ui's
// cross-platform native widgets, matching the resolve/handle view. Records tap
// through to the editor; details copy; a status pill + "last published" reflect
// the handle's state. The buy / onboarding flows stay on RN (transient).
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
function lastPublished(seq: number): string | null {
  if (seq <= 1_000_000_000) return null; // not a unix-seconds seq
  const d = new Date(seq * 1000);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function short(v: string): string {
  return v.length <= 20 ? v : `${v.slice(0, 8)}…${v.slice(-8)}`;
}

export function OwnerProfileNative({
  handle,
  records,
  pubkey,
  numId,
  alias,
  seq,
  pill,
  sovereign,
  banner,
  copied,
  onEditRecord,
  onAddRecord,
  onCopy,
}: {
  handle: string;
  records: EditableRecord[];
  pubkey: string;
  numId?: string | null;
  alias?: string | null;
  seq: number;
  pill: Pill;
  sovereign: boolean;
  banner?: { text: string; tone: "error" | "success" | "muted" } | null;
  copied: string | null;
  onEditRecord: (index: number) => void;
  onAddRecord: () => void;
  onCopy: (id: string, value: string) => void;
}) {
  const { scheme, colors } = useTheme();

  const details: { id: string; label: string; value: string; display: string }[] = [];
  if (pubkey)
    details.push({ id: "pk", label: "Public key", value: pubkey, display: short(pubkey) });
  if (numId)
    details.push({ id: "num", label: "Numeric ID", value: numId, display: short(numId) });
  if (alias) details.push({ id: "alias", label: "Alias", value: alias, display: alias });
  const published = lastPublished(seq);

  const profileHeader = (
    <FieldGroup.SectionHeader>
      <Row alignment="center">
        <Spacer />
        <Column alignment="center" spacing={8} style={{ paddingTop: 10, paddingBottom: 14 }}>
          <RNHostView matchContents style={{ width: 76, height: 76 }}>
            <Avatar handle={handle} size={76} />
          </RNHostView>
          <Text textStyle={{ fontSize: 22, fontWeight: "700", color: colors.text }}>{handle}</Text>
          <Row alignment="center" spacing={5}>
            <Icon
              name={sovereign ? "checkmark.seal.fill" : "circle.fill"}
              size={sovereign ? 14 : 9}
              color={pill.fg}
            />
            <Text textStyle={{ fontSize: 13, color: pill.fg }}>{pill.label}</Text>
          </Row>
        </Column>
        <Spacer />
      </Row>
    </FieldGroup.SectionHeader>
  );

  const hasRecords = records.length > 0;

  return (
    <Host style={{ flex: 1 }} colorScheme={scheme} matchContents={false}>
      <FieldGroup>
        {/* Optional status banner (published / key mismatch / etc.) */}
        {banner ? (
          <FieldGroup.Section>
            {profileHeader}
            <ListItem
              leading={
                <Icon
                  name={
                    banner.tone === "error"
                      ? "exclamationmark.triangle.fill"
                      : banner.tone === "success"
                        ? "checkmark.circle.fill"
                        : "info.circle"
                  }
                  size={20}
                  color={
                    banner.tone === "error"
                      ? colors.dangerText
                      : banner.tone === "success"
                        ? colors.statusGreenFg
                        : colors.textSecondary
                  }
                />
              }
            >
              <Text textStyle={{ color: colors.textSecondary }}>{banner.text}</Text>
            </ListItem>
          </FieldGroup.Section>
        ) : null}

        {/* Records */}
        <FieldGroup.Section
          title={banner ? "Records" : hasRecords ? undefined : undefined}
        >
          {!banner ? profileHeader : null}
          {hasRecords ? (
            records.map((r, i) => {
              const { def, known } = lookupRecord(r.type, r.key);
              return (
                <ListItem
                  key={`${r.key}:${i}`}
                  leading={<Icon name={sfFor(def.key)} size={22} color={def.color} />}
                  supportingText={r.value.join(", ")}
                  trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
                  onPress={() => onEditRecord(i)}
                >
                  <Text>{known ? def.label : r.key}</Text>
                </ListItem>
              );
            })
          ) : (
            <ListItem
              leading={<Icon name="plus.circle.fill" size={22} color={colors.accent} />}
              supportingText="A payment address, Nostr key, website…"
              trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
              onPress={onAddRecord}
            >
              <Text>Add your first record</Text>
            </ListItem>
          )}
        </FieldGroup.Section>

        {/* Details */}
        {details.length > 0 || published ? (
          <FieldGroup.Section title="Details">
            {details.map((d) => (
              <ListItem
                key={d.id}
                trailing={
                  <Text textStyle={{ color: colors.textSecondary }}>
                    {copied === `detail:${d.id}` ? "Copied ✓" : d.display}
                  </Text>
                }
                onPress={() => onCopy(`detail:${d.id}`, d.value)}
              >
                <Text>{d.label}</Text>
              </ListItem>
            ))}
            <ListItem
              trailing={
                <Text
                  textStyle={{ color: sovereign ? colors.statusGreenFg : colors.textSecondary }}
                >
                  {sovereign ? "Yes" : "Not yet"}
                </Text>
              }
            >
              <Text>Anchored on-chain</Text>
            </ListItem>
            {published ? (
              <ListItem
                trailing={
                  <Text textStyle={{ color: colors.textSecondary }}>{published}</Text>
                }
              >
                <Text>Last published</Text>
              </ListItem>
            ) : null}
          </FieldGroup.Section>
        ) : null}
      </FieldGroup>
    </Host>
  );
}
