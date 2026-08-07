import * as React from "react";
import { requireNativeView } from "expo";
import type { ScanViewProps } from "./ScanView.types";

export type { ScanViewProps };

// The native view registered by modules/ocr's ScanViewModule (Name("ScanView")).
const NativeScanView = requireNativeView<ScanViewProps>("ScanView");

export function ScanView(props: ScanViewProps) {
  return <NativeScanView {...props} />;
}
