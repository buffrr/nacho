import React from "react";
import { Platform } from "react-native";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTheme } from "@/theme";

// Native OS tab bar (iOS 26 Liquid Glass), `tintColor` = the nacho accent for
// the active tab. iOS uses crisp SF Symbols (they render + animate natively);
// Android/web fall back to the custom nacho glyph PNGs (template-tinted). Trust
// + Settings live in the header hamburger (src/ui/appMenu); Shop is reached from
// the Handles list + the "+" sheet — so the bar is just Handles / Resolve / Scan.
const isIOS = Platform.OS === "ios";
const PNG = {
  handles: require("../../../assets/tabs/handles.png"),
  resolve: require("../../../assets/tabs/resolve.png"),
  scan: require("../../../assets/tabs/scan.png"),
};

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <NativeTabs tintColor={colors.accent}>
      <NativeTabs.Trigger name="handles">
        {isIOS ? (
          <NativeTabs.Trigger.Icon sf="at" />
        ) : (
          <NativeTabs.Trigger.Icon src={PNG.handles} renderingMode="template" />
        )}
        <NativeTabs.Trigger.Label>Handles</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="resolve">
        {isIOS ? (
          <NativeTabs.Trigger.Icon sf="magnifyingglass" />
        ) : (
          <NativeTabs.Trigger.Icon src={PNG.resolve} renderingMode="template" />
        )}
        <NativeTabs.Trigger.Label>Resolve</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scan">
        {isIOS ? (
          <NativeTabs.Trigger.Icon sf="qrcode.viewfinder" />
        ) : (
          <NativeTabs.Trigger.Icon src={PNG.scan} renderingMode="template" />
        )}
        <NativeTabs.Trigger.Label>Scan</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
