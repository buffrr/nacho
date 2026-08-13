import React from "react";
import { Stack, router } from "expo-router";
import type { NativeStackHeaderItem } from "@react-navigation/native-stack";
import { useTheme } from "@/theme";
import { solidNativeHeader } from "@/ui/nativeHeader";
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

  // The transparent (glass) detail header, applied PER detail screen — not as the
  // stack's screenOptions, because that would leak `headerTransparent: true` onto
  // the index and kill the large-title scroll-edge glass + collapse.
  const detail = solidNativeHeader(colors);

  // Base for a large-title screen (Add record): tints + dark content, but NO
  // `headerTransparent` — the large-title scroll-edge glass needs it unset (same
  // as the index). The screen itself opts into `headerLargeTitle`.
  const largeTitle = {
    headerTintColor: colors.text,
    headerTitleStyle: { color: colors.text },
    headerLargeTitleStyle: { color: colors.text },
    contentStyle: { backgroundColor: colors.background },
  };

  // Detail screens live INSIDE the Handles tab stack (not as siblings of the tab
  // group), so drilling Handles → ShowHandle → EditRecord is a native in-stack
  // push (shared nav bar, tab bar stays visible) rather than a whole-screen slide.
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Screen name="index" options={options} />
      {/* Shop lives in the Handles stack so Handles → Shop → ShowHandle pushes
          in-stack (Back from a handle returns to the Shop results). Large title. */}
      <Stack.Screen name="shop" options={largeTitle} />
      {/* view-handle: read-only resolved view (e.g. tapping a taken shop result). */}
      <Stack.Screen name="view-handle" options={{ ...detail, title: "" }} />
      {/* show-handle / add-record / edit-record set their own titles in-component. */}
      <Stack.Screen name="show-handle" options={detail} />
      <Stack.Screen name="add-record" options={largeTitle} />
      <Stack.Screen name="edit-record" options={detail} />
      <Stack.Screen name="handle-action" options={{ ...detail, title: "Handle" }} />
      <Stack.Screen name="cancel-offers" options={{ ...detail, title: "Cancel offers" }} />
      <Stack.Screen name="import-certificate" options={{ ...detail, title: "Import certificate" }} />
      <Stack.Screen name="import-keypair" options={{ ...detail, title: "Import keypair" }} />
    </Stack>
  );
}
