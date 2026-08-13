import React, { useState, useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
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
import { HandleData, useStore } from "@/Store";
import { useTheme } from "@/theme";
import { scriptForHandle } from "@/keys";
import { handleTileInfo, TileInfo } from "@/handleTile";
import { recordsCounts } from "@/db";
import { refreshSemiTrust, resolveHandle } from "@/fabric";
import { Avatar } from "@/ui/Avatar";
import { NativeEmpty } from "@/ui/nativeEmpty";
import type { SFSymbol } from "sf-symbols-typescript";

// The FlatList is the screen's PRIMARY scroll view (no Layout wrapper) with
// contentInsetAdjustmentBehavior="automatic", so the native large title
// (handles/_layout) can track scroll offset — left-aligned at rest, collapsing
// into the centred nav-bar title as the list scrolls (Messages/Settings style).
export default function ListHandles() {
  const router = useRouter();
  const { handles, xpub, setHandleResolution } = useStore();
  const { colors, scheme } = useTheme();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [, setRefreshing] = useState(false);

  const handlesList = Object.entries(handles || {});

  // Pull-to-refresh: EXPLICITLY refresh the semi-trusted anchor (the only place we
  // re-fetch it — never automatically), then re-resolve each handle so the tiles'
  // status is current. User-initiated, so the extra network is fine.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshSemiTrust();
      await Promise.all(
        Object.entries(handles || {}).map(async ([name, data]) => {
          try {
            const resolved = await resolveHandle(name);
            if (resolved) {
              await setHandleResolution(name, {
                found: true,
                sovereignty: resolved.zone.sovereignty ?? "unknown",
                scriptPubkey: resolved.zone.script_pubkey,
                updatedAt: Date.now(),
              });
            } else if (!data.resolution?.found) {
              // Don't downgrade a handle we've already seen resolve (propagation lag).
              await setHandleResolution(name, { found: false, updatedAt: Date.now() });
            }
          } catch {
            // skip this handle; others still refresh
          }
        }),
      );
      setCounts(await recordsCounts());
    } finally {
      setRefreshing(false);
    }
  }, [handles, setHandleResolution]);

  // Refresh the cached record counts each time the list gains focus (e.g. after
  // publishing records on a handle detail screen). Local DB only — no network.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      recordsCounts().then((c) => {
        if (active) setCounts(c);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const infoFor = (name: string, handleData: HandleData) => {
    const ourScript = xpub ? scriptForHandle(xpub, handleData) : null;
    const resolution = handleData.resolution;
    const keyMismatch = !!(
      resolution?.found &&
      resolution.scriptPubkey &&
      ourScript &&
      resolution.scriptPubkey !== ourScript
    );
    return handleTileInfo({
      resolution,
      keyMismatch,
      hasCert: !!handleData.certRef || !!handleData.cert,
      isImported: handleData.source === "imported",
      recordCount: counts[name] ?? 0,
    });
  };

  if (handlesList.length === 0) {
    return (
      <NativeEmpty
        sf="at"
        title="No handles yet"
        message="Register a new handle or buy one — it lives in this keystore, yours to control."
        primary={{
          label: "Register a handle",
          onPress: () => router.push("/(main)/register-hub"),
        }}
        secondary={{ label: "Shop handles", onPress: () => router.push("/(main)/shop") }}
      />
    );
  }

  // Inline status glyph (SF Symbol) shown beside the subtitle.
  const glyphFor = (info: TileInfo): { sf: SFSymbol; color: string } | null => {
    switch (info.status) {
      case "sovereign":
        return { sf: "checkmark.seal.fill", color: colors.statusGreenFg };
      case "attention":
        return { sf: "exclamationmark.triangle.fill", color: colors.statusAmberFg };
      default:
        return null;
    }
  };

  // Paint each row the theme background so the list reads as a plain black list
  // (not SwiftUI's default grouped grey). List-level scrollContentBackground
  // isn't exposed on the universal List, but ListItem forwards row modifiers.
  // The first row also hides its TOP separator — a plain-style List draws a
  // hairline above the first cell, which reads as a stray divider under the header.
  const rowBg = [listRowBackground(colors.background)];
  const rowMods = (i: number) =>
    i === 0 ? [...rowBg, listRowSeparator("hidden", "top")] : rowBg;

  return (
    <Host style={{ flex: 1 }} colorScheme={scheme}>
      <PlainList onRefresh={onRefresh}>
        {handlesList.map(([name, handleData], i) => {
          const info = infoFor(name, handleData);
          const glyph = glyphFor(info);
          return (
            <ListItem
              key={name}
              modifiers={rowMods(i)}
              leading={
                <RNHostView matchContents style={{ width: 50, height: 50 }}>
                  <Avatar handle={name} size={50} />
                </RNHostView>
              }
              supportingText={
                <Row alignment="center" spacing={5}>
                  {glyph ? <Icon name={glyph.sf} size={13} color={glyph.color} /> : null}
                  <UIText
                    textStyle={{
                      fontSize: 14,
                      color: info.attention ? colors.statusAmberFg : colors.textMuted,
                    }}
                  >
                    {info.subtitle}
                  </UIText>
                </Row>
              }
              trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
              onPress={() =>
                router.push({ pathname: "/(main)/show-handle", params: { handle: name } })
              }
            >
              <UIText textStyle={{ fontSize: 17, fontWeight: "600" }}>{name}</UIText>
            </ListItem>
          );
        })}

        {/* Shop entry at the end of the list. Hide its bottom separator so the
            list doesn't trail off with a stray divider. */}
        <ListItem
          modifiers={[...rowBg, listRowSeparator("hidden", "bottom")]}
          leading={<Icon name="bag" size={22} color={colors.textSecondary} />}
          onPress={() => router.push("/(main)/shop")}
        >
          <UIText textStyle={{ color: colors.textSecondary }}>Shop handles</UIText>
        </ListItem>
      </PlainList>
    </Host>
  );
}
