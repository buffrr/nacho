import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, useIsFocused } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Colors, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { Message } from "@/ui/Message";
import { AlertCircle, Clipboard as ClipboardIcon } from "@/ui/icons";
import { ScreenSubtitle } from "@/ui/ScreenSubtitle";
import { QrScanner } from "@/ui/QrScanner";
import { trustFromInput } from "@/fabric";

export default function VerifyAnchor() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isFocused = useIsFocused();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanNonce, setScanNonce] = useState(0);

  const handleData = async (data: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await trustFromInput(data.trim());
      router.back();
    } catch {
      setError(
        "That isn't a valid Trust ID. Paste a veritas:// link or a 64-character anchor id, or scan the QR from a local Veritas client.",
      );
      setBusy(false);
      setTimeout(() => {
        setError(null);
        setScanNonce((n) => n + 1);
      }, 2500);
    }
  };

  const onPaste = async () => {
    try {
      let text = await Clipboard.getStringAsync();
      // A `veritas://…` payload copied as a link lands in iOS's URL pasteboard,
      // where getStringAsync comes back empty — fall back to the URL slot.
      if (
        (!text || !text.trim()) &&
        typeof Clipboard.getUrlAsync === "function"
      ) {
        try {
          text = (await Clipboard.getUrlAsync()) ?? "";
        } catch {
          // no URL on the clipboard either
        }
      }
      if (!text || !text.trim()) {
        setError("Clipboard is empty.");
        return;
      }
      handleData(text);
    } catch {
      setError("Couldn't read the clipboard.");
    }
  };

  return (
    <Layout scrollable={false} underHeader>
      <ScreenSubtitle>
        Scan a Trust ID from a Veritas client running locally on your machine.
      </ScreenSubtitle>

      <View style={styles.banner}>
        <AlertCircle size={20} color={colors.statusAmberFg} />
        <Text style={styles.bannerText}>
          Scan only from a local client — never a remote source.
        </Text>
      </View>

      <View style={styles.frame}>
        <View style={styles.camera}>
          <QrScanner
            key={scanNonce}
            active={isFocused && !busy}
            onScan={handleData}
            onError={setError}
          />
        </View>
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />
      </View>

      <Text style={styles.validity}>Valid for up to 14 days after scan</Text>

      {error && (
        <View style={styles.messageWrap}>
          <Message message={error} type="error" />
        </View>
      )}

      <TouchableOpacity style={styles.paste} onPress={onPaste}>
        <ClipboardIcon size={20} color={colors.text} />
        <Text style={styles.pasteText}>Paste from clipboard</Text>
      </TouchableOpacity>
    </Layout>
  );
}

const BRACKET = 34;
const THICK = 4;

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    back: {
      width: 22,
      height: 22,
      marginTop: 4,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: c.text,
      marginTop: 10,
    },
    subtitle: {
      fontSize: 15,
      color: c.textSecondary,
      marginTop: 6,
      marginBottom: 16,
    },
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.statusAmberBg,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 12,
      padding: 14,
      marginBottom: 20,
    },
    bannerText: {
      flex: 1,
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 18,
    },
    frame: {
      alignSelf: "center",
      width: 295,
      height: 295,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    camera: {
      ...StyleSheet.absoluteFill,
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
    validity: {
      fontSize: 13,
      color: c.textMuted,
      textAlign: "center",
      marginTop: 16,
    },
    messageWrap: {
      marginTop: 16,
    },
    paste: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 20,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 14,
      paddingVertical: 16,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    pasteText: {
      fontSize: 16,
      fontWeight: "500",
      color: c.text,
    },
  });
