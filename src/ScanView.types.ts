import type { ViewProps } from "react-native";

// Props for the native real-time scanner view (see modules/ocr). Events arrive
// wrapped in `nativeEvent` (standard for Expo native views).
export type ScanViewProps = ViewProps & {
  // Run the capture session (tie to screen focus).
  active?: boolean;
  // Emit detections (set false while a result is locked to freeze scanning
  // without tearing down the preview).
  scanning?: boolean;
  onBarcode?: (e: { nativeEvent: { data: string } }) => void;
  onText?: (e: { nativeEvent: { lines: string[] } }) => void;
};
