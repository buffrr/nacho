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
  return (
    <RecordsDraftProvider>
      <Stack
        screenOptions={{
          ...solidNativeHeader(colors),
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
        {/* show-handle + edit-record + view-handle set their titles in-component. */}
        <Stack.Screen name="view-handle" options={{ title: "" }} />
        <Stack.Screen name="shop" options={{ title: "Shop" }} />
        <Stack.Screen name="trust" options={{ title: "Trust" }} />
        <Stack.Screen name="create-request" options={{ title: "Create a request" }} />
        <Stack.Screen name="import-keypair" options={{ title: "Import keypair" }} />
        <Stack.Screen
          name="import-certificate"
          options={{ title: "Import certificate" }}
        />
        <Stack.Screen name="redeem" options={{ title: "Redeem code" }} />
        <Stack.Screen name="sign" options={{ title: "Approve request" }} />
        <Stack.Screen name="handle-action" options={{ title: "Handle" }} />
        <Stack.Screen name="cancel-offers" options={{ title: "Cancel offers" }} />
        <Stack.Screen name="preferences" options={{ title: "Settings" }} />
        <Stack.Screen name="verify-anchor" options={{ title: "Verify anchor" }} />
        <Stack.Screen name="trust-approve" options={{ title: "Trust ID" }} />
        <Stack.Screen name="reveal-seed" options={{ title: "Seed phrase" }} />
      </Stack>
    </RecordsDraftProvider>
  );
}
