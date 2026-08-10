import React from "react";
import { Stack } from "expo-router";
import { useTheme } from "@/theme";
import { nativeHeader } from "@/ui/nativeHeader";
import { appMenuLeftItems } from "@/ui/appMenu";

export default function ResolveTabLayout() {
  const { colors } = useTheme();
  const leftItems = React.useMemo(
    () => appMenuLeftItems(colors.text),
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
