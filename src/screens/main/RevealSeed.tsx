import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { Header } from "@/ui/Header";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";

type Props = NativeStackScreenProps<HandlesStackParamList, "RevealSeed">;

export default function RevealSeed({}: Props) {
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
      <Layout>
        <Header
          headText="Seed"
          tailText="Phrase"
          subText="No seed phrase is stored on this device."
        />
        <Message
          message="This keystore was set up without saving its seed phrase. Back it up with the keystore file from Settings instead."
          type="error"
        />
      </Layout>
    );
  }

  return (
    <Layout
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
      <Header
        headText="Seed"
        tailText="Phrase"
        subText="Write these 12 words down in order and keep them offline. Anyone with them controls your handles."
      />

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
      backgroundColor: c.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    wordNumber: {
      fontSize: 14,
      color: c.accent,
      fontWeight: "500",
    },
    wordText: {
      fontSize: 14,
      fontWeight: "400",
      color: c.text,
      flex: 1,
    },
  });
