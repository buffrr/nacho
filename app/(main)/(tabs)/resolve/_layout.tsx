import React from "react";
import { Stack } from "expo-router";
import { useTheme } from "@/theme";
import { nativeHeader } from "@/ui/nativeHeader";

export default function ResolveTabLayout() {
  const { colors } = useTheme();
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ ...nativeHeader(colors), title: "Resolve" }}
      />
    </Stack>
  );
}
