import React, { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Host, FieldGroup, ListItem, Icon, Text } from "@expo/ui";
import { saveBinary } from "@/file";
import { exportDbBytes } from "@/db";
import { useTheme } from "@/theme";
import {
  ensureSemiTrust,
  refreshSemiTrust,
  getTrustState,
  getTrustAnchor,
  getTrustedAnchor,
  getTipHeight,
} from "@/fabric";
import { formatAnchor, TrustAnchor, TrustState } from "@/trust";

// How stale a trusted (Trust ID) anchor is relative to the current tip — the
// semi-trusted anchor tracks the tip, so the block gap tells you how far the
// trusted snapshot has fallen behind. ~10 min/block for the rough time.
function stalenessText(trustedHeight: number | null, tip: number | null): string | null {
  if (trustedHeight == null || tip == null) return null;
  const gap = tip - trustedHeight;
  if (gap <= 0) return "Current with tip";
  const mins = gap * 10;
  const rough =
    mins < 60
      ? `${mins}m`
      : mins < 1440
        ? `${Math.round(mins / 60)}h`
        : `${Math.round(mins / 1440)}d`;
  return `${gap.toLocaleString()} blocks behind tip · ~${rough} old`;
}

export default function Settings() {
  const router = useRouter();
  const { scheme, colors } = useTheme();

  const [anchor, setAnchor] = useState<TrustAnchor | null>(getTrustAnchor());
  const [trust, setTrust] = useState<TrustState>(getTrustState());
  const [trustedAnchor, setTrustedAnchor] = useState<TrustAnchor | null>(
    getTrustedAnchor(),
  );
  const [tip, setTip] = useState<number | null>(getTipHeight());
  const [refreshing, setRefreshing] = useState(false);

  // Re-read the trusted anchor whenever the tab regains focus, so a Trust ID
  // just scanned in VerifyAnchor shows up on return.
  const syncTrust = useCallback(() => {
    setTrust(getTrustState());
    setTrustedAnchor(getTrustedAnchor());
    setTip(getTipHeight());
  }, []);

  useFocusEffect(syncTrust);

  useEffect(() => {
    let active = true;
    ensureSemiTrust().then((a) => {
      if (!active) return;
      setAnchor(a);
      syncTrust();
    });
    return () => {
      active = false;
    };
  }, [syncTrust]);

  const onRefreshAnchor = async () => {
    setRefreshing(true);
    try {
      const a = await refreshSemiTrust();
      setAnchor(a);
      syncTrust();
    } finally {
      setRefreshing(false);
    }
  };

  const backupKeystore = async () => {
    try {
      const bytes = await exportDbBytes();
      await saveBinary(
        `nacho-backup-${Date.now()}.sqlite`,
        bytes,
        "application/x-sqlite3",
      );
    } catch {
      Alert.alert("Backup failed", "Couldn't export the backup file.");
    }
  };

  const safetyIdSet = !!trust.trusted;
  const trustedHeight = trustedAnchor?.height ?? null;
  const gap = trustedHeight != null && tip != null ? tip - trustedHeight : null;
  const staleness = stalenessText(trustedHeight, tip);
  const expiryColor =
    gap != null && gap > 0 ? colors.statusAmberFg : colors.statusGreenFg;

  const anchorLine = refreshing
    ? "Refreshing…"
    : anchor
      ? formatAnchor(anchor)
      : "Not set — tap to fetch";

  return (
    <Host style={{ flex: 1 }} colorScheme={scheme}>
      <FieldGroup>
        {/* YOUR TRUST ID — strongest guarantee; first on the page. */}
        <FieldGroup.Section title="Your Trust ID">
          {safetyIdSet ? (
            <>
              <ListItem
                leading={
                  <Icon name="checkmark.shield.fill" size={22} color={colors.statusGreenFg} />
                }
                supportingText={
                  trustedAnchor ? formatAnchor(trustedAnchor) : "Pinned"
                }
                trailing={
                  <Icon name="checkmark.circle.fill" size={18} color={colors.statusGreenFg} />
                }
              >
                <Text>Trust ID</Text>
              </ListItem>
              {staleness ? (
                <ListItem
                  trailing={
                    <Text textStyle={{ fontSize: 13, color: expiryColor }}>
                      {staleness}
                    </Text>
                  }
                >
                  <Text textStyle={{ color: colors.textSecondary }}>Freshness</Text>
                </ListItem>
              ) : null}
              <ListItem
                leading={<Icon name="qrcode.viewfinder" size={22} color={colors.accent} />}
                trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
                onPress={() => router.push("/(main)/verify-anchor")}
              >
                <Text textStyle={{ color: colors.accent }}>Rescan Trust ID</Text>
              </ListItem>
            </>
          ) : (
            <ListItem
              leading={<Icon name="qrcode.viewfinder" size={22} color={colors.accent} />}
              supportingText="Scan from a local Veritas client to fully verify sovereign handles against your own anchor."
              trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
              onPress={() => router.push("/(main)/verify-anchor")}
            >
              <Text>Set a Trust ID</Text>
            </ListItem>
          )}
        </FieldGroup.Section>

        {/* TRUST FALLBACK SOURCES — the default anchor from public relays. */}
        <FieldGroup.Section title="Trust fallback sources">
          <ListItem
            leading={<Icon name="shield.lefthalf.filled" size={22} color={colors.textSecondary} />}
            supportingText={anchorLine}
            trailing={<Icon name="arrow.clockwise" size={16} color={colors.chevron} />}
            onPress={onRefreshAnchor}
          >
            <Text>Default anchor</Text>
          </ListItem>
          <FieldGroup.SectionFooter>
            <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
              Fetched from public relays and refreshed only when you tap it. Scan
              your own Trust ID above for self-verification.
            </Text>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>

        {/* KEYSTORE */}
        <FieldGroup.Section title="Keystore">
          <ListItem
            leading={<Icon name="square.and.arrow.down" size={22} color={colors.textSecondary} />}
            trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
            onPress={backupKeystore}
          >
            <Text>Backup keystore</Text>
          </ListItem>
          <ListItem
            leading={<Icon name="eye" size={22} color={colors.textSecondary} />}
            trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
            onPress={() => router.push("/(main)/reveal-seed")}
          >
            <Text>Reveal seed phrase</Text>
          </ListItem>
          <FieldGroup.SectionFooter>
            <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
              Your keystore holds your public key and handles — never your private
              key, which stays in secure storage.
            </Text>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
