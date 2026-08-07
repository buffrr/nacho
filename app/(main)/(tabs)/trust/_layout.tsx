import React from "react";
import { Stack, router } from "expo-router";
import type { NativeStackHeaderItem } from "@react-navigation/native-stack";
import { useTheme } from "@/theme";
import { nativeHeader } from "@/ui/nativeHeader";

// The gear (→ Preferences) as a native bar-button item (SF Symbol), memoized
// with the stable `router` singleton — consistent with the Handles "+".
export default function TrustTabLayout() {
  const { colors } = useTheme();

  const rightItems = React.useMemo<NativeStackHeaderItem[]>(
    () => [
      {
        type: "button",
        label: "Settings",
        identifier: "trust-settings",
        icon: { type: "sfSymbol", name: "gearshape" },
        tintColor: colors.text,
        onPress: () => router.push("/(main)/preferences"),
      },
    ],
    [colors.text],
  );

  const options = React.useMemo(
    () => ({
      ...nativeHeader(colors),
      title: "Trust",
      unstable_headerRightItems: () => rightItems,
    }),
    [colors, rightItems],
  );

  return (
    <Stack>
      <Stack.Screen name="index" options={options} />
    </Stack>
  );
}
