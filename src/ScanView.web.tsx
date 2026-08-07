import * as React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { ScanViewProps } from "./ScanView.types";

export type { ScanViewProps };

// Web has no native camera pipeline; the Scan tab shows a note. (Native scanning
// lives in the AVFoundation view in modules/ocr.)
export function ScanView({ style }: ScanViewProps) {
  return (
    <View style={[styles.root, style]}>
      <Text style={styles.text}>Scanning is available in the mobile app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    padding: 32,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 15,
    textAlign: "center",
  },
});
