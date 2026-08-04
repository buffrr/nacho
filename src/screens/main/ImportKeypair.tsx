import React, { useState, useMemo } from "react";
import { TextInput, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { isValidHandle } from "@/handle";
import { isValidPrivkeyHex } from "@/keys";
import { Layout } from "@/ui/Layout";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";

type Props = NativeStackScreenProps<HandlesStackParamList, "ImportKeypair">;

export default function ImportKeypair({ route, navigation }: Props) {
  const { handles, importKeypair } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [handle, setHandle] = useState(route.params?.handle ?? "");
  const [privkey, setPrivkey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit =
    handles !== null &&
    !isLoading &&
    isValidHandle(handle) &&
    isValidPrivkeyHex(privkey);

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    if (handle in handles) {
      setError("This handle already exists in your keystore.");
      return;
    }
    setIsLoading(true);
    try {
      await importKeypair(handle, privkey);
      navigation.replace("ShowHandle", { handle });
    } catch (err) {
      setIsLoading(false);
      setError(
        err instanceof Error ? err.message : "Failed to import keypair",
      );
    }
  };

  return (
    <Layout
      padTop
      footer={
        <Button
          text={isLoading ? "Importing..." : "Import keypair"}
          onPress={submit}
          type="main"
          disabled={!canSubmit}
        />
      }
    >
      <ScreenHeader
        title="Import keypair"
        subtitle="Add a handle backed by an existing private key, not derived from your seed phrase."
        onBack={() => navigation.goBack()}
      />

      <TextInput
        value={handle}
        onChangeText={(text) => {
          setHandle(text.trim().toLowerCase());
          setError(null);
        }}
        placeholder="me@bitcoin"
        placeholderTextColor={colors.placeholder}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isLoading}
      />

      <TextInput
        value={privkey}
        onChangeText={(text) => {
          setPrivkey(text.trim().toLowerCase());
          setError(null);
        }}
        placeholder="private key (64 hex characters)"
        placeholderTextColor={colors.placeholder}
        style={[styles.input, styles.privkeyInput]}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        multiline
        editable={!isLoading}
      />

      {error && <Message message={error} type="error" />}
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    input: {
      backgroundColor: c.field,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 17,
      fontSize: 16,
      color: c.text,
      fontFamily: "monospace",
      marginBottom: 12,
      // @ts-ignore - web-only style to remove focus outline
      outlineStyle: "none",
    } as any,
    privkeyInput: {
      minHeight: 80,
      textAlignVertical: "top",
    },
  });
