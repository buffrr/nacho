import type { Colors } from "@/theme";

// Shared native-stack header options for the tab screens: a transparent inline
// header (iOS applies its own subtle scroll-edge glass as content scrolls under
// it) with the title/tint forced to read correctly in the app's theme.
export function nativeHeader(colors: Colors) {
  return {
    headerLargeTitle: false,
    headerTransparent: true,
    headerShadowVisible: false,
    headerTintColor: colors.text,
    headerTitleStyle: { color: colors.text },
    // Native content bg = theme, so no white flashes behind the (transparent)
    // header during transitions (the native container defaults to white).
    contentStyle: { backgroundColor: colors.background },
  };
}

// Detail-screen header: a transparent native nav bar (same treatment as the tab
// screens, minus the large title) so content scrolls UNDER it instead of being
// hard-cut by a flat opaque fill. The dark `contentStyle` guards against white
// flashes during the push. A screen that wants a large title (Add record, Shop)
// opts in per-screen with `headerLargeTitle: true`.
export function solidNativeHeader(colors: Colors) {
  return {
    headerLargeTitle: false,
    headerTransparent: true,
    headerShadowVisible: false,
    headerTintColor: colors.text,
    headerTitleStyle: { color: colors.text },
    contentStyle: { backgroundColor: colors.background },
  };
}
