import * as React from "react";
import { View, StyleSheet } from "react-native";
import { CameraView } from "expo-camera";
import type { ScanViewProps } from "./ScanView.types";

export type { ScanViewProps };

// Android has no native OCR pipeline here — real-time text recognition would
// need ML Kit + CameraX (substantial Kotlin). Fall back to QR-only via
// expo-camera: onText never fires, so the Scan screen simply relies on QR.
// Printed handles (OCR) aren't read on Android for now.
export function ScanView({ active, scanning, onBarcode, style }: ScanViewProps) {
  if (active === false) {
    // Release the camera when the tab isn't focused.
    return <View style={[styles.black, style]} />;
  }
  const canScan = scanning !== false && !!onBarcode;
  return (
    <CameraView
      style={[StyleSheet.absoluteFill, style]}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      onBarcodeScanned={
        canScan ? ({ data }) => onBarcode?.({ nativeEvent: { data } }) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: "#000000" },
});