import React from "react";
import { List as SwiftUIList } from "@expo/ui/swift-ui";
import {
  listStyle,
  refreshable,
  scrollContentBackground,
  type ModifierConfig,
} from "@expo/ui/swift-ui/modifiers";

// iOS list rendered edge-to-edge. The universal List wraps a SwiftUI List with
// the default `.insetGrouped` style, which insets rows into rounded cards with
// large side margins. Here we drop to the swift-ui List directly so we can apply
// `.listStyle(.plain)` (full-width rows) and hide the list's own scroll
// background (rows paint their own via listRowBackground). Web/Android use the
// universal List (PlainList.tsx).
export function PlainList({
  children,
  onRefresh,
}: {
  children: React.ReactNode;
  onRefresh?: () => Promise<void>;
}) {
  const modifiers: ModifierConfig[] = [
    listStyle("plain"),
    scrollContentBackground("hidden"),
  ];
  if (onRefresh) modifiers.push(refreshable(onRefresh));
  return <SwiftUIList modifiers={modifiers}>{children}</SwiftUIList>;
}
