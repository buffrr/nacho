import React from "react";
import { Stack } from "expo-router";
import { useTheme } from "@/theme";
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

  return (
    <Stack>
      <Stack.Screen name="index" options={options} />
    </Stack>
  );
}
