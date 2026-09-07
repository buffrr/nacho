import React from "react";
import { Stack, router } from "expo-router";
import type { NativeStackHeaderItem } from "@react-navigation/native-stack";
import { useTheme } from "@/theme";
import { nativeHeader, solidNativeHeader } from "@/ui/nativeHeader";
import { headerLeftItemsOption } from "@/ui/androidHeaderItems";

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
      ...headerLeftItemsOption(leftItems, colors.text),
    }),
    [colors, leftItems],
  );
  // A buyable handle opened from search results pushes WITHIN this stack so Back
  // returns to the results. Once purchased, ShowHandle re-roots to the Handles
  // tab (see dismissOnboarding) so Back then goes to the Handles list.
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Screen name="index" options={options} />
      <Stack.Screen name="show-handle" options={solidNativeHeader(colors)} />
      {/* Read-only resolved view (e.g. tapping a taken shop result). */}
      <Stack.Screen name="view-handle" options={{ ...solidNativeHeader(colors), title: "" }} />
    </Stack>
  );
}
