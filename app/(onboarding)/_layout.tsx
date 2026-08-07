import React from "react";
import { Stack } from "expo-router";
import { useTheme } from "@/theme";
import { solidNativeHeader } from "@/ui/nativeHeader";
import { PendingKeystoreProvider } from "@/PendingKeystore";

export default function OnboardingLayout() {
  const { colors } = useTheme();
  const detail = {
    ...solidNativeHeader(colors),
    headerShown: true,
    headerBackButtonDisplayMode: "minimal" as const,
  };
  return (
    <PendingKeystoreProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        {/* show-mnemonic + enter-mnemonic set their (dynamic) titles in-component. */}
        <Stack.Screen name="show-mnemonic" options={detail} />
        <Stack.Screen
          name="import-keystore"
          options={{ ...detail, title: "Restore from backup" }}
        />
        <Stack.Screen name="enter-mnemonic" options={detail} />
      </Stack>
    </PendingKeystoreProvider>
  );
}
