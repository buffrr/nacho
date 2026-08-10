import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Colors, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { Message } from "@/ui/Message";
import { encodeSignRequest, extractReqParam, SignRequest } from "@/signRequest";

// User-initiated Sell / Transfer, off any QR/deeplink: the user supplies the
// handle's current outpoint (txid:vout + value) and the terms, and we build the
// same v2 envelope + route through the normal /sign confirmation. This is how a
// user starts a tx when there's no request to scan (design-notes.md §6).
export default function HandleAction() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { handle, action } = useLocalSearchParams<{
    handle: string;
    action: "sale" | "transfer";
  }>();

  const [txid, setTxid] = useState("");
  const [vout, setVout] = useState("0");
  const [amount, setAmount] = useState("");
  const [to, setTo] = useState(""); // transfer
  const [price, setPrice] = useState(""); // sale
  const [error, setError] = useState<string | null>(null);

  const isSale = action === "sale";
  const title = isSale ? "Sell handle" : "Transfer handle";

  const proceed = () => {
    setError(null);
    if (!/^[0-9a-fA-F]{64}$/.test(txid.trim()))
      return setError("Enter a valid 64-character txid.");
    const voutN = Number(vout);
    const amountN = Number(amount);
    if (!Number.isInteger(voutN) || voutN < 0) return setError("Enter a valid vout.");
    if (!Number.isInteger(amountN) || amountN <= 0)
      return setError("Enter the UTXO value in ₿ base units.");

    const exp = Math.floor(Date.now() / 1000) + 3600; // 1h to complete
    const outpoint = { txid: txid.trim().toLowerCase(), vout: voutN, amount: amountN };
    let req: SignRequest;
    if (isSale) {
      const priceN = Number(price);
      if (!Number.isInteger(priceN) || priceN <= 0)
        return setError("Enter a price in ₿ base units.");
      req = { v: 1, type: "sale", handle: handle!, price: priceN, outpoint, exp };
    } else {
      if (!/^[0-9a-fA-F]+$/.test(to.trim()))
        return setError("Enter the recipient's script (hex).");
      req = { v: 1, type: "transfer", handle: handle!, to: to.trim().toLowerCase(), outpoint, exp };
    }
    const param = extractReqParam(encodeSignRequest(req));
    router.replace({ pathname: "/(main)/sign", params: { req: param ?? "" } });
  };

  return (
    <Layout underHeader>
      <Stack.Screen options={{ title }} />
      <Text style={styles.prompt}>
        Enter the handle's current UTXO and the {isSale ? "price" : "recipient"}.
        You'll review and sign on the next screen.
      </Text>

      <Text style={styles.lbl}>UTXO</Text>
      <TextInput
        value={txid}
        onChangeText={setTxid}
        placeholder="txid (64 hex)"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <View style={styles.row}>
        <TextInput
          value={vout}
          onChangeText={setVout}
          placeholder="vout"
          placeholderTextColor={colors.placeholder}
          keyboardType="number-pad"
          style={[styles.input, styles.half]}
        />
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="value (₿ base units)"
          placeholderTextColor={colors.placeholder}
          keyboardType="number-pad"
          style={[styles.input, styles.half]}
        />
      </View>

      {isSale ? (
        <>
          <Text style={styles.lbl}>Price (₿ base units)</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="500000"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
            style={styles.input}
          />
        </>
      ) : (
        <>
          <Text style={styles.lbl}>Recipient script (hex)</Text>
          <TextInput
            value={to}
            onChangeText={setTo}
            placeholder="5120…"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </>
      )}

      {error && (
        <View style={styles.mt}>
          <Message message={error} type="error" />
        </View>
      )}

      <TouchableOpacity style={styles.primaryBtn} onPress={proceed}>
        <Text style={styles.primaryBtnText}>Review</Text>
      </TouchableOpacity>
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    prompt: { fontSize: 15, color: c.textSecondary, marginBottom: 18, lineHeight: 21 },
    lbl: {
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.5,
      color: c.textMuted,
      textTransform: "uppercase",
      marginTop: 14,
      marginBottom: 8,
    },
    input: {
      backgroundColor: c.field,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 14,
      color: c.text,
      fontFamily: "monospace",
      // @ts-ignore web-only
      outlineStyle: "none",
    } as any,
    row: { flexDirection: "row", gap: 10, marginTop: 10 },
    half: { flex: 1 },
    mt: { marginTop: 16 },
    primaryBtn: {
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 24,
    },
    primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  });
