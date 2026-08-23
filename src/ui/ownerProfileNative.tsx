import React from "react";
import { WEB_TOP_INSET } from "@/ui/webInset";
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
import { refreshable } from "@/ui/rowModifiers";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import type { EditableRecord } from "@/fabricResolver";
import type { CertState } from "@/certState";
import { lookupRecord } from "@/recordRegistry";
import { RecordGlyph } from "@/ui/handleProfileNative";
import { formatBtc } from "@/format";
import type { Pill } from "@/handleTile";

const CERT_LABEL: Record<CertState, string> = {
  provisional: "Provisional",
  confirming: "Confirming",
  final: "Final",
};

export type ListingSummary = { id: string; kind: "sale" | "transfer"; price?: number };

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
  unverified,
  reordering,
  onMoveUp,
  onMoveDown,
  banner,
  copied,
  certState,
  listings,
  onEditRecord,
  onAddRecord,
  onCopy,
  onOpenCert,
  onCancelListings,
  onRefresh,
}: {
  handle: string;
  records: EditableRecord[];
  pubkey: string;
  numId?: string | null;
  alias?: string | null;
  seq: number;
  pill: Pill;
  sovereign: boolean;
  unverified?: boolean;
  reordering?: boolean;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  banner?: { text: string; tone: "error" | "success" | "muted" } | null;
  copied: string | null;
  certState: CertState;
  listings: ListingSummary[];
  onEditRecord: (index: number) => void;
  onAddRecord: () => void;
  onCopy: (id: string, value: string) => void;
  onOpenCert: () => void;
  onCancelListings: () => void;
  onRefresh: () => Promise<void>;
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
        <Spacer flexible />
        <Column alignment="center" spacing={8} style={{ paddingTop: 10, paddingBottom: 14 }}>
          <RNHostView matchContents style={{ width: 76, height: 76 }}>
            <Avatar handle={handle} size={76} />
          </RNHostView>
          <Text textStyle={{ fontSize: 22, fontWeight: "700", color: colors.text }}>{handle}</Text>
          <Row alignment="center" spacing={5}>
            {/* Unverified overrides the seal — a handle we couldn't verify never
                shows a trust badge, even if its zone claims sovereignty. */}
            <Icon
              name={
                unverified
                  ? "exclamationmark.triangle.fill"
                  : sovereign
                    ? "checkmark.seal.fill"
                    : "circle.fill"
              }
              size={unverified || sovereign ? 14 : 9}
              color={unverified ? colors.dangerText : pill.fg}
            />
            <Text
              textStyle={{ fontSize: 13, color: unverified ? colors.dangerText : pill.fg }}
            >
              {unverified ? "Unverified" : pill.label}
            </Text>
          </Row>
        </Column>
        <Spacer flexible />
      </Row>
    </FieldGroup.SectionHeader>
  );

  const hasRecords = records.length > 0;

  return (
    <Host style={{ flex: 1, paddingTop: WEB_TOP_INSET }} colorScheme={scheme} matchContents={false}>
      <FieldGroup modifiers={[refreshable(onRefresh)]}>
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
              const first = i === 0;
              const last = i === records.length - 1;
              return (
                <ListItem
                  key={`${r.key}:${i}`}
                  leading={<RecordGlyph def={def} size={28} color={def.color} />}
                  supportingText={r.value.join(", ")}
                  trailing={
                    reordering ? (
                      // Up/down in filled-circle chevrons (row isn't tappable in
                      // this mode). Omit up on the first row and down on the last
                      // — no dead/disabled controls. Neutral color, never accent.
                      <Row spacing={14} alignment="center">
                        {!first ? (
                          <Icon
                            name="chevron.up.circle.fill"
                            size={26}
                            color={colors.textSecondary}
                            onPress={() => onMoveUp?.(i)}
                          />
                        ) : null}
                        {!last ? (
                          <Icon
                            name="chevron.down.circle.fill"
                            size={26}
                            color={colors.textSecondary}
                            onPress={() => onMoveDown?.(i)}
                          />
                        ) : null}
                      </Row>
                    ) : (
                      <Icon name="chevron.forward" size={14} color={colors.chevron} />
                    )
                  }
                  onPress={reordering ? undefined : () => onEditRecord(i)}
                >
                  <Text>{known ? def.label : r.key}</Text>
                </ListItem>
              );
            })
          ) : (
            <ListItem
              leading={<Icon name="plus.circle.fill" size={22} color={colors.textSecondary} />}
              trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
              onPress={onAddRecord}
            >
              <Text>Add your first record</Text>
            </ListItem>
          )}
          {!hasRecords ? (
            <FieldGroup.SectionFooter>
              <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                A payment address, Nostr key, website…
              </Text>
            </FieldGroup.SectionFooter>
          ) : null}
        </FieldGroup.Section>

        {/* Details — always present (carries the Certificate row). */}
        {(
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
            {/* One Certificate row (replaces the old "Anchored on-chain" row +
                collapsible cert group) — same vocabulary as the badge; opens the
                full certificate screen. */}
            <ListItem
              trailing={
                <Row alignment="center" spacing={6}>
                  <Text
                    textStyle={{
                      color:
                        certState === "final" ? colors.statusGreenFg : colors.textSecondary,
                    }}
                  >
                    {CERT_LABEL[certState]}
                  </Text>
                  <Icon name="chevron.forward" size={14} color={colors.chevron} />
                </Row>
              }
              onPress={onOpenCert}
            >
              <Text>Certificate</Text>
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
        )}

        {/* Signed listings — only when the user has live sale/transfer offers. */}
        {listings.length > 0 ? (
          <FieldGroup.Section title="Signed listings">
            {listings.map((o) => (
              <ListItem
                key={o.id}
                leading={
                  <Icon
                    name={o.kind === "sale" ? "tag.fill" : "arrow.right.circle.fill"}
                    size={20}
                    color={colors.textSecondary}
                  />
                }
                trailing={
                  <Text textStyle={{ color: colors.textSecondary }}>
                    {o.kind === "sale" && o.price ? formatBtc(o.price) : "Transfer"}
                  </Text>
                }
              >
                <Text>{o.kind === "sale" ? "For sale" : "Transfer offer"}</Text>
              </ListItem>
            ))}
            <ListItem
              leading={<Icon name="xmark.circle" size={22} color={colors.danger} />}
              trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
              onPress={onCancelListings}
            >
              <Text textStyle={{ color: colors.danger }}>Cancel listings</Text>
            </ListItem>
            <FieldGroup.SectionFooter>
              <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                Anyone with a signed listing can still take the handle until you
                cancel it (by spending the UTXO back to yourself).
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>
        ) : null}
      </FieldGroup>
    </Host>
  );
}
