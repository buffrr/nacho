import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Colors, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { Message } from "@/ui/Message";
import { Check } from "@/ui/icons";
import { useStore } from "@/Store";
import { scriptForHandle } from "@/keys";
import { signSingleAnyonecanpay } from "@/psbtSign";
import { liveOffers, markAllCancelled, Offer } from "@/offers";
import { formatBtc } from "@/format";

// Cancel outstanding sale/transfer offers by spending the handle's UTXO back to
// the SAME key (an ownership move to yourself → output value == input value).
// Once broadcast, every signature against that UTXO is dead. We have no chain
// view, so we can't confirm it landed — the copy says so. The outpoint comes
// from our saved offer history (design-notes.md §6).
export default function CancelOffers() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { handles, xpub, getSigningKey } = useStore();

  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [psbt, setPsbt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    liveOffers(handle!).then(setOffers);
  }, [handle]);

  const sign = useCallback(async () => {
    const data = handles?.[handle!];
    if (!data || !xpub || !offers || offers.length === 0) return;
    setSigning(true);
    setError(null);
    try {
      const script = scriptForHandle(xpub, data);
      const key = await getSigningKey(handle!);
      if (!key) throw new Error("No private key available for this handle.");
      // Offers all commit to the handle's current UTXO; spend it back to the same
      // key. Use the most recent live offer's outpoint.
      const { outpoint } = offers[0];
      const signed = signSingleAnyonecanpay(
        { ...outpoint, script },
        { script, amount: outpoint.amount }, // same key, same value
        key,
      );
      await markAllCancelled(handle!);
      setPsbt(signed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign.");
    } finally {
      setSigning(false);
    }
  }, [handles, xpub, offers, handle, getSigningKey]);

  const copy = async () => {
    if (!psbt) return;
    await Clipboard.setStringAsync(psbt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (psbt) {
    return (
      <Layout
        underHeader
        footer={
          <>
            <TouchableOpacity style={styles.primaryBtn} onPress={copy}>
              <Text style={styles.primaryBtnText}>
                {copied ? "Copied ✓" : "Copy transaction"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
              <Text style={styles.secondaryBtnText}>Done</Text>
            </TouchableOpacity>
          </>
        }
      >
        <Stack.Screen options={{ title: "Cancel offers" }} />
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Check size={30} color={colors.statusGreenFg} />
          </View>
          <Text style={styles.heroH}>Cancellation signed</Text>
          <Text style={styles.heroS}>
            Copy this to your wallet and broadcast it. Offers stay valid until it
            confirms, and can take up to a day to clear here.
          </Text>
        </View>
      </Layout>
    );
  }

  const hasOffers = !!offers && offers.length > 0;

  return (
    <Layout
      underHeader
      footer={
        hasOffers ? (
          <>
            {error && (
              <View style={styles.mt}>
                <Message message={error} type="error" />
              </View>
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, signing && { opacity: 0.5 }]}
              onPress={sign}
              disabled={signing}
            >
              {signing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Sign &amp; copy</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: "Cancel offers" }} />
      {offers === null ? (
        <ActivityIndicator color={colors.accent} size="large" style={{ marginTop: 40 }} />
      ) : offers.length === 0 ? (
        <View style={styles.mt}>
          <Message message="No live offers to cancel for this handle." type="error" />
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroH}>
              Invalidate {offers.length} live offer{offers.length === 1 ? "" : "s"}
            </Text>
            <Text style={styles.heroS}>{handle} stays on the same key</Text>
          </View>
          <View style={styles.card}>
            {offers.map((o, i) => (
              <React.Fragment key={o.id}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.kv}>
                  <Text style={styles.kvK}>
                    {o.kind === "sale" && o.price ? formatBtc(o.price) : "Transfer"}
                  </Text>
                  <Text style={styles.kvV}>{o.kind}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
          <View style={styles.note}>
            <Text style={styles.noteText}>
              Spending the UTXO is the only way to invalidate a signed offer. Copy
              the transaction to your wallet and broadcast it.
            </Text>
          </View>
        </>
      )}
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    mt: { marginTop: 16 },
    hero: { alignItems: "center", marginTop: 8, marginBottom: 22, gap: 8 },
    heroIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: c.statusGreenBg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    heroH: { fontSize: 20, fontWeight: "700", color: c.text, textAlign: "center" },
    heroS: { fontSize: 14, color: c.textSecondary, textAlign: "center", lineHeight: 20 },
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 16,
      overflow: "hidden",
    },
    kv: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    kvK: { fontSize: 15, fontWeight: "600", color: c.text, fontFamily: "monospace" },
    kvV: { fontSize: 13, color: c.textSecondary },
    divider: { height: 1, backgroundColor: c.border },
    note: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 12,
      padding: 13,
      marginTop: 12,
    },
    noteText: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
    primaryBtn: {
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 20,
    },
    primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
    secondaryBtn: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
    secondaryBtnText: { color: c.textSecondary, fontSize: 15, fontWeight: "500" },
  });
