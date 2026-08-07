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
  };
}

// Solid variant for detail screens: an opaque header the native stack lays
// content BELOW (so no contentInsetAdjustmentBehavior is needed → no conflict
// with the keyboard-aware scroll view on form screens).
export function solidNativeHeader(colors: Colors) {
  return {
    headerLargeTitle: false,
    headerTransparent: false,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.text,
    headerTitleStyle: { color: colors.text },
  };
}
