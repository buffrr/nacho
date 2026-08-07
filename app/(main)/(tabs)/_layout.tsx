import React from "react";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTheme } from "@/theme";

// Native OS tab bar (iOS 26 Liquid Glass). `tintColor` sets the active tab to
// the nacho accent. Icons are custom nacho glyphs shipped as template PNGs
// (black-on-transparent), so the OS tints them (accent when selected, grey
// otherwise) — and unlike SF Symbols, `src` renders on iOS + Android + web.
// Trigger `name` must match the route filenames in this dir.
const TAB_ICONS = {
  handles: require("../../../assets/tabs/handles.png"),
  shop: require("../../../assets/tabs/shop.png"),
  resolve: require("../../../assets/tabs/resolve.png"),
  trust: require("../../../assets/tabs/trust.png"),
};

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <NativeTabs tintColor={colors.accent}>
      <NativeTabs.Trigger name="handles">
        <NativeTabs.Trigger.Icon src={TAB_ICONS.handles} renderingMode="template" />
        <NativeTabs.Trigger.Label>Handles</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="shop">
        <NativeTabs.Trigger.Icon src={TAB_ICONS.shop} renderingMode="template" />
        <NativeTabs.Trigger.Label>Shop</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="resolve">
        <NativeTabs.Trigger.Icon src={TAB_ICONS.resolve} renderingMode="template" />
        <NativeTabs.Trigger.Label>Resolve</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="trust">
        <NativeTabs.Trigger.Icon src={TAB_ICONS.trust} renderingMode="template" />
        <NativeTabs.Trigger.Label>Trust</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
