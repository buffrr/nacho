import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { Avatar } from "@/ui/Avatar";
import { Bitcoin, ExternalLink, ShieldCheck } from "@/ui/icons";
import { RecordGlyph } from "@/ui/handleProfileNative";
import { lookupRecord } from "@/recordRegistry";
import { Colors, useTheme } from "@/theme";

// A fixed sample profile shown as a self-contained figure (onboarding_v2 §02 /
// the "no handles yet" empty state / App Store shots). Wrapped in one squircle
// card so it clearly reads as an example, not the user's own screen — while its
// rows reuse the real record icons (RecordGlyph) and Avatar so it still looks
// native. "alice@bitcoin" with a socials-plus-pubkey mix: legible to a normie,
// unmistakable to a Bitcoiner.
const SAMPLE_HANDLE = "alice@bitcoin";
const SAMPLE_RECORDS: { type: "addr" | "txt"; key: string; value: string }[] = [
  { type: "addr", key: "nostr", value: "npub1sn0w…" },
  { type: "txt", key: "instagram", value: "@alice" },
  { type: "txt", key: "website", value: "alice.com" },
];

export function SampleProfileCard() {
  const { colors, scheme } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors, scheme), [colors, scheme]);

  return (
    <View style={styles.card}>
      {/* Warm orange wash for the card so the profile details read on a tinted
          figure, not a flat grey slab. */}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="cardWarm" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FF7B00" stopOpacity={0.09} />
            <Stop offset="1" stopColor="#FF7B00" stopOpacity={0.015} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#cardWarm)" />
      </Svg>

      {/* Header — avatar, handle, and the one claim no link page can make: the
          phone did the verifying. Plain green line, no filled bar or badge —
          one green accent, not three. */}
      <View style={styles.header}>
        <Avatar handle={SAMPLE_HANDLE} size={54} />
        <Text style={styles.handle}>{SAMPLE_HANDLE}</Text>
        <View style={styles.verifiedRow}>
          <ShieldCheck size={14} color={colors.statusGreenFg} />
          <Text style={styles.verifiedText}>
            Verified on-device with your trust anchor
          </Text>
        </View>
      </View>

      {/* Pay with Bitcoin — the only filled affordance; proof this isn't a link
          page (the real bitcoin: URI handoff). */}
      <View style={styles.payRow}>
        <View style={styles.bitcoinCircle}>
          <Bitcoin size={17} color={colors.accentText} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.payTitle}>Pay with Bitcoin</Text>
          <Text style={styles.paySub}>Opens your wallet</Text>
        </View>
        <ExternalLink size={16} color={colors.chevron} />
      </View>

      <Text style={styles.recordsLabel}>Records</Text>
      <View>
        {SAMPLE_RECORDS.map((r, i) => {
          const { def } = lookupRecord(r.type, r.key);
          return (
            <View key={`${r.key}:${i}`} style={styles.recordRow}>
              <RecordGlyph def={def} size={28} color={def.color} />
              <Text style={styles.recordLabel}>{def.label}</Text>
              <Text style={styles.recordValue} numberOfLines={1}>
                {r.value}
              </Text>
              {i < SAMPLE_RECORDS.length - 1 ? <View style={styles.sep} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (c: Colors, scheme: "light" | "dark") =>
  StyleSheet.create({
    card: {
      borderRadius: 22,
      borderCurve: "continuous",
      overflow: "hidden",
      paddingBottom: 14,
    },
    header: {
      alignItems: "center",
      paddingTop: 18,
      paddingBottom: 12,
    },
    handle: {
      fontSize: 19,
      fontWeight: "700",
      color: c.text,
      marginTop: 9,
    },
    verifiedRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      marginTop: 8,
      paddingHorizontal: 20,
    },
    verifiedText: { fontSize: 12.5, color: c.statusGreenFg, textAlign: "center" },
    payRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      marginHorizontal: 12,
      marginTop: 13,
      padding: 12,
      borderRadius: 14,
      borderCurve: "continuous",
      // A white overlay lifts the row on the dark card; on the light card it's
      // invisible (white-on-warm-white) — use a subtle dark tint there instead so
      // the CTA reads as a distinct filled affordance in both themes.
      backgroundColor:
        scheme === "light" ? "rgba(0,0,0,0.045)" : "rgba(255,255,255,0.06)",
    },
    bitcoinCircle: {
      width: 30,
      height: 30,
      borderRadius: 999,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    payTitle: { fontSize: 14.5, fontWeight: "600", color: c.text },
    paySub: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    recordsLabel: {
      fontSize: 12,
      color: c.textMuted,
      marginTop: 16,
      marginBottom: 6,
      marginLeft: 16,
    },
    recordRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginHorizontal: 12,
      paddingVertical: 9,
      paddingHorizontal: 4,
    },
    recordLabel: { flex: 1, fontSize: 14, color: c.text },
    recordValue: { fontSize: 13, color: c.textMuted, maxWidth: 130 },
    sep: {
      position: "absolute",
      left: 44,
      right: 4,
      bottom: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
    },
  });
