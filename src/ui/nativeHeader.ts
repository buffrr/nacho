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
