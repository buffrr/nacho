import React from "react";
import { Stack } from "expo-router";
import { RecordsDraftProvider } from "@/RecordsDraft";

// The tabs live in (tabs); every detail screen is a SIBLING of (tabs) in this
// Stack, so pushing one stacks it ABOVE the native tab bar and Back returns to
// whichever tab was active. register-hub is a transparent modal (it draws its
// own backdrop + slide-up sheet).
export default function MainLayout() {
  return (
    <RecordsDraftProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="register-hub"
          options={{
            presentation: "transparentModal",
            animation: "none",
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
      </Stack>
    </RecordsDraftProvider>
  );
}
