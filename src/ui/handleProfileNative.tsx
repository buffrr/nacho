import React, { useCallback, useMemo, useState } from "react";
import { Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
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
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { ResolvedHandle } from "@/fabricResolver";
import { lookupRecord, paymentUri } from "@/recordRegistry";

// The handle view rendered with @expo/ui's cross-platform native widgets
// (FieldGroup / ListItem / Icon). Renders real SwiftUI on iOS, Compose on
// Android, DOM on web — one codebase. The gradient avatar is our own RN
// component embedded via RNHostView (shows native + custom RN mixing in one
// view). Mirrors the RN ResolvedProfile (src/ui/handleProfile) feature-for-
// feature: profile, trust caption, Pay, records (tap = copy / open), details.

// SF Symbol per record key — native Icon needs a symbol name, not our RN glyph.
const SF: Record<string, SFSymbol> = {
  btc: "bitcoinsign.circle.fill",
  sp: "eye.slash.fill",
  ln: "bolt.fill",
  liquid: "drop.fill",
  ark: "cube.fill",
  nostr: "at",
  pgp: "key.fill",
  ssh: "terminal.fill",
  age: "lock.fill",
  did: "key.fill",
  website: "globe",
  note: "note.text",
  tor: "globe",
  hyper: "number",
  bep44: "number",
};
export const sfFor = (key: string): SFSymbol => SF[key] ?? "doc.text";

export function shorten(v: string): string {
  return v.length <= 22 ? v : `${v.slice(0, 9)}…${v.slice(-7)}`;
}

// Count of renderable records (addr/txt with non-empty values) — for the Recents
// snapshot / any caller that needs the number without rendering.
export function recordCountOf(result: ResolvedHandle): number {
  let n = 0;
  for (const rec of result.zone.records ?? []) {
    if (rec.type !== "addr" && rec.type !== "txt") continue;
    if (typeof rec.key !== "string") continue;
    if ((rec.value ?? []).map(String).filter(Boolean).length === 0) continue;
    n++;
  }
  return n;
}
function pubkeyFromZone(zone: ResolvedHandle["zone"]): string | null {
  const spk = zone.script_pubkey;
  if (typeof spk !== "string") return null;
  const m = /^5120([0-9a-fA-F]{64})$/.exec(spk);
  return m ? m[1] : spk;
}

export function ResolvedProfileNative({ result }: { result: ResolvedHandle }) {
  const { scheme, colors } = useTheme();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = useCallback((id: string, text: string) => {
    Clipboard.setStringAsync(text);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1400);
  }, []);
  const openUri = useCallback(
    (uri: string, fallback: string, id: string) =>
      Linking.openURL(uri).catch(() => copy(id, fallback)),
    [copy],
  );

  const rows = useMemo(() => {
    const out: {
      id: string;
      label: string;
      sf: SFSymbol;
      color: string;
      primary: string;
      known: boolean;
      canOpen: boolean;
    }[] = [];
    let i = 0;
    for (const rec of result.zone.records ?? []) {
      if (rec.type !== "addr" && rec.type !== "txt") continue;
      if (typeof rec.key !== "string") continue;
      const values = (rec.value ?? []).map(String).filter(Boolean);
      if (!values.length) continue;
      const { def, known } = lookupRecord(rec.type, rec.key);
      out.push({
        id: `${rec.key}:${i++}`,
        label: def.label,
        sf: sfFor(def.key),
        color: def.color,
        primary: values[0],
        known,
        canOpen: def.action === "open" && known,
      });
    }
    return out;
  }, [result]);

  const payUri = useMemo(
    () =>
      paymentUri(
        // reuse the registry via a light re-map
        (result.zone.records ?? [])
          .filter((r) => r.type === "addr" && typeof r.key === "string")
          .map((r) => ({
            rtype: "addr",
            key: r.key as string,
            value: (r.value ?? []).map(String)[0] ?? "",
          })),
      ),
    [result],
  );
  const payCopy = rows.find((r) => r.color === "#E08A2E")?.primary ?? "";

  const details = useMemo(() => {
    const d: { label: string; value: string; display: string }[] = [];
    const pk = pubkeyFromZone(result.zone);
    if (pk)
      d.push({
        label: "Public key",
        value: pk,
        display: pk.length > 20 ? `${pk.slice(0, 8)}…${pk.slice(-8)}` : pk,
      });
    const numId = typeof result.zone.num_id === "string" ? result.zone.num_id : undefined;
    if (numId)
      d.push({
        label: "Numeric ID",
        value: numId,
        display: numId.length > 18 ? `${numId.slice(0, 8)}…${numId.slice(-6)}` : numId,
      });
    const alias = typeof result.zone.alias === "string" ? result.zone.alias : undefined;
    if (alias) d.push({ label: "Alias", value: alias, display: alias });
    return d;
  }, [result]);

  const sovereign = result.zone.sovereignty === "sovereign";
  const trustText =
    result.badge === "orange"
      ? "Verified with your trust anchor"
      : result.badge === "unverified"
        ? "Not verified against any anchor"
        : "Verified with Nacho’s default anchor";

  // The profile (avatar + name + status + trust) lives in a SECTION HEADER, so
  // it sits on the plain grouped background (centered, full-width) like the
  // iMessage/Contacts header — not inside a card. It's attached to whichever
  // section renders first.
  const profileHeader = (
    <FieldGroup.SectionHeader>
      {/* Spacers force the column to the horizontal center — a section header
          left-aligns and the column shrink-wraps, so alignment alone won't. */}
      <Row alignment="center">
        <Spacer />
        <Column alignment="center" spacing={8} style={{ paddingTop: 10, paddingBottom: 14 }}>
          <RNHostView matchContents style={{ width: 76, height: 76 }}>
            <Avatar handle={result.handle} size={76} />
          </RNHostView>
          <Text textStyle={{ fontSize: 22, fontWeight: "700", color: colors.text }}>
            {result.handle}
          </Text>
          <Row alignment="center" spacing={5}>
            <Icon
              name={sovereign ? "checkmark.seal.fill" : "clock"}
              size={14}
              color={sovereign ? colors.statusGreenFg : colors.textMuted}
            />
            <Text
              textStyle={{
                fontSize: 13,
                color: sovereign ? colors.statusGreenFg : colors.textMuted,
              }}
            >
              {sovereign ? "Sovereign" : "Registered"}
            </Text>
          </Row>
          <Row alignment="center" spacing={6}>
            <Icon name="checkmark.shield" size={12} color={colors.textSecondary} />
            <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
              {trustText}
            </Text>
          </Row>
        </Column>
        <Spacer />
      </Row>
    </FieldGroup.SectionHeader>
  );

  // Which section renders first (gets the profile header).
  const first = payUri ? "pay" : rows.length > 0 ? "records" : "details";

  return (
    <Host style={{ flex: 1 }} colorScheme={scheme} matchContents={false}>
      <FieldGroup>
        {payUri ? (
          <FieldGroup.Section>
            {first === "pay" ? profileHeader : null}
            <ListItem
              leading={<Icon name="bitcoinsign.circle.fill" size={24} color="#E08A2E" />}
              supportingText={
                copied === "pay" ? "Copied — no wallet app found" : "Opens your wallet"
              }
              trailing={<Icon name="arrow.up.right" size={16} color={colors.chevron} />}
              onPress={() => openUri(payUri, payCopy || payUri, "pay")}
            >
              <Text>Pay with Bitcoin</Text>
            </ListItem>
          </FieldGroup.Section>
        ) : null}

        {rows.length > 0 ? (
          <FieldGroup.Section title={first === "records" ? undefined : "Records"}>
            {first === "records" ? profileHeader : null}
            {rows.map((row) => (
              <ListItem
                key={row.id}
                leading={<Icon name={row.sf} size={22} color={row.color} />}
                trailing={
                  <Text textStyle={{ color: colors.textSecondary }}>
                    {copied === row.id ? "Copied ✓" : shorten(row.primary)}
                  </Text>
                }
                onPress={() =>
                  row.canOpen
                    ? openUri(row.primary, row.primary, row.id)
                    : copy(row.id, row.primary)
                }
              >
                <Text>{row.label}</Text>
              </ListItem>
            ))}
          </FieldGroup.Section>
        ) : null}

        {details.length > 0 ? (
          <FieldGroup.Section title={first === "details" ? undefined : "Details"}>
            {first === "details" ? profileHeader : null}
            {details.map((d) => (
              <ListItem
                key={d.label}
                trailing={
                  <Text textStyle={{ color: colors.textSecondary }}>
                    {copied === `detail:${d.label}` ? "Copied ✓" : d.display}
                  </Text>
                }
                onPress={() => copy(`detail:${d.label}`, d.value)}
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
          </FieldGroup.Section>
        ) : null}
      </FieldGroup>
    </Host>
  );
}
