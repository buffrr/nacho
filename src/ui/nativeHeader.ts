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

// Detail-screen header: the SAME large-title recipe as the Handles tab, so the
// nav bar carries iOS's scroll-edge "glass" (transparent at rest, blurred as the
// content scrolls under it). The glass is driven by `headerLargeTitle` + the
// native scroll-inset tracking — it is mutually exclusive with a forced
// `headerStyle.backgroundColor` (opaque) or `headerTransparent: true`, so we set
// neither. The dark `contentStyle` guards against white flashes during the push.
// Screens with a custom big profile header (show-handle / view-handle) opt out
// with `headerLargeTitle: false`.
export function solidNativeHeader(colors: Colors) {
  return {
    headerLargeTitle: true,
    headerShadowVisible: false,
    headerTintColor: colors.text,
    headerTitleStyle: { color: colors.text },
    headerLargeTitleStyle: { color: colors.text },
    contentStyle: { backgroundColor: colors.background },
  };
}
