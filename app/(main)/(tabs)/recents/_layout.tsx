import React from "react";
import { Stack } from "expo-router";
import { useTheme } from "@/theme";
import { solidNativeHeader } from "@/ui/nativeHeader";
import { appMenuLeftItems } from "@/ui/appMenu";

// Recents: handles the user has resolved before (src/screens/main/Recents).
// Same large-title treatment as Handles; the Edit/Done button is a native
// header-right item set from the screen (it depends on list state). Trust +
// Settings stay in the left hamburger.
export default function RecentsTabLayout() {
  const { colors } = useTheme();

  const leftItems = React.useMemo(
    () => appMenuLeftItems(colors.text),
    [colors.text],
  );

  const options = React.useMemo(
    () => ({
      title: "Recents",
      headerLargeTitle: true,
      headerTintColor: colors.text,
      headerLargeTitleStyle: { color: colors.text },
      contentStyle: { backgroundColor: colors.background },
      unstable_headerLeftItems: () => leftItems,
    }),
    [colors.text, colors.background, leftItems],
  );

  // view-handle lives in THIS tab's stack (not as a sibling of the tab group) so
  // Recents → view-handle is a native in-stack push (tab bar stays, shared nav
  // bar). Transparent glass detail header applied per screen (see nativeHeader).
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Screen name="index" options={options} />
      <Stack.Screen name="view-handle" options={{ ...solidNativeHeader(colors), title: "" }} />
    </Stack>
  );
}
