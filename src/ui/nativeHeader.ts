import { Platform } from "react-native";
import type { Colors } from "@/theme";

// iOS renders a transparent nav bar and applies its own scroll-edge glass as
// content scrolls under it (the safe-area still insets the content). Android has
// no such glass: a transparent header there means content renders UNDERNEATH the
// bar with no inset — the title overlaps the first rows. So Android gets an
// opaque header (content sits below it), iOS keeps the transparent glass.
const HEADER_TRANSPARENT = Platform.OS === "ios";
// Android uses an opaque header (content sits below it); give it the theme
// background. iOS keeps a transparent glass header — no headerStyle bg there, or
// it would paint over the glass.
const androidHeaderStyle = (bg: string) =>
  Platform.OS === "android" ? { headerStyle: { backgroundColor: bg } } : {};

// Shared native-stack header options for the tab screens.
export function nativeHeader(colors: Colors) {
  return {
    headerLargeTitle: false,
    headerTransparent: HEADER_TRANSPARENT,
    headerShadowVisible: false,
    headerTintColor: colors.text,
    headerTitleStyle: { color: colors.text },
    // Native content bg = theme, so no white flashes behind the header during
    // transitions (the native container defaults to white).
    ...androidHeaderStyle(colors.background),
    contentStyle: { backgroundColor: colors.background },
  };
}

// Detail-screen header (same treatment as the tab screens, minus the large
// title). iOS: transparent glass, content scrolls under. Android: opaque, content
// sits below. A screen that wants a large title opts in per-screen.
export function solidNativeHeader(colors: Colors) {
  return {
    headerLargeTitle: false,
    headerTransparent: HEADER_TRANSPARENT,
    headerShadowVisible: false,
    headerTintColor: colors.text,
    headerTitleStyle: { color: colors.text },
    ...androidHeaderStyle(colors.background),
    contentStyle: { backgroundColor: colors.background },
  };
}
