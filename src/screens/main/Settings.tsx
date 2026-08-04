import React, { useMemo, useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { useStore } from "@/Store";
import { save } from "@/file";
import { Colors, ThemeMode, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { BottomNav } from "@/ui/BottomNav";
import { Message } from "@/ui/Message";
import {
  Anchor,
  AlertCircle,
  QrCode,
  Download,
  Eye,
  ChevronRight,
} from "@/ui/icons";
import {
  ensureSemiTrust,
  refreshSemiTrust,
  getTrustState,
  getTrustAnchor,
  getTrustedAnchor,
  getTipHeight,
} from "@/fabric";
import { formatAnchor, TrustAnchor, TrustState } from "@/trust";

const MODES: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

// How stale a trusted (Safety ID) anchor is relative to the current tip — the
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
  const navigation =
    useNavigation<NativeStackNavigationProp<HandlesStackParamList>>();
  const { xpub, handles } = useStore();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [error, setError] = useState<string | null>(null);

  const [anchor, setAnchor] = useState<TrustAnchor | null>(getTrustAnchor());
  const [trust, setTrust] = useState<TrustState>(getTrustState());
  const [trustedAnchor, setTrustedAnchor] = useState<TrustAnchor | null>(
    getTrustedAnchor(),
  );
  const [tip, setTip] = useState<number | null>(getTipHeight());
  const [refreshing, setRefreshing] = useState(false);

  // Re-read the trusted anchor whenever the tab regains focus, so a Safety ID
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
    setError(null);
    try {
      await save(`keystore_${Date.now()}.json`, { xpub, handles });
    } catch {
      setError("Failed to export keystore");
    }
  };

  const semiPinned = !!trust.semiTrusted;
  const safetyIdSet = !!trust.trusted;
  const trustedHeight = trustedAnchor?.height ?? null;
  const gap = trustedHeight != null && tip != null ? tip - trustedHeight : null;
  const staleness = stalenessText(trustedHeight, tip);
  const expiryColor =
    gap != null && gap > 0 ? colors.statusAmberFg : colors.statusGreenFg;

  return (
    <Layout padTop footer={<BottomNav active="trust" />}>
      <Text style={styles.screenTitle}>Trust</Text>

      {/* SEMI-TRUSTED — the default anchor we fetch from public relays. */}
      <Text style={styles.sectionLabel}>SEMI-TRUSTED</Text>

      <TouchableOpacity
        style={styles.anchorRow}
        onPress={onRefreshAnchor}
        activeOpacity={0.8}
      >
        <View style={[styles.iconTile, { backgroundColor: colors.tileOrangeBg }]}>
          <Anchor size={18} color={colors.text} />
        </View>
        <View style={styles.anchorMid}>
          <Text style={styles.rowTitle}>Trust anchor</Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {refreshing
              ? "Refreshing…"
              : anchor
                ? formatAnchor(anchor)
                : "Not set — tap to fetch"}
          </Text>
        </View>
        <View style={styles.anchorRight}>
          <View
            style={[
              styles.dot,
              { backgroundColor: semiPinned ? colors.statusGreenFg : colors.textMuted },
            ]}
          />
          <ChevronRight size={18} color={colors.iconDefault} />
        </View>
      </TouchableOpacity>
      <Text style={styles.note}>
        Fetched from a set of trusted relays. Scan from a local Veritas client for self-verification.
      </Text>

      <View style={styles.spacer} />

      {/* TRUSTED — the Safety ID scanned from a local Veritas client. */}
      <Text style={styles.sectionLabel}>TRUSTED</Text>

      {safetyIdSet ? (
        <>
          <View style={styles.anchorRow}>
            <View style={[styles.iconTile, { backgroundColor: colors.tileOrangeBg }]}>
              <Anchor size={18} color={colors.text} />
            </View>
            <View style={styles.anchorMid}>
              <Text style={styles.rowTitle}>Trust anchor</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {trustedAnchor ? formatAnchor(trustedAnchor) : "Pinned"}
              </Text>
              {staleness && (
                <Text style={[styles.rowSub, { color: expiryColor }]} numberOfLines={1}>
                  {staleness}
                </Text>
              )}
            </View>
            <View style={styles.anchorRight}>
              <View style={[styles.dot, { backgroundColor: colors.statusGreenFg }]} />
            </View>
          </View>
          <TouchableOpacity
            style={styles.rescanRow}
            onPress={() => navigation.navigate("VerifyAnchor")}
            activeOpacity={0.7}
          >
            <QrCode size={16} color={colors.accent} />
            <Text style={styles.rescanText}>Rescan Trust ID</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.safetyCard}>
          <View style={styles.safetyHead}>
            <AlertCircle size={18} color={colors.text} />
            <Text style={styles.safetyTitle}>Safety ID</Text>
          </View>
          <Text style={styles.safetyText}>
            No Safety ID set. Scan from a local Veritas client to fully verify
            sovereign handles against your own anchor.
          </Text>
          <TouchableOpacity
            style={styles.scanQr}
            onPress={() => navigation.navigate("VerifyAnchor")}
            activeOpacity={0.85}
          >
            <QrCode size={17} color={colors.accentText} />
            <Text style={styles.scanQrText}>Scan QR</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.spacer} />

      {/* KEYSTORE */}
      <Text style={styles.sectionLabel}>KEYSTORE</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardRow} onPress={backupKeystore} activeOpacity={0.8}>
          <View style={[styles.iconTile, { backgroundColor: colors.tileOrangeBg }]}>
            <Download size={18} color={colors.text} />
          </View>
          <Text style={styles.cardRowText}>Backup keystore</Text>
          <ChevronRight size={18} color={colors.iconDefault} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.cardRow}
          onPress={() => navigation.navigate("RevealSeed")}
          activeOpacity={0.8}
        >
          <View style={[styles.iconTile, { backgroundColor: colors.tileOrangeBg }]}>
            <Eye size={18} color={colors.text} />
          </View>
          <Text style={styles.cardRowText}>Reveal seed phrase</Text>
          <ChevronRight size={18} color={colors.iconDefault} />
        </TouchableOpacity>
      </View>

      {error && <Message message={error} type="error" />}

      <Text style={styles.note}>
        Your keystore holds your public key and handles — never your private key,
        which stays in secure storage.
      </Text>

      <View style={styles.spacer} />

      {/* APPEARANCE */}
      <Text style={styles.sectionLabel}>APPEARANCE</Text>
      <View style={styles.segment}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.segmentItem, mode === m.id && styles.segmentItemActive]}
            onPress={() => setMode(m.id)}
          >
            <Text
              style={[styles.segmentText, mode === m.id && styles.segmentTextActive]}
            >
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    screenTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: c.text,
      marginTop: 4,
      marginBottom: 24,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "500",
      letterSpacing: 0.6,
      color: c.textMuted,
      marginBottom: 10,
    },
    iconTile: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    rowTitle: {
      fontSize: 16,
      fontWeight: "500",
      color: c.text,
    },
    rowSub: {
      fontSize: 13,
      color: c.textSecondary,
      marginTop: 2,
    },
    anchorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 14,
      paddingLeft: 12,
      paddingRight: 14,
      paddingVertical: 12,
    },
    anchorMid: {
      flex: 1,
    },
    anchorRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 999,
    },
    safetyCard: {
      backgroundColor: c.statusAmberBg,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 14,
      padding: 14,
      gap: 10,
      marginTop: 10,
    },
    safetyHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    safetyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: c.text,
    },
    safetyText: {
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 18,
    },
    scanQr: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingVertical: 11,
    },
    scanQrText: {
      color: c.accentText,
      fontSize: 15,
      fontWeight: "500",
    },
    rescanRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      marginTop: 4,
    },
    rescanText: {
      color: c.accent,
      fontSize: 14,
      fontWeight: "500",
    },
    spacer: {
      height: 20,
    },
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 14,
      overflow: "hidden",
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingLeft: 12,
      paddingRight: 14,
      paddingVertical: 12,
    },
    cardRowText: {
      flex: 1,
      fontSize: 16,
      fontWeight: "500",
      color: c.text,
    },
    divider: {
      height: 1,
      backgroundColor: c.border,
    },
    note: {
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 19,
      marginTop: 12,
    },
    segment: {
      flexDirection: "row",
      backgroundColor: c.field,
      borderRadius: 12,
      padding: 4,
    },
    segmentItem: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 9,
      alignItems: "center",
    },
    segmentItemActive: {
      backgroundColor: c.accent,
    },
    segmentText: {
      color: c.textSecondary,
      fontSize: 14,
      fontWeight: "500",
    },
    segmentTextActive: {
      color: c.accentText,
    },
  });
