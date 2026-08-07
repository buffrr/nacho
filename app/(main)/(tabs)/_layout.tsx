import React from "react";
import { NativeTabs } from "expo-router/unstable-native-tabs";

// Native OS tab bar (iOS 26 Liquid Glass). Icons are SF Symbols for now; Phase 3
// swaps the `sf=` for custom accent-tinted `src=` image assets. Trigger `name`
// must match the route filenames in this dir (handles/shop/resolve/trust).
export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="handles">
        <NativeTabs.Trigger.Icon sf="at" />
        <NativeTabs.Trigger.Label>Handles</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="shop">
        <NativeTabs.Trigger.Icon sf="bag" />
        <NativeTabs.Trigger.Label>Shop</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="resolve">
        <NativeTabs.Trigger.Icon sf="arrow.left.arrow.right" />
        <NativeTabs.Trigger.Label>Resolve</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="trust">
        <NativeTabs.Trigger.Icon sf="checkmark.shield" />
        <NativeTabs.Trigger.Label>Trust</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
