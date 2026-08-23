import React, { useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Redirect, Stack } from "expo-router";
import { useStore } from "@/Store";
import { validateMnemonic, xprvFromMnemonic, xpubFromXprv } from "@/keys";
import { usePendingKeystore } from "@/PendingKeystore";
import { Button } from "@/ui/Button";
import { ScreenSubtitle } from "@/ui/ScreenSubtitle";
import { Layout } from "@/ui/Layout";
import { Message } from "@/ui/Message";
import { Colors, useTheme } from "@/theme";

export default function () {
  const { pending } = usePendingKeystore();
  const xpub = pending?.xpub ?? "";
  const handles = pending?.handles;
  const isNew = handles === undefined;
  type ValidationError = "invalid" | "mismatch" | null;

  const { setupKeystore, markSeedBackedUp } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [inputWords, setInputWords] = useState<string[]>(Array(12).fill(""));
  const [error, setError] = useState<ValidationError>(null);
  const inputRefs = useRef<(TextInput | null)[]>(Array(12).fill(null));

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...inputWords];
    newWords[index] = value.toLowerCase().trim();
    setInputWords(newWords);

    if (error) {
      setError(null);
    }
  };

  const handleContinue = () => {
    setError(null);

    const mnemonic = inputWords.join(" ");
    if (!validateMnemonic(mnemonic)) {
      setError("invalid");
      return;
    }

    const xprv = xprvFromMnemonic(mnemonic);
    if (xpub !== xpubFromXprv(xprv)) {
      setError("mismatch");
      return;
    }

    setupKeystore(xprv, handles || {}, mnemonic);
    // Restoring from a backup means they already hold the seed — no need to nudge.
    void markSeedBackedUp();
  };

  const getMessage = (error: ValidationError): string => {
    switch (error) {
      case "invalid":
        return "The entered seed phrase is not valid. Please check your words.";
      case "mismatch":
        if (isNew) {
          return "The entered seed phrase doesn't match. Please try again.";
        } else {
          return "The entered seed phrase doesn't correspond to the keystore. Please try again.";
        }
      default:
        return "";
    }
  };

  const isComplete = inputWords.every((word) => word.length > 0);

  // No pending keystore (e.g. a direct deep-link / web reload) → nothing to
  // confirm; bounce back to the start of onboarding.
  if (!pending) return <Redirect href="/(onboarding)" />;

  return (
    <Layout
      underHeader
      footer={
        <Button
          text="Verify seed phrase"
          onPress={handleContinue}
          type="main"
          disabled={!isComplete}
        />
      }
    >
      <Stack.Screen
        options={{ title: isNew ? "Confirm seed phrase" : "Enter seed phrase" }}
      />
      <ScreenSubtitle>
        {isNew
          ? "Enter your 12-word seed phrase to confirm you've saved it correctly."
          : "Enter your 12-word seed phrase to confirm you have the private key associated with the keystore."}
      </ScreenSubtitle>

      <View style={styles.inputContainer}>
        {inputWords.map((word, index) => (
          <TouchableOpacity
            key={index}
            style={styles.wordInputContainer}
            onPress={() => inputRefs.current[index]?.focus()}
          >
            <Text style={styles.wordInputNumber}>{index + 1}.</Text>
            <TextInput
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={styles.wordInput}
              value={word}
              onChangeText={(value) => handleWordChange(index, value)}
              placeholder=""
              placeholderTextColor={colors.placeholder}
              selectionColor={colors.text}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
          </TouchableOpacity>
        ))}
      </View>

      {error && <Message message={getMessage(error)} type="error" />}
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    inputContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      marginTop: 4,
      marginBottom: 30,
    },
    wordInputContainer: {
      width: "48%",
      backgroundColor: c.field,
      borderRadius: 10,
      paddingVertical: 13,
      paddingHorizontal: 14,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minWidth: 0,
    },
    wordInputNumber: {
      fontSize: 14,
      color: c.textMuted,
      fontWeight: "500",
      minWidth: 18,
    },
    wordInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: "400",
      color: c.text,
      padding: 0,
      margin: 0,
      textAlign: "left",
      minWidth: 0,
      // @ts-ignore - web-only style to remove focus outline
      outlineStyle: "none",
    } as any,
  });
