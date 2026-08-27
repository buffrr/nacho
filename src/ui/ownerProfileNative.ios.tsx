import React from "react";
import type { SFSymbol } from "sf-symbols-typescript";
import {
  Host,
  List,
  Section,
  HStack,
  VStack,
  Text,
  Image,
  Spacer,
  RNHostView,
} from "@expo/ui/swift-ui";
import {
  refreshable,
  onTapGesture,
  contentShape,
  foregroundStyle,
  font,
  shapes,
  listRowBackground,
  listRowSeparator,
  listRowInsets,
  listSectionSpacing,
  listSectionMargins,
} from "@expo/ui/swift-ui/modifiers";
import { useTheme, boundedHost } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { lookupRecord } from "@/recordRegistry";
import { RecordGlyph } from "@/ui/handleProfileNative";
import { formatBtc } from "@/format";
import {
  CERT_LABEL,
  lastPublished,
  short,
  type BannerTone,
  type OwnerProfileProps,
} from "@/ui/ownerProfileShared";

export type { ListingSummary } from "@/ui/ownerProfileShared";

// The OWNER's handle view — iOS build, on the native SwiftUI List so the records
// get real drag-to-reorder (onMove) and swipe-to-delete (onDelete) for free, no
// gesture-handler. Rows mirror the universal FieldGroup version (RecordGlyph +
// label over an accent-tinted value + chevron; tap to edit). Web/Android use
// ownerProfileNative.tsx. Shared types/helpers live in ownerProfileShared.ts.
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
  changeCount,
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
  onMoveRecord,
  onDeleteRecord,
}: OwnerProfileProps) {
  const { scheme, colors } = useTheme();

  const details: { id: string; label: string; value: string; display: string }[] = [];
  if (pubkey)
    details.push({ id: "pk", label: "Public key", value: pubkey, display: short(pubkey) });
  if (numId)
    details.push({ id: "num", label: "Numeric ID", value: numId, display: short(numId) });
  if (alias) details.push({ id: "alias", label: "Alias", value: alias, display: alias });
  const published = lastPublished(seq);

  const effBanner: { text: string; tone: BannerTone } | null =
    banner ?? (dirty ? { text: "Unpublished changes", tone: "pending" } : null);
  const bannerIcon = (t: BannerTone): SFSymbol =>
    t === "error"
      ? "exclamationmark.triangle.fill"
      : t === "success"
        ? "checkmark.circle.fill"
        : t === "pending"
          ? "circle.fill"
          : "info.circle";
  const bannerColor = (t: BannerTone) =>
    t === "error" ? colors.dangerText : t === "pending" ? colors.accent : colors.textSecondary;
  const bannerTextColor = (t: BannerTone) =>
    t === "error" ? colors.dangerText : colors.textSecondary;
  const count = changeCount ?? (changed ?? []).filter(Boolean).length;
  // Badge glyph: a numbered circle for 1–50 changes, a plain dot for a pure
  // reorder (count 0 but dirty — benign, not an error), an exclamation only for
  // the >50 overflow.
  const countSymbol: SFSymbol =
    count >= 1 && count <= 50
      ? (`${count}.circle.fill` as SFSymbol)
      : count === 0
        ? "circle.fill"
        : "exclamationmark.circle.fill";
  const countSize = count >= 1 ? 16 : 9;
  // Only reserve the dot gutter when at least one row is dotted — otherwise every
  // row gets a pointless empty indent.
  const anyChanged = (changed ?? []).some(Boolean);

  const chevron = <Image systemName="chevron.forward" size={14} color={colors.chevron} />;

  // Centered avatar/handle/status + a left-aligned status caption, as the records
  // section header (so the list hugs it, like the universal version).
  // Profile is a bare row (not the section header) so the gap to the caption /
  // records is ordinary, consistent row spacing — the SwiftUI section-header gap
  // was large and changed when the caption appeared.
  const profileHeader = (
    <HStack
      modifiers={[
        // Zero the row's top inset so the avatar hugs the native header (iMessage
        // style); keep a little breathing room below.
        listRowInsets({ top: 0, bottom: 8 }),
        listRowBackground("#00000000"),
        listRowSeparator("hidden"),
      ]}
    >
      <Spacer />
      <VStack alignment="center" spacing={8}>
        <RNHostView matchContents>
          <Avatar handle={handle} size={76} />
        </RNHostView>
        <Text modifiers={[font({ size: 22, weight: "bold" }), foregroundStyle(colors.text)]}>
          {handle}
        </Text>
        {unverified || sovereign ? (
          <HStack spacing={5}>
            <Image
              systemName={
                unverified ? "exclamationmark.triangle.fill" : "checkmark.seal.fill"
              }
              size={14}
              color={unverified ? colors.dangerText : pill.fg}
            />
            <Text
              modifiers={[
                font({ size: 13 }),
                foregroundStyle(unverified ? colors.dangerText : pill.fg),
              ]}
            >
              {unverified ? "Unverified" : pill.label}
            </Text>
          </HStack>
        ) : null}
      </VStack>
      <Spacer />
    </HStack>
  );

  // The status caption is group 2's section HEADER — it sits just above the
  // records card (bare, left-aligned) but belongs to the section, so the spacing
  // is native and consistent whether or not it's shown. Left-aligned via Spacer.
  const captionHeader = effBanner ? (
    <HStack spacing={5}>
      <Image
        systemName={effBanner.tone === "pending" ? countSymbol : bannerIcon(effBanner.tone)}
        size={effBanner.tone === "pending" ? countSize : 13}
        color={bannerColor(effBanner.tone)}
      />
      <Text modifiers={[font({ size: 13 }), foregroundStyle(bannerTextColor(effBanner.tone))]}>
        {effBanner.text}
      </Text>
      <Spacer />
    </HStack>
  ) : undefined;

  const hasRecords = records.length > 0;

  const recordsFooter = hasRecords ? undefined : (
    <Text modifiers={[font({ size: 12 }), foregroundStyle(colors.textSecondary)]}>
      A payment address, Nostr key, website…
    </Text>
  );

  const recordsBody = hasRecords ? (
    <List.ForEach
      onMove={(src, dest) => {
        const from = src[0];
        if (from == null) return;
        let to = dest;
        if (from < to) to -= 1;
        if (from !== to) onMoveRecord?.(from, to);
      }}
      onDelete={(indices) =>
        [...indices].sort((a, b) => b - a).forEach((i) => onDeleteRecord?.(i))
      }
    >
      {records.map((r, i) => {
        const { def, known } = lookupRecord(r.type, r.key);
        return (
          <HStack
            key={`${r.key}:${i}`}
            spacing={12}
            modifiers={[contentShape(shapes.rectangle()), onTapGesture(() => onEditRecord(i))]}
          >
            {/* Dot + icon in a tight leading group (Mail's unread pattern): the
                dot sits close to the icon it marks, not floating in the margin.
                Only reserved when some row is dotted, so an all-clean list has no
                empty indent. */}
            <HStack spacing={7}>
              {anyChanged ? (
                <Image
                  systemName="circle.fill"
                  size={7}
                  color={changed?.[i] ? colors.accent : "#00000000"}
                />
              ) : null}
              <RNHostView matchContents>
                <RecordGlyph def={def} size={28} color={def.color} />
              </RNHostView>
            </HStack>
            <VStack alignment="leading" spacing={2}>
              <Text modifiers={[foregroundStyle(colors.text)]}>
                {known ? def.label : r.key}
              </Text>
              <Text modifiers={[font({ size: 13 }), foregroundStyle(colors.textSecondary)]}>
                {r.value.join(", ")}
              </Text>
            </VStack>
            <Spacer />
            {chevron}
          </HStack>
        );
      })}
    </List.ForEach>
  ) : (
    <HStack
      spacing={12}
      modifiers={[contentShape(shapes.rectangle()), onTapGesture(onAddRecord)]}
    >
      <Image systemName="plus.circle.fill" size={22} color={colors.accent} />
      <Text modifiers={[foregroundStyle(colors.text)]}>Add your first record</Text>
      <Spacer />
      {chevron}
    </HStack>
  );

  return (
    <Host style={boundedHost} colorScheme={scheme} matchContents={false}>
      <List modifiers={[refreshable(onRefresh), listSectionSpacing(14)]}>
        {/* Records — native drag to reorder, swipe to delete, tap to edit. Group 1
            is the profile; group 2 is the records card with the status caption as
            its header. listSectionSpacing keeps every inter-group gap equal, and
            the first section's top margin matches it (header→group1 == the rest). */}
        <Section modifiers={[listSectionMargins({ edges: "top", length: 0 })]}>
          {profileHeader}
        </Section>
        {/* Group 2: records card, with the status caption as its header (above
            the card, belonging to the section). */}
        <Section header={captionHeader} footer={recordsFooter}>
          {recordsBody}
        </Section>

        {/* Details — public key / numeric id / alias (copy) + Certificate row. */}
        <Section title="Details">
          {details.map((d) => (
            <HStack
              key={d.id}
              modifiers={[contentShape(shapes.rectangle()), onTapGesture(() => onCopy(`detail:${d.id}`, d.value))]}
            >
              <Text modifiers={[foregroundStyle(colors.text)]}>{d.label}</Text>
              <Spacer />
              <Text modifiers={[foregroundStyle(colors.textSecondary)]}>
                {copied === `detail:${d.id}` ? "Copied ✓" : d.display}
              </Text>
            </HStack>
          ))}
          <HStack modifiers={[contentShape(shapes.rectangle()), onTapGesture(onOpenCert)]}>
            <Text modifiers={[foregroundStyle(colors.text)]}>Certificate</Text>
            <Spacer />
            <Text
              modifiers={[
                foregroundStyle(certState === "final" ? colors.statusGreenFg : colors.textSecondary),
              ]}
            >
              {CERT_LABEL[certState]}
            </Text>
            {chevron}
          </HStack>
          {published ? (
            <HStack>
              <Text modifiers={[foregroundStyle(colors.text)]}>Last published</Text>
              <Spacer />
              <Text modifiers={[foregroundStyle(colors.textSecondary)]}>{published}</Text>
            </HStack>
          ) : null}
        </Section>

        {/* Signed listings — only when there are live sale/transfer offers. */}
        {listings.length > 0 ? (
          <Section
            title="Signed listings"
            footer={
              <Text modifiers={[font({ size: 12 }), foregroundStyle(colors.textSecondary)]}>
                Anyone with a signed listing can still take the handle until you
                cancel it (by spending the UTXO back to yourself).
              </Text>
            }
          >
            {listings.map((o) => (
              <HStack key={o.id} spacing={12}>
                <Image
                  systemName={o.kind === "sale" ? "tag.fill" : "arrow.right.circle.fill"}
                  size={20}
                  color={colors.textSecondary}
                />
                <Text modifiers={[foregroundStyle(colors.text)]}>
                  {o.kind === "sale" ? "For sale" : "Transfer offer"}
                </Text>
                <Spacer />
                <Text modifiers={[foregroundStyle(colors.textSecondary)]}>
                  {o.kind === "sale" && o.price ? formatBtc(o.price) : "Transfer"}
                </Text>
              </HStack>
            ))}
            <HStack
              spacing={12}
              modifiers={[contentShape(shapes.rectangle()), onTapGesture(onCancelListings)]}
            >
              <Image systemName="xmark.circle" size={22} color={colors.danger} />
              <Text modifiers={[foregroundStyle(colors.danger)]}>Cancel listings</Text>
              <Spacer />
              {chevron}
            </HStack>
          </Section>
        ) : null}
      </List>
    </Host>
  );
}
