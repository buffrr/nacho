import React from "react";
import { List } from "@expo/ui";

// Cross-platform (web / Android) fallback: the universal List. iOS gets the
// swift-ui variant (PlainList.ios) which can apply `.listStyle(.plain)` for an
// edge-to-edge, full-width list. Same props on both so callers stay platform-
// agnostic.
export function PlainList({
  children,
  onRefresh,
}: {
  children: React.ReactNode;
  onRefresh?: () => Promise<void>;
}) {
  return <List onRefresh={onRefresh}>{children}</List>;
}
