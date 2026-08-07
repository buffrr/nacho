import React from "react";
import { Stack } from "expo-router";
import { PendingKeystoreProvider } from "@/PendingKeystore";

export default function OnboardingLayout() {
  return (
    <PendingKeystoreProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </PendingKeystoreProvider>
  );
}
