import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { useStore } from "@/Store";
import { save } from "@/file";
import { Colors, ThemeMode, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { BottomNav } from "@/ui/BottomNav";
import { Header } from "@/ui/Header";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";

const MODES: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export default function Settings() {
  const navigation =
    useNavigation<NativeStackNavigationProp<HandlesStackParamList>>();
  const { xpub, handles } = useStore();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [error, setError] = useState<string | null>(null);

  const backupKeystore = async () => {
    setError(null);
    try {
      const keystore = { xpub, handles };
      await save(`keystore_${Date.now()}.json`, keystore);
    } catch (err) {
      setError("Failed to export keystore");
    }
  };

  return (
    <Layout footer={<BottomNav active="settings" />}>
      <Header
        headText="Keystore"
        tailText="Backup"
        subText="Export a copy of your keystore. It contains your public key and handles — never your private key, which stays in secure storage."
      />

      <Button text="Backup Keystore" onPress={backupKeystore} type="main" />
      <Button
        text="Reveal Seed Phrase"
        onPress={() => navigation.navigate("RevealSeed")}
        type="secondary"
      />

      {error && <Message message={error} type="error" />}

      <View style={styles.note}>
        <Text style={styles.noteText}>
          Your seed phrase remains the only way to recover the private key.
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Appearance</Text>
      <View style={styles.segment}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.segmentItem, mode === m.id && styles.segmentItemActive]}
            onPress={() => setMode(m.id)}
          >
            <Text
              style={[
                styles.segmentText,
                mode === m.id && styles.segmentTextActive,
              ]}
            >
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    note: {
      marginTop: 24,
    },
    noteText: {
      fontSize: 14,
      color: c.textMuted,
      lineHeight: 20,
    },
    sectionLabel: {
      fontSize: 18,
      color: c.text,
      marginTop: 32,
      marginBottom: 12,
    },
    segment: {
      flexDirection: "row",
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 4,
      gap: 4,
    },
    segmentItem: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: "center",
    },
    segmentItemActive: {
      backgroundColor: c.accent,
    },
    segmentText: {
      color: c.textMuted,
      fontSize: 15,
      fontWeight: "500",
    },
    segmentTextActive: {
      color: c.accentText,
    },
  });
