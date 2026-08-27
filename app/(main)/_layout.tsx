import React from "react";
import { Stack } from "expo-router";
import { RecordsDraftProvider } from "@/RecordsDraft";
import { useTheme } from "@/theme";
import { solidNativeHeader } from "@/ui/nativeHeader";

// The tabs live in (tabs); every detail screen is a SIBLING of (tabs) in this
// Stack, so pushing one stacks it ABOVE the native tab bar and Back returns to
// whichever tab was active. Detail screens get a native (solid, dark) back-header
// by default; (tabs) has its own headers and register-hub is a native sheet.
export default function MainLayout() {
  const { colors } = useTheme();

  // Transparent (glass) detail header — applied PER screen, NOT in screenOptions,
  // because `headerTransparent: true` leaks onto any large-title child and kills
  // its scroll-edge glass + collapse.
  const detail = solidNativeHeader(colors);

  return (
    <RecordsDraftProvider>
      <Stack
        screenOptions={{
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
          // Native content bg = theme, so no white flashes behind the header
          // during the push/slide (the native container defaults to white).
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="register-hub"
          options={{
            // Native iOS sheet (grabber, drag-to-dismiss, rounded, fits content).
            presentation: "formSheet",
            sheetAllowedDetents: "fitToContents",
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            headerShown: false,
            // Transparent container so the sheet's native (glass) material shows
            // through — the Stack's opaque `contentStyle` would otherwise cover it.
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        {/* Handle-detail subtree lives in the Handles tab stack; view-handle in
            the Recents tab stack; shop in the Handles tab stack — so each pushes
            in-stack with the tab bar visible (see the tab _layouts). */}
        <Stack.Screen name="trust" options={{ ...detail, title: "Trust" }} />
        <Stack.Screen name="create-request" options={{ ...detail, title: "Create a request" }} />
        <Stack.Screen name="redeem" options={{ ...detail, title: "Redeem code" }} />
        <Stack.Screen name="sign" options={{ ...detail, title: "Approve request" }} />
        <Stack.Screen name="preferences" options={{ ...detail, title: "Settings" }} />
        <Stack.Screen name="verify-anchor" options={{ ...detail, title: "Verify anchor" }} />
        <Stack.Screen name="trust-approve" options={{ ...detail, title: "Trust ID" }} />
        <Stack.Screen name="backup" options={{ ...detail, title: "Back up" }} />
        {/* Onboarding design preview (from Settings) — headerless so it looks
            exactly like the real first screen; swipe or its buttons dismiss it. */}
        <Stack.Screen
          name="onboarding-preview"
          options={{ headerShown: false, gestureEnabled: true }}
        />
      </Stack>
    </RecordsDraftProvider>
  );
}
