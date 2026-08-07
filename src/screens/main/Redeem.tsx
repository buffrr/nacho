import React, { useState, useMemo } from "react";
import { Text, TextInput, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";
import { claimCode } from "@/api";

export default function Redeem() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const { nextScriptPubkey, createHandle, setHandlePurchase } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [code, setCode] = useState(params.code ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = code.trim().length > 0 && !isLoading;

  const redeem = async () => {
    if (!canSubmit) return;
    setError(null);
    const script = nextScriptPubkey();
    if (!script) {
      setError("Keystore not ready.");
      return;
    }

    setIsLoading(true);
    const result = await claimCode(code.trim(), script);
    if (!result.ok) {
      setIsLoading(false);
      if (result.httpStatus === 402) {
        setError("Payment hasn't settled yet — wait a few seconds and retry.");
      } else if (result.httpStatus === 409) {
        setError("This code has already been redeemed.");
      } else {
        setError(result.error);
      }
      return;
    }

    try {
      // Bind succeeded server-side under the next derived key — persist it.
      await createHandle(result.handle);
      // Acquired through nacho (no paid amount here) → show the reassuring
      // "is yours / issuing certificate" state, not the plain "waiting" note.
      await setHandlePurchase(result.handle, {});
      // Rebuild the stack as [handles tab, this handle] so Back lands on Your
      // handles rather than the redeem/register flow (Expo Router has no reset).
      if (router.canDismiss()) router.dismissAll();
      router.navigate("/(main)/(tabs)/handles");
      router.push({
        pathname: "/(main)/show-handle",
        params: { handle: result.handle },
      });
    } catch (err) {
      setIsLoading(false);
      setError("Redeemed, but failed to save the handle.");
    }
  };

  return (
    <Layout
      underHeader
      footer={
        <Button
          text={isLoading ? "Redeeming…" : "Redeem"}
          onPress={redeem}
          type="main"
          disabled={!canSubmit}
        />
      }
    >
      <Text style={styles.subtitle}>
        Bought a handle on the web? Enter your claim code to bind it to a new
        key.
      </Text>
      <TextInput
        value={code}
        onChangeText={(text) => {
          setCode(text.trim());
          setError(null);
        }}
        placeholder="ABCD-EFGH-JKLM"
        placeholderTextColor={colors.placeholder}
        style={styles.input}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!isLoading}
      />
      {error && <Message message={error} type="error" />}
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    subtitle: {
      fontSize: 15,
      lineHeight: 21,
      color: c.textSecondary,
      marginBottom: 20,
    },
    input: {
      backgroundColor: c.field,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 17,
      fontSize: 16,
      color: c.text,
      fontFamily: "monospace",
      letterSpacing: 1,
      // @ts-ignore - web-only style to remove focus outline
      outlineStyle: "none",
    } as any,
  });
