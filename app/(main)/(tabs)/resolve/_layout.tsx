import React from "react";
import { Stack, router } from "expo-router";
import type { NativeStackHeaderItem } from "@react-navigation/native-stack";
import { useTheme } from "@/theme";
import { nativeHeader } from "@/ui/nativeHeader";

export default function ResolveTabLayout() {
  const { colors } = useTheme();
  // A back-to-Handles button rather than the hamburger: the search tab is easy to
  // land on (or expand into) without an obvious way back to the handles list.
  const leftItems = React.useMemo<NativeStackHeaderItem[]>(
    () => [
      {
        type: "button",
        label: "Handles",
        identifier: "resolve-back",
        icon: { type: "sfSymbol", name: "chevron.backward" },
        tintColor: colors.text,
        onPress: () => router.navigate("/(main)/(tabs)/handles"),
      },
    ],
    [colors.text],
  );
  const options = React.useMemo(
    () => ({
      ...nativeHeader(colors),
      title: "Resolve",
      unstable_headerLeftItems: () => leftItems,
    }),
    [colors, leftItems],
  );
  return (
    <Stack>
      <Stack.Screen name="index" options={options} />
    </Stack>
  );
}
