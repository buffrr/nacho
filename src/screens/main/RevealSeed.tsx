import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { ScreenSubtitle } from "@/ui/ScreenSubtitle";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";

export default function RevealSeed() {
  const router = useRouter();
  const { getMnemonic } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [words, setWords] = useState<string[] | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let active = true;
    getMnemonic().then((m) => {
      if (active) setWords(m ? m.split(" ") : []);
    });
    return () => {
      active = false;
    };
  }, []);

  if (words !== null && words.length === 0) {
    return (
      <Layout underHeader>
        <ScreenSubtitle>
          No seed phrase is stored on this device.
        </ScreenSubtitle>
        <Message
          message="This keystore was set up without saving its seed phrase. Back it up with the keystore file from Settings instead."
          type="error"
        />
      </Layout>
    );
  }

  return (
    <Layout
      underHeader
      footer={
        !revealed ? (
          <Button
            text="Reveal seed phrase"
            onPress={() => setRevealed(true)}
            type="main"
            disabled={words === null}
          />
        ) : undefined
      }
    >
      <ScreenSubtitle>
        Write these 12 words down in order and keep them offline. Anyone with
        them controls your handles.
      </ScreenSubtitle>

      {revealed && words && (
        <View style={styles.wordsGrid}>
          {words.map((word, index) => (
            <View key={index} style={styles.wordItem}>
              <Text style={styles.wordNumber}>{index + 1}.</Text>
              <Text style={styles.wordText}>{word}</Text>
            </View>
          ))}
        </View>
      )}
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wordsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
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
