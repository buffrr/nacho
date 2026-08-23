import { router } from "expo-router";
import type { NativeStackHeaderItem } from "@react-navigation/native-stack";

// The top-left hamburger — a native UIMenu shared by the main tab screens giving
// quick access to Trust + Settings, which are no longer their own tabs. `tint`
// is the icon colour (theme text on the opaque tab headers; white over the
// Scan camera). Uses the `router` singleton so the item identity stays stable.
export function appMenuLeftItems(tint: string): NativeStackHeaderItem[] {
  return [
    {
      type: "menu",
      label: "Menu",
      identifier: "app-menu",
      icon: { type: "sfSymbol", name: "line.3.horizontal" },
      tintColor: tint,
      menu: {
        items: [
          {
            type: "action",
            label: "Trust",
            icon: { type: "sfSymbol", name: "checkmark.shield" },
            onPress: () => router.push("/(main)/trust"),
          },
          {
            type: "action",
            label: "Settings",
            icon: { type: "sfSymbol", name: "gearshape" },
            onPress: () => router.push("/(main)/preferences"),
          },
        ],
      },
    },
  ];
}
