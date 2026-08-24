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
import type { SFSymbol } from "sf-symbols-typescript";
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
  dirty,
  changed,
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
  // Unpublished-changes affordances: `dirty` drives the section caption, and
  // `changed[i]` flags a leading dot on the i-th record row (new/edited).
  dirty?: boolean;
  changed?: boolean[];
  reordering?: boolean;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  banner?: { text: string; tone: "error" | "success" | "muted" | "pending" } | null;
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

  // Surface unpublished edits (and other statuses) at the TOP — a Form section
  // can't be sticky and a footer scrolls off on long lists. A real banner
  // (error/success) takes priority over the pending-edits hint.
  const effBanner: {
    text: string;
    tone: "error" | "success" | "muted" | "pending";
  } | null =
    banner ?? (dirty ? { text: "Unpublished changes", tone: "pending" } : null);
  const bannerIcon = (t: NonNullable<typeof effBanner>["tone"]): SFSymbol =>
    t === "error"
      ? "exclamationmark.triangle.fill"
      : t === "success"
        ? "checkmark.circle.fill"
        : t === "pending"
          ? "circle.fill"
          : "info.circle";
  const bannerColor = (t: NonNullable<typeof effBanner>["tone"]) =>
    t === "error"
      ? colors.dangerText
      : t === "pending"
        ? colors.accent
        : colors.textSecondary;
  // The dot/icon carries the colour; keep the text neutral (a coloured sentence
  // would read as a link/action).
  const bannerTextColor = (t: NonNullable<typeof effBanner>["tone"]) =>
    t === "error" ? colors.dangerText : colors.textSecondary;
  // Count of changed rows, shown inside the pending badge as an SF number-circle
  // ("5.circle.fill"). Those symbols exist for 0–50; fall back above that.
  const changeCount = (changed ?? []).filter(Boolean).length;
  const countSymbol: SFSymbol =
    changeCount >= 1 && changeCount <= 50
      ? (`${changeCount}.circle.fill` as SFSymbol)
      : "exclamationmark.circle.fill";

  const profileHeader = (
    <FieldGroup.SectionHeader>
      <Column spacing={12}>
        <Row alignment="center">
          <Spacer flexible />
          <Column alignment="center" spacing={8} style={{ paddingTop: 10, paddingBottom: 14 }}>
            <RNHostView matchContents style={{ width: 76, height: 76 }}>
              <Avatar handle={handle} size={76} />
            </RNHostView>
            <Text textStyle={{ fontSize: 22, fontWeight: "700", color: colors.text }}>{handle}</Text>
            {/* Only the noteworthy trust states get a status line: the Sovereign
                seal and the Unverified warning. A plain "Registered" is redundant
                on your own handle — the name alone says it's yours. */}
            {unverified || sovereign ? (
              <Row alignment="center" spacing={5}>
                <Icon
                  name={
                    unverified ? "exclamationmark.triangle.fill" : "checkmark.seal.fill"
                  }
                  size={14}
                  color={unverified ? colors.dangerText : pill.fg}
                />
                <Text
                  textStyle={{ fontSize: 13, color: unverified ? colors.dangerText : pill.fg }}
                >
                  {unverified ? "Unverified" : pill.label}
                </Text>
              </Row>
            ) : null}
          </Column>
          <Spacer flexible />
        </Row>
        {/* Status caption — left-aligned at the bottom of the header, right above
            the record rows (bare, no card). */}
        {effBanner ? (
          // Trailing flexible Spacer forces the caption to hug the left edge
          // (Column alignment alone didn't left-align it reliably).
          <Row alignment="center" spacing={5}>
            <Icon
              name={
                effBanner.tone === "pending" ? countSymbol : bannerIcon(effBanner.tone)
              }
              size={effBanner.tone === "pending" ? 16 : 13}
              color={bannerColor(effBanner.tone)}
            />
            <Text textStyle={{ fontSize: 13, color: bannerTextColor(effBanner.tone) }}>
              {effBanner.text}
            </Text>
            <Spacer flexible />
          </Row>
        ) : null}
      </Column>
    </FieldGroup.SectionHeader>
  );

  const hasRecords = records.length > 0;

  return (
    <Host style={{ flex: 1, paddingTop: WEB_TOP_INSET }} colorScheme={scheme} matchContents={false}>
      <FieldGroup modifiers={[refreshable(onRefresh)]}>
        {/* Profile header + records in ONE section so the list sits close under
            the handle (a separate section adds a big inter-group gap). The status
            caption lives at the bottom-left of the header, just above the rows. */}
        <FieldGroup.Section title={undefined}>
          {profileHeader}
          {hasRecords ? (
            records.map((r, i) => {
              const { def, known } = lookupRecord(r.type, r.key);
              const first = i === 0;
              const last = i === records.length - 1;
              return (
                <ListItem
                  key={`${r.key}:${i}`}
                  leading={<RecordGlyph def={def} size={28} color={def.color} />}
                  supportingText={
                    // Changed-since-publish rows tint their value in the accent
                    // (matching the Publish CTA) instead of carrying a dot.
                    <Text
                      textStyle={{
                        color: changed?.[i] ? colors.accent : colors.textSecondary,
                      }}
                    >
                      {r.value.join(", ")}
                    </Text>
                  }
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
              leading={<Icon name="plus.circle.fill" size={22} color={colors.accent} />}
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
