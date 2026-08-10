import React from "react";
import { Stack } from "expo-router";
import { appMenuLeftItems } from "@/ui/appMenu";

// The Scan screen is a full-bleed camera, so the header is transparent and its
// tint is forced white (readable over the dark camera regardless of app theme).
export default function ScanTabLayout() {
  const leftItems = React.useMemo(() => appMenuLeftItems("#FFFFFF"), []);
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Scan",
          headerTransparent: true,
          headerShadowVisible: false,
          headerTintColor: "#FFFFFF",
          headerTitleStyle: { color: "#FFFFFF" },
          contentStyle: { backgroundColor: "#000000" },
          unstable_headerLeftItems: () => leftItems,
        }}
      />
    </Stack>
  );
}
