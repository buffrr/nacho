import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import {
  generateMnemonic,
  xpubFromMnemonic,
  xprvFromMnemonic,
} from "@/keys";
import { useStore } from "@/Store";
import { usePendingKeystore } from "@/PendingKeystore";
import { Button } from "@/ui/Button";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { Layout } from "@/ui/Layout";
import { SvgXml } from "react-native-svg";
import { Colors, useTheme } from "@/theme";

export default function () {
  const router = useRouter();
  const { setPending } = usePendingKeystore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { setupKeystore } = useStore();
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Create the keystore now and let the user back up the seed phrase later
  // (it's stored in secure storage and revealable from Settings).
  const backUpLater = async () => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 5));
    const phrase = mnemonic ?? generateMnemonic();
    await setupKeystore(xprvFromMnemonic(phrase), {}, phrase);
  };

  const mnemonicWords = mnemonic ? mnemonic.split(" ") : [];

  return (
    <Layout
      padTop
      footer={
        <>
          <Button
            text={
              isLoading
                ? "Preparing..."
                : mnemonic === null
                  ? "Tap to reveal your 12 words"
                  : "I've saved my seed phrase"
            }
            onPress={() => {
              setIsLoading(true);
              setTimeout(() => {
                if (mnemonic === null) {
                  setMnemonic(generateMnemonic());
                } else {
                  const xpub = xpubFromMnemonic(mnemonic);
                  setPending({ xpub });
                  router.push("/(onboarding)/enter-mnemonic");
                }
                setIsLoading(false);
              }, 5);
            }}
            type="main"
            disabled={isLoading}
          />
          {mnemonic === null && (
            <Button
              text="Back up later"
              onPress={backUpLater}
              type="secondary"
              disabled={isLoading}
            />
          )}
        </>
      }
    >
      {!mnemonic ? (
        <>
          <ScreenHeader
            title="Generate seed phrase"
            subtitle="Your seed phrase is the master key to your handles."
            onBack={() => router.back()}
          />

          <View style={styles.warningsContainer}>
            <View style={styles.warningItem}>
              <View style={styles.warningIcon}>
                <SvgXml
                  xml={`<svg width="24" height="25" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M6.66667 7.83333C8.13943 7.83333 9.33333 6.63943 9.33333 5.16667C9.33333 3.69391 8.13943 2.5 6.66667 2.5C5.19391 2.5 4 3.69391 4 5.16667C4 6.63943 5.19391 7.83333 6.66667 7.83333Z" stroke="#FF7B00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M6.86667 10.5H4.66667C3.95942 10.5 3.28115 10.781 2.78105 11.281C2.28095 11.7811 2 12.4594 2 13.1667V14.5" stroke="#FF7B00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M10 10.8333V9.83333C10 9.47971 10.1405 9.14057 10.3905 8.89052C10.6406 8.64048 10.9797 8.5 11.3333 8.5C11.687 8.5 12.0261 8.64048 12.2761 8.89052C12.5262 9.14057 12.6667 9.47971 12.6667 9.83333V10.8333" stroke="#FF7B00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M13.4006 11.1666H9.26596C8.93496 11.1666 8.66663 11.435 8.66663 11.766V13.9006C8.66663 14.2316 8.93496 14.5 9.26596 14.5H13.4006C13.7316 14.5 14 14.2316 14 13.9006V11.766C14 11.435 13.7316 11.1666 13.4006 11.1666Z" stroke="#FF7B00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`}
                  width={24}
                  height={24}
                />
              </View>
              <View style={styles.warningContent}>
                <Text style={styles.warningTitle}>Never share it</Text>
                <Text style={styles.warningText}>
                  Anyone with these words can control your handles.
                </Text>
              </View>
            </View>

            <View style={styles.warningItem}>
              <View style={styles.warningIcon}>
                <SvgXml
                  xml={`<svg width="24" height="25" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M8.93329 1.83337H3.99996C3.64634 1.83337 3.3072 1.97385 3.05715 2.2239C2.8071 2.47395 2.66663 2.81309 2.66663 3.16671V13.8334C2.66663 14.187 2.8071 14.5261 3.05715 14.7762C3.3072 15.0262 3.64634 15.1667 3.99996 15.1667H12C12.3536 15.1667 12.6927 15.0262 12.9428 14.7762C13.1928 14.5261 13.3333 14.187 13.3333 13.8334V8.90004" stroke="#FF7B00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M1.33337 4.5H4.00004" stroke="#FF7B00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M1.33337 7.16663H4.00004" stroke="#FF7B00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M1.33337 9.83337H4.00004" stroke="#FF7B00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M1.33337 12.5H4.00004" stroke="#FF7B00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M14.2519 4.25068C14.5175 3.98511 14.6667 3.62492 14.6667 3.24935C14.6667 2.87378 14.5175 2.51359 14.2519 2.24802C13.9864 1.98245 13.6262 1.83325 13.2506 1.83325C12.875 1.83325 12.5148 1.98245 12.2493 2.24802L8.90928 5.58935C8.75078 5.74777 8.63476 5.94357 8.57194 6.15868L8.01394 8.07202C7.99721 8.12938 7.99621 8.19019 8.01104 8.24808C8.02587 8.30596 8.05599 8.3588 8.09824 8.40105C8.1405 8.44331 8.19333 8.47343 8.25122 8.48826C8.3091 8.50309 8.36991 8.50208 8.42728 8.48535L10.3406 7.92735C10.5557 7.86454 10.7515 7.74852 10.9099 7.59002L14.2519 4.25068Z" stroke="#FF7B00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`}
                  width={24}
                  height={24}
                />
              </View>
              <View style={styles.warningContent}>
                <Text style={styles.warningTitle}>Write it down</Text>
                <Text style={styles.warningText}>
                  Store it safely offline, not on your phone.
                </Text>
              </View>
            </View>

            <View style={styles.warningItem}>
              <View style={styles.warningIcon}>
                <SvgXml
                  xml={`<svg width="24" height="25" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M3.28601 3.78601L12.7133 13.214" stroke="#FF7B00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M8.00004 15.1667C11.6819 15.1667 14.6667 12.1819 14.6667 8.50004C14.6667 4.81814 11.6819 1.83337 8.00004 1.83337C4.31814 1.83337 1.33337 4.81814 1.33337 8.50004C1.33337 12.1819 4.31814 15.1667 8.00004 15.1667Z" stroke="#FF7B00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`}
                  width={24}
                  height={24}
                />
              </View>
              <View style={styles.warningContent}>
                <Text style={styles.warningTitle}>No reset option</Text>
                <Text style={styles.warningText}>
                  Without it, you can't recover your handles.
                </Text>
              </View>
            </View>
          </View>
        </>
      ) : (
        <>
          <ScreenHeader
            title="Back up your seed phrase"
            subtitle="Write down these 12 words in order. They're the only way to recover your handles."
          />

          <View style={styles.mnemonicContainer}>
            <View style={styles.wordsGrid}>
              {mnemonicWords.map((word, index) => (
                <View key={index} style={styles.wordItem}>
                  <Text style={styles.wordNumber}>{index + 1}.</Text>
                  <Text style={styles.wordText}>{word}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    warningsContainer: {
      flex: 1,
      gap: 22,
      marginTop: 12,
    },
    warningItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 14,
    },
    warningIcon: {
      marginTop: 1,
    },
    warningContent: {
      flex: 1,
    },
    warningTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: c.text,
      marginBottom: 4,
    },
    warningText: {
      fontSize: 14,
      color: c.textSecondary,
      lineHeight: 20,
    },
    mnemonicContainer: {
      flex: 1,
      marginTop: 4,
    },
    wordsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      marginBottom: 30,
    },
    wordItem: {
      width: "48%",
      backgroundColor: c.field,
      borderRadius: 10,
      paddingVertical: 13,
      paddingHorizontal: 14,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    wordNumber: {
      fontSize: 14,
      color: c.textMuted,
      fontWeight: "500",
      minWidth: 18,
    },
    wordText: {
      fontSize: 15,
      fontWeight: "500",
      color: c.text,
      flex: 1,
    },
  });
