import React, { useState, useMemo } from "react";
import { TextInput, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { Header } from "@/ui/Header";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";
import { claimCode } from "@/api";

type Props = NativeStackScreenProps<HandlesStackParamList, "Redeem">;

export default function Redeem({ route, navigation }: Props) {
  const { nextScriptPubkey, createHandle } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [code, setCode] = useState(route.params?.code ?? "");
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
      navigation.replace("ShowHandle", { handle: result.handle });
    } catch (err) {
      setIsLoading(false);
      setError("Redeemed, but failed to save the handle.");
    }
  };

  return (
    <Layout
      footer={
        <Button
          text={isLoading ? "Redeeming…" : "Redeem"}
          onPress={redeem}
          type="main"
          disabled={!canSubmit}
        />
      }
    >
      <Header
        headText="Redeem"
        tailText="Code"
        subText="Bought a handle on the web? Enter your claim code to bind it to a new key."
      />
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
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: c.text,
      fontFamily: "monospace",
      // @ts-ignore - web-only style to remove focus outline
      outlineStyle: "none",
    } as any,
  });
