import React from "react";
import { Stack, router } from "expo-router";
import type { NativeStackHeaderItem } from "@react-navigation/native-stack";
import { useTheme } from "@/theme";
import { appMenuLeftItems } from "@/ui/appMenu";

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
        // Neutral tint (not the orange accent) — native bar buttons aren't the
        // brand colour.
        tintColor: colors.text,
        onPress: () => router.push("/(main)/register-hub"),
      },
    ],
    [colors.text],
  );

  const leftItems = React.useMemo(
    () => appMenuLeftItems(colors.text),
    [colors.text],
  );

  // Large iOS title (Messages/Settings style): renders left-aligned at rest and
  // collapses into the centred nav-bar title as the list scrolls. This must NOT
  // set headerTransparent — the scroll-edge glass that drives the collapse is
  // mutually exclusive with it. ListHandles' FlatList uses
  // contentInsetAdjustmentBehavior="automatic" so UIKit tracks the scroll.
  const options = React.useMemo(
    () => ({
      title: "Handles",
      headerLargeTitle: true,
      headerTintColor: colors.text,
      headerLargeTitleStyle: { color: colors.text },
      contentStyle: { backgroundColor: colors.background },
      unstable_headerLeftItems: () => leftItems,
      unstable_headerRightItems: () => rightItems,
    }),
    [colors.text, colors.background, leftItems, rightItems],
  );

  return (
    <Stack>
      <Stack.Screen name="index" options={options} />
    </Stack>
  );
}
