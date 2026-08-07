import React from "react";
import { Stack, router } from "expo-router";
import type { NativeStackHeaderItem } from "@react-navigation/native-stack";
import { useTheme } from "@/theme";

// The "+" (Register a handle) as a native bar-button item (SF Symbol), memoized
// with stable deps + the imported `router` singleton so its identity doesn't
// churn across renders. Uses unstable_headerRightItems (native item) rather than
// headerRight (a hosted RN view).
export default function HandlesTabLayout() {
  const { colors } = useTheme();

  const rightItems = React.useMemo<NativeStackHeaderItem[]>(
    () => [
      {
        type: "button",
        label: "Add handle",
        identifier: "handles-add",
        icon: { type: "sfSymbol", name: "plus" },
        tintColor: colors.accent,
        onPress: () => router.push("/(main)/register-hub"),
      },
    ],
    [colors.accent],
  );

  const options = React.useMemo(
    () => ({
      title: "Handles",
      headerLargeTitle: false,
      headerTransparent: true,
      headerShadowVisible: false,
      headerTintColor: colors.text,
      headerTitleStyle: { color: colors.text },
      unstable_headerRightItems: () => rightItems,
    }),
    [colors.text, rightItems],
  );

  return (
    <Stack>
      <Stack.Screen name="index" options={options} />
    </Stack>
  );
}
