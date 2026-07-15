import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Camera, CameraView } from "expo-camera";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { open } from "@/file";
import { useStore } from "@/Store";
import { scriptForHandle } from "@/keys";
import { isCert, extractCertData } from "@/cert";
import { Layout } from "@/ui/Layout";
import { Header } from "@/ui/Header";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";

type ImportError =
  | "cameraPermissionFailed"
  | "downloadFailed"
  | "invalidJson"
  | "fileLoadFailed"
  | "invalidCert"
  | "wrongHandle"
  | "invalidHandle"
  | null;

type ImportCertificateRouteProp = RouteProp<
  HandlesStackParamList,
  "ImportCertificate"
>;
type ImportCertificateNavigationProp = NativeStackNavigationProp<
  HandlesStackParamList,
  "ImportCertificate"
>;

interface Props {
  route: ImportCertificateRouteProp;
  navigation: ImportCertificateNavigationProp;
}

export default function ImportCertificate({ route, navigation }: Props) {
  const { handle } = route.params;
  const { xpub, handles, setHandleCertData } = useStore();
  const [hasCameraPermission, setHasCameraPermission] = useState<
    boolean | null
  >(null);
  const [error, setError] = useState<ImportError>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  useEffect(() => {
    const requestCameraPermission = async () => {
      if (Platform.OS === "web") {
        setHasCameraPermission(true);
        return;
      }

      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasCameraPermission(status === "granted");
      } catch (error) {
        setHasCameraPermission(false);
        setError("cameraPermissionFailed");
      }
    };

    requestCameraPermission();
  }, []);

  useEffect(() => {
    if (!error) return;
    const timeoutId = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timeoutId);
  }, [error]);

  const getMessage = (error: ImportError): string => {
    switch (error) {
      case "cameraPermissionFailed":
        return "Failed to request camera permission";
      case "downloadFailed":
        return "Failed to download data from URL";
      case "invalidJson":
        return "Invalid JSON format";
      case "fileLoadFailed":
        return "Failed to load file";
      case "invalidCert":
        return "Invalid certificate format";
      case "wrongHandle":
        return `This certificate is for a different handle, not ${handle}`;
      case "invalidHandle":
        return "Invalid handle / pubkey combination";
      default:
        return "";
    }
  };

  const handleBarCodeScanned = async ({
    data,
  }: {
    type: string;
    data: string;
  }) => {
    if (data === lastScannedCode) return;
    setLastScannedCode(data);
    if (data.startsWith("http://") || data.startsWith("https://")) {
      await downloadAndApplyJson(data);
    } else {
      await applyJson(data);
    }
  };

  const downloadAndApplyJson = async (url: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const jsonData = await response.text();
      await applyJson(jsonData);
    } catch (error) {
      setError("downloadFailed");
    }
  };

  const applyJson = async (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      applyJsonData(data);
    } catch (error) {
      setError("invalidJson");
    }
  };

  const handleFileImport = async () => {
    try {
      const { data } = await open();
      applyJsonData(data);
    } catch (error) {
      if (error instanceof Error && error.name === "UserCancel") {
        return;
      }
      setError("fileLoadFailed");
    }
  };

  const applyJsonData = async (data: unknown) => {
    if (!isCert(data)) {
      setError("invalidCert");
      return;
    }
    if (data.handle !== handle) {
      setError("wrongHandle");
      return;
    }
    const certData = extractCertData(data);
    const { script_pubkey } = data;
    const handleData = handles?.[handle];
    if (
      handleData === undefined ||
      xpub === null ||
      scriptForHandle(xpub, handleData) !== script_pubkey
    ) {
      setError("invalidHandle");
      return;
    }
    setHandleCertData(handle, certData).then(() =>
      navigation.navigate("ShowHandle", { handle }),
    );
  };

  return (
    <Layout
      footer={
        <Button
          text="Upload Certificate File"
          onPress={handleFileImport}
          type="main"
        />
      }
    >
      <Header
        headText="Import"
        tailText="Certificate"
        subText={`Scan a QR code or upload a file to add the certificate for ${handle}.`}
      />

      {hasCameraPermission && (
        <View style={styles.uploadArea}>
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
            />
            <View style={styles.cameraOverlay}>
              <View style={styles.scanArea} />
              <Text style={styles.scanText}>
                Position QR code within the frame
              </Text>
            </View>
          </View>
        </View>
      )}

      {error && <Message message={getMessage(error)} type="error" />}
    </Layout>
  );
}

const styles = StyleSheet.create({
  uploadArea: {
    flex: 1,
    marginBottom: 20,
  },
  cameraContainer: {
    flex: 1,
    minHeight: 400,
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  scanText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 12,
    borderRadius: 8,
  },
});
