import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { openBinary } from "@/file";
import { importDbBytes, readKeystoreFromBytes } from "@/db";
import { useRouter } from "expo-router";
import { Keystore, isKeystore } from "@/Store";
import { usePendingKeystore } from "@/PendingKeystore";
import { Colors, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";

export default function ImportKeystore() {
  const router = useRouter();
  const { setPending } = usePendingKeystore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [keystore, setKeystore] = useState<Keystore | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const selectFile = async () => {
    setValidationError(null);
    setKeystore(null);
    setBytes(null);
    setSelectedFileName(null);

    try {
      const { bytes: fileBytes, filename } = await openBinary();
      const keystoreJson = await readKeystoreFromBytes(fileBytes);
      const data = keystoreJson ? JSON.parse(keystoreJson) : null;

      if (data && isKeystore(data)) {
        setKeystore(data);
        setBytes(fileBytes);
        setSelectedFileName(filename);
        setValidationError(null);
      } else {
        setValidationError("That isn't a valid Nacho backup (.sqlite) file.");
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "File selection canceled") {
          return;
        }
        setValidationError(error.message);
      } else {
        setValidationError("Failed to process file");
      }
    }
  };

  const handleImport = async () => {
    if (!keystore || !bytes) return;
    setImporting(true);
    setValidationError(null);
    try {
      // Load the backup's certs + records + keystore into the live database,
      // then continue to the seed step to unlock signing.
      await importDbBytes(bytes);
      setPending(keystore);
      router.push("/(onboarding)/enter-mnemonic");
    } catch {
      setValidationError("Failed to restore the backup.");
    } finally {
      setImporting(false);
    }
  };

  const renderFileInfo = () => {
    if (!selectedFileName) return null;

    return (
      <View style={styles.fileInfoContainer}>
        <Text style={styles.fileInfoTitle}>Selected File</Text>
        <Text style={styles.fileName}>{selectedFileName}</Text>
      </View>
    );
  };

  return (
    <Layout
      padTop
      footer={
        <Button
          text={importing ? "Restoring…" : "Restore backup"}
          onPress={handleImport}
          type="main"
          disabled={!keystore || importing}
        />
      }
    >
      <ScreenHeader
        title="Restore from backup"
        subtitle="Select a Nacho backup (.sqlite) to restore your public key, handles, and certificates."
        onBack={() => router.back()}
      />

      <View style={styles.fileSelectionContainer}>
        <Button text="Select backup file" onPress={selectFile} type="secondary" />

        {renderFileInfo()}
      </View>

      {validationError !== null && (
        <Message message={validationError} type="error" />
      )}
      {keystore && !validationError && (
        <Message
          message="Backup validated successfully. Ready to restore."
          type="success"
        />
      )}
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    fileSelectionContainer: {
      marginTop: 20,
      marginBottom: 30,
    },
    fileInfoContainer: {
      backgroundColor: c.surface,
      borderRadius: 8,
      padding: 16,
      marginTop: 20,
    },
    fileInfoTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: c.accent,
      marginBottom: 8,
    },
    fileName: {
      fontSize: 16,
      fontWeight: "400",
      color: c.text,
    },
  });
