import React, { useState, useEffect, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { open } from "@/file";
import { useStore } from "@/Store";
import { scriptForHandle } from "@/keys";
import { isCert, extractCertData } from "@/cert";
import { Colors, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";
import { QrScanner } from "@/ui/QrScanner";

type ImportError =
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isFocused = useIsFocused();
  const [error, setError] = useState<ImportError>(null);
  const [busy, setBusy] = useState(false);
  const [scanNonce, setScanNonce] = useState(0);

  useEffect(() => {
    if (!error) return;
    const timeoutId = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timeoutId);
  }, [error]);

  const getMessage = (error: ImportError): string => {
    switch (error) {
      case "downloadFailed":
        return "Failed to download data from URL";
      case "invalidJson":
        return "That QR code isn't a certificate";
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

  const onScan = (data: string) => {
    if (busy) return;
    setBusy(true);
    const done = () => {
      setBusy(false);
      setScanNonce((n) => n + 1); // re-arm the scanner for another attempt
    };
    const p =
      data.startsWith("http://") || data.startsWith("https://")
        ? downloadAndApplyJson(data)
        : applyJson(data);
    p.finally(done);
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
      padTop
      footer={
        <Button
          text="Upload certificate file"
          onPress={handleFileImport}
          type="main"
        />
      }
    >
      <ScreenHeader
        title="Import certificate"
        subtitle={`Scan a QR code or upload a file to add the certificate for ${handle}.`}
        onBack={() => navigation.goBack()}
      />

      <View style={styles.frame}>
        <View style={styles.camera}>
          <QrScanner
            key={scanNonce}
            active={isFocused && !busy}
            onScan={onScan}
            onError={(m) => setError(m as ImportError)}
          />
        </View>
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />
      </View>

      {error && <Message message={getMessage(error)} type="error" />}
    </Layout>
  );
}

const BRACKET = 34;
const THICK = 4;

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    frame: {
      alignSelf: "center",
      width: 295,
      height: 295,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    camera: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 24,
      overflow: "hidden",
      backgroundColor: c.tileNeutral,
    },
    corner: {
      position: "absolute",
      width: BRACKET,
      height: BRACKET,
      borderColor: c.accent,
    },
    tl: { top: 16, left: 16, borderTopWidth: THICK, borderLeftWidth: THICK, borderTopLeftRadius: 14 },
    tr: { top: 16, right: 16, borderTopWidth: THICK, borderRightWidth: THICK, borderTopRightRadius: 14 },
    bl: { bottom: 16, left: 16, borderBottomWidth: THICK, borderLeftWidth: THICK, borderBottomLeftRadius: 14 },
    br: { bottom: 16, right: 16, borderBottomWidth: THICK, borderRightWidth: THICK, borderBottomRightRadius: 14 },
  });
