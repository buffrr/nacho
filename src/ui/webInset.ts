import { Platform } from "react-native";

// On web, expo-router Native Tabs render as a top bar that overlaps the @expo/ui
// Host content (there's no native nav header reserving space like on iOS). Pad
// the top of Host-based screens by this much on web only — 0 on native, so iOS
// is untouched.
export const WEB_TOP_INSET = Platform.OS === "web" ? 52 : 0;
