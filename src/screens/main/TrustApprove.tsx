import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Colors, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";
import { AlertCircle, ShieldCheck } from "@/ui/icons";
import { authenticate } from "@/auth";
import { trustFromInput } from "@/fabric";

// Approval gate for a Trust ID scanned from the Scan tab. Pinning a Trust ID
// changes how EVERY handle is verified — a malicious one can make forged handles
// look verified — so a scanned trust QR is never pinned silently: it lands here
// and requires an explicit, device-authenticated approval.
function idFromPayload(payload: string): string | null {
  const m = /[?&]id=([0-9a-fA-F]{8,})/.exec(payload);
  return m ? m[1] : null;
}

// Group a long hex id into 4-char blocks so it can be eyeballed.
function chunk(v: string): string {
  return v.replace(/(.{4})(?=.)/g, "$1 ");
}

export default function TrustApprove() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { payload } = useLocalSearchParams<{ payload: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const id = payload ? idFromPayload(payload) : null;

  const approve = async () => {
    if (!payload || busy) return;
    setError(null);
    // Device auth — pinning a trust anchor is a protected action.
    if (!(await authenticate("Approve this Trust ID"))) return;
    setBusy(true);
    try {
      await trustFromInput(payload);
      // Replace with the Trust page so the newly-pinned ID is shown, and Back
      // returns to the tab the scan came from (not this approval screen).
      router.replace("/(main)/trust");
    } catch {
      setError(
        "That isn't a valid Trust ID. Scan the QR from a Veritas client running locally on your machine.",
      );
      setBusy(false);
    }
  };

  return (
    <Layout
      underHeader
      footer={
        <View style={styles.footer}>
          <Button
            text={busy ? "Pinning…" : "Approve Trust ID"}
            onPress={approve}
            type="main"
            disabled={busy || !payload}
          />
          <Button text="Cancel" onPress={() => router.back()} type="secondary" />
        </View>
      }
    >
      <Stack.Screen options={{ title: "Trust ID" }} />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <ShieldCheck size={30} color={colors.accent} />
        </View>
        <Text style={styles.heroTitle}>Pin this Trust ID?</Text>
      </View>

      {id && (
        <>
          <Text style={styles.groupLabel}>TRUST ID</Text>
          <View style={styles.card}>
            <Text style={styles.idText} selectable>
              {chunk(id)}
            </Text>
          </View>
        </>
      )}

      <View style={styles.warn}>
        <AlertCircle size={18} color={colors.statusAmberFg} />
        <Text style={styles.warnText}>
          Pinning a Trust ID changes how every handle is verified. Approve only if
          you scanned this from your own local Veritas client — a Trust ID from
          anyone else can make forged handles look verified.
        </Text>
      </View>

      {error && (
        <View style={{ marginTop: 16 }}>
          <Message message={error} type="error" />
        </View>
      )}
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    hero: { alignItems: "center", paddingTop: 12, paddingBottom: 20 },
    heroIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      borderCurve: "continuous",
      backgroundColor: c.accent + "1F",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    heroTitle: { fontSize: 20, fontWeight: "700", color: c.text },
    groupLabel: {
      fontFamily: "monospace",
      fontSize: 10.5,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: c.textMuted,
      marginBottom: 7,
      marginLeft: 4,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderCurve: "continuous",
      padding: 16,
      marginBottom: 22,
    },
    idText: {
      fontFamily: "monospace",
      fontSize: 14,
      color: c.text,
      lineHeight: 24,
    },
    warn: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
      backgroundColor: c.statusAmberBg,
      borderRadius: 12,
      borderCurve: "continuous",
      padding: 14,
    },
    warnText: { flex: 1, fontSize: 13, color: c.textSecondary, lineHeight: 19 },
    footer: { gap: 10 },
  });
