import React from "react";
import { Stack } from "expo-router";
import { RecordsDraftProvider } from "@/RecordsDraft";
import { useTheme } from "@/theme";
import { solidNativeHeader } from "@/ui/nativeHeader";

// The tabs live in (tabs); every detail screen is a SIBLING of (tabs) in this
// Stack, so pushing one stacks it ABOVE the native tab bar and Back returns to
// whichever tab was active. Detail screens get a native back-header; register-hub
// is a native form sheet.
export default function MainLayout() {
  const { colors } = useTheme();
  // Detail screens: native transparent header + a minimal (chevron-only) back
  // button. Titles are set here (static) or per-screen via <Stack.Screen>.
  const detail = {
    ...solidNativeHeader(colors),
    headerShown: true,
    headerBackButtonDisplayMode: "minimal" as const,
  };
  return (
    <RecordsDraftProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="register-hub"
          options={{
            // Native iOS sheet (UISheetPresentationController): grabber, drag-to-
            // dismiss, rounded corners — sized to its content. We let the sheet's
            // own native background show through (content is transparent) so it's
            // uniform to the bottom edge / home-indicator curve.
            presentation: "formSheet",
            sheetAllowedDetents: "fitToContents",
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            headerShown: false,
          }}
        />
        <Stack.Screen name="redeem" options={{ ...detail, title: "Redeem code" }} />
      </Stack>
    </RecordsDraftProvider>
  );
}
