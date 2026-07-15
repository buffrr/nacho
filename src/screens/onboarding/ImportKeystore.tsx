import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { open } from "@/file";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useStore, Keystore, isKeystore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { OnboardingStackParamList } from "@/Navigation";
import { Layout } from "@/ui/Layout";
import { Header } from "@/ui/Header";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";

type Props = NativeStackScreenProps<OnboardingStackParamList, "ImportKeystore">;

export default function ImportKeystore({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [keystore, setKeystore] = useState<Keystore | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const selectFile = async () => {
    setValidationError(null);
    setKeystore(null);
    setSelectedFileName(null);

    try {
      const { data, filename } = await open();

      if (isKeystore(data)) {
        setKeystore(data);
        setSelectedFileName(filename);
        setValidationError(null);
      } else {
        setValidationError("Invalid keystore format in file");
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

  const handleImport = () => {
    if (keystore) {
      navigation.navigate("EnterMnemonic", keystore);
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
      footer={
        <Button
          text="Import Keystore"
          onPress={handleImport}
          type="main"
          disabled={!keystore}
        />
      }
    >
      <Header
        headText="Import"
        tailText="Keystore"
        subText="Select a JSON keystore file to import your configuration."
      />

      <View style={styles.fileSelectionContainer}>
        <Button text="Select JSON File" onPress={selectFile} type="secondary" />

        {renderFileInfo()}
      </View>

      {validationError !== null && (
        <Message message={validationError} type="error" />
      )}
      {keystore && !validationError && (
        <Message
          message="Keystore file validated successfully. Ready to import."
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
