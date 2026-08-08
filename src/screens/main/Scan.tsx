import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from "react-native";
import { useCameraPermissions } from "expo-camera";
import { useIsFocused, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, useTheme } from "@/theme";
import { AtSign, Zap, ScanIcon } from "@/ui/icons";
import { interpret, matchOcrLines, ScanInput } from "@/scanInput";
import { extractReqParam } from "@/signRequest";
import { ScanView } from "@/ScanView";

const NOTICE_THROTTLE = 2000; // ms between "not a payment code" notices

function shorten(value: string): string {
  if (value.length <= 30) return value;
  return `${value.slice(0, 16)}…${value.slice(-8)}`;
}

// Dual-detector scanner. The native ScanView (modules/ocr) runs QR (metadata
// output, instant) and OCR (Vision on live video frames) at once and emits both
// as events; this screen owns arbitration. A single `lockedRef` arbitrates:
// whichever detector produces an ACCEPTED result first locks both until dismissed,
// so a QR and an OCR hit can't race into two results. `scanning` (= no result yet)
// gates native emission; the preview keeps running while locked. See
// src/scanInput.ts for the accept grammars.
export default function Scan() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();

  const lockedRef = useRef(false); // pauses BOTH detectors once a result locks
  const ocrStreakRef = useRef<string | null>(null); // last OCR match (streak)
  const noticeAtRef = useRef(0); // last throttled-notice timestamp

  const [result, setResult] = useState<ScanInput | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  // Re-arm both detectors whenever the tab regains focus (fresh scan).
  useEffect(() => {
    if (isFocused) {
      lockedRef.current = false;
      ocrStreakRef.current = null;
      setResult(null);
      setNotice(null);
    }
  }, [isFocused]);

  const lock = useCallback((input: ScanInput) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    ocrStreakRef.current = null;
    setNotice(null);
    setResult(input);
  }, []);

  // QR: the native event firing is the detection (checksum-validated). Accept
  // only a recognized payload; an unrecognized QR is a non-event — don't lock,
  // keep scanning, show a throttled notice (this is what lets a card with a
  // foreign QR + a printed handle resolve to the handle via OCR).
  const onBarcode = useCallback(
    (e: { nativeEvent: { data: string } }) => {
      const data = e.nativeEvent?.data;
      if (lockedRef.current || !data) return;
      const parsed = interpret(data);
      if (
        parsed.kind === "handle" ||
        parsed.kind === "uri" ||
        parsed.kind === "sign"
      ) {
        lock(parsed);
      } else {
        const now = Date.now();
        if (now - noticeAtRef.current > NOTICE_THROTTLE) {
          noticeAtRef.current = now;
          setNotice("That QR isn't a handle or payment code");
          setTimeout(() => setNotice(null), 1800);
        }
      }
    },
    [lock],
  );

  // OCR: the native view emits recognized lines per frame. Vision gives no
  // confidence scores, so require two consecutive identical matches before
  // locking (agreement is the proxy — kills single-frame misreads like
  // a1ice@bitcoin).
  const onText = useCallback(
    (e: { nativeEvent: { lines: string[] } }) => {
      if (lockedRef.current) return;
      const match = matchOcrLines(e.nativeEvent?.lines ?? []);
      if (match) {
        if (ocrStreakRef.current === match.value) {
          lock(match); // second identical sighting → confident
        } else {
          ocrStreakRef.current = match.value; // first sighting
        }
      } else {
        ocrStreakRef.current = null; // miss breaks the streak
      }
    },
    [lock],
  );

  const scanAgain = () => {
    lockedRef.current = false;
    ocrStreakRef.current = null;
    setResult(null);
  };

  const act = () => {
    if (!result) return;
    if (result.kind === "handle") {
      router.navigate({
        pathname: "/(main)/(tabs)/resolve",
        params: { prefill: result.value },
      });
    } else if (result.kind === "uri") {
      Linking.openURL(result.value).catch(() => {});
    }
  };

  // A signing request goes straight to its confirmation screen (which is the
  // real gate) rather than through the result card. Returning to this tab
  // re-arms scanning via the focus effect above.
  useEffect(() => {
    if (result?.kind === "sign") {
      const req = extractReqParam(result.value);
      router.push({ pathname: "/(main)/sign", params: { req: req ?? "" } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  if (!permission) {
    return <View style={styles.root} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.center]}>
        <ScanIcon size={44} color="#FFFFFF" />
        <Text style={styles.permText}>
          Camera access is needed to scan QR codes and handles.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Enable camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isHandle = result?.kind === "handle";

  return (
    <View style={styles.root}>
      <ScanView
        style={StyleSheet.absoluteFill}
        active={isFocused}
        scanning={isFocused && !result}
        onBarcode={onBarcode}
        onText={onText}
      />

      {/* Instruction hint */}
      {!result && (
        <View
          style={[styles.hint, { top: insets.top + 60 }]}
          pointerEvents="none"
        >
          <Text style={styles.hintText}>
            Point at a QR code or a printed handle
          </Text>
        </View>
      )}

      {/* Throttled unrecognized-QR notice */}
      {notice && !result && (
        <View
          style={[styles.notice, { bottom: insets.bottom + 130 }]}
          pointerEvents="none"
        >
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}

      {/* Locked result (sign requests navigate away instead of showing a card) */}
      {result && result.kind !== "sign" && (
        <View style={[styles.card, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.cardRow}>
            <View style={styles.cardIcon}>
              {isHandle ? (
                <AtSign size={22} color={colors.accent} />
              ) : (
                <Zap size={22} color={colors.accent} />
              )}
            </View>
            <View style={styles.cardMid}>
              <Text style={styles.cardLabel}>
                {isHandle ? "Handle detected" : "Payment code detected"}
              </Text>
              <Text style={styles.cardValue} numberOfLines={1}>
                {shorten(result.value)}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={act}>
            <Text style={styles.primaryBtnText}>
              {isHandle ? "Resolve" : "Open"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={scanAgain}>
            <Text style={styles.secondaryBtnText}>Scan again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: "#000000",
    },
    center: {
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      gap: 16,
    },
    permText: {
      color: "#FFFFFF",
      fontSize: 15,
      textAlign: "center",
      lineHeight: 21,
    },
    permBtn: {
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    permBtnText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "600",
    },
    hint: {
      position: "absolute",
      left: 0,
      right: 0,
      alignItems: "center",
    },
    hintText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "500",
      textShadowColor: "rgba(0,0,0,0.6)",
      textShadowRadius: 6,
    },
    notice: {
      position: "absolute",
      left: 24,
      right: 24,
      alignItems: "center",
    },
    noticeText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "500",
      backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: 20,
      overflow: "hidden",
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    card: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 22,
      gap: 12,
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginBottom: 4,
    },
    cardIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: c.accent + "22",
      alignItems: "center",
      justifyContent: "center",
    },
    cardMid: {
      flex: 1,
      gap: 3,
    },
    cardLabel: {
      fontSize: 13,
      color: c.textSecondary,
      fontWeight: "500",
    },
    cardValue: {
      fontSize: 17,
      color: c.text,
      fontWeight: "600",
      fontFamily: "monospace",
    },
    primaryBtn: {
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
    },
    primaryBtnText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
    },
    secondaryBtn: {
      paddingVertical: 12,
      alignItems: "center",
    },
    secondaryBtnText: {
      color: c.textSecondary,
      fontSize: 15,
      fontWeight: "500",
    },
  });
