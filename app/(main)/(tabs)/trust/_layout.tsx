import React from "react";
import { Stack, useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { useTheme } from "@/theme";
import { nativeHeader } from "@/ui/nativeHeader";
import { Settings as SettingsIcon } from "@/ui/icons";

// The gear (→ Preferences) that used to sit next to the in-content "Trust"
// title becomes a native headerRight button.
function GearButton() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => router.push("/(main)/preferences")}
      hitSlop={8}
      accessibilityLabel="Settings"
    >
      <SettingsIcon size={22} color={colors.text} />
    </TouchableOpacity>
  );
}

export default function TrustTabLayout() {
  const { colors } = useTheme();
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          ...nativeHeader(colors),
          title: "Trust",
          headerRight: () => <GearButton />,
        }}
      />
    </Stack>
  );
}
