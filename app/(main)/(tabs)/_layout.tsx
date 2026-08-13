import React from "react";
import { Platform } from "react-native";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTheme } from "@/theme";

// Native OS tab bar (iOS 26 Liquid Glass), `tintColor` = the nacho accent for
// the active tab. iOS uses crisp SF Symbols (they render + animate natively);
// Android/web fall back to the custom nacho glyph PNGs (template-tinted). Trust
// + Settings live in the header hamburger (src/ui/appMenu); Shop is reached from
// the Handles list + the "+" sheet. The bar is Handles / Recents / Scan, plus
// the search (Resolve) as the trailing native search item on iOS 26.
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
      {/* Recents — handles resolved before. Android reuses the handles glyph as a
          placeholder until a dedicated recents.png ships (iOS uses the SF clock). */}
      <NativeTabs.Trigger name="recents">
        {isIOS ? (
          <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" />
        ) : (
          <NativeTabs.Trigger.Icon src={PNG.handles} renderingMode="template" />
        )}
        <NativeTabs.Trigger.Label>Recents</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scan">
        {isIOS ? (
          <NativeTabs.Trigger.Icon sf="qrcode.viewfinder" />
        ) : (
          <NativeTabs.Trigger.Icon src={PNG.scan} renderingMode="template" />
        )}
        <NativeTabs.Trigger.Label>Scan</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* role="search" → native iOS search tab (systemItem search); on iOS 26 it
          renders as the trailing search icon that expands into a bottom search
          field. The system title becomes "Search". Kept last so it sits at the end. */}
      <NativeTabs.Trigger name="resolve" role="search">
        {isIOS ? (
          <NativeTabs.Trigger.Icon sf="magnifyingglass" />
        ) : (
          <NativeTabs.Trigger.Icon src={PNG.resolve} renderingMode="template" />
        )}
        <NativeTabs.Trigger.Label>Resolve</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
