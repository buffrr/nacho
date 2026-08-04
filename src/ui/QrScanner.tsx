import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTheme } from "@/theme";

export type QrScannerProps = {
  // Only scan while the screen is focused; toggling this resets the one-shot latch.
  active: boolean;
  onScan: (data: string) => void;
  onError?: (message: string) => void;
};

export function QrScanner({ active, onScan }: QrScannerProps) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const latched = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  // Re-arm the single-fire latch each time the screen becomes active again.
  useEffect(() => {
    if (active) latched.current = false;
  }, [active]);

  if (!permission) {
    return <View style={StyleSheet.absoluteFill} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.prompt}>
        <Text style={[styles.promptText, { color: "#FFFFFF" }]}>
          Camera access is needed to scan QR codes.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={[styles.promptBtn, { backgroundColor: colors.accent }]}
        >
          <Text style={styles.promptBtnText}>Enable camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <CameraView
      style={StyleSheet.absoluteFill}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      onBarcodeScanned={
        active
          ? ({ data }) => {
              if (latched.current || !data) return;
              latched.current = true;
              onScan(data);
            }
          : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  prompt: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 14,
  },
  promptText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  promptBtn: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  promptBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
