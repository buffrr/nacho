import { Share } from "react-native";
import type { NativeStackHeaderItem } from "@react-navigation/native-stack";

// Universal link for a handle — opens in the app if installed, else the web
// profile (nacho.io AASA claims /*@* paths). Handles contain "@", which is a
// valid path char, so no encoding is needed for a clean shareable URL.
export function handleUrl(handle: string): string {
  return `https://nacho.io/${handle}`;
}

// Open the iOS share sheet for a handle's universal link.
export function shareHandle(handle: string): void {
  const url = handleUrl(handle);
  Share.share({ url, title: handle }).catch(() => {});
}

// A native header-right "Share" button (SF Symbol) for the resolved-handle views.
export function shareHeaderItem(handle: string): NativeStackHeaderItem {
  return {
    type: "button",
    label: "Share",
    accessibilityLabel: "Share handle",
    icon: { type: "sfSymbol", name: "square.and.arrow.up" },
    onPress: () => shareHandle(handle),
  };
}
