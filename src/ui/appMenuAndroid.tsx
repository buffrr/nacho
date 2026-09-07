import React, { useState } from "react";
import { Host } from "@expo/ui";
import { Text } from "@/ui/text";
import { IconButton, DropdownMenu, DropdownMenuItem } from "@expo/ui/jetpack-compose";
import { router } from "expo-router";
import type { SFSymbol } from "sf-symbols-typescript";
import { Icon } from "@/ui/icon";
import { useTheme } from "@/theme";

// Android header controls. The native-stack `unstable_headerLeftItems` /
// `unstable_headerRightItems` (iOS UIMenu) don't render on Android, so on
// Android we render these RN `headerLeft`/`headerRight` components instead —
// each a Compose view (Host) hosting an @expo/ui IconButton + DropdownMenu.
// iOS keeps its native items untouched (see appMenu.ts / the layout Platform
// split).

// Hamburger → Trust / Settings dropdown (mirrors appMenuLeftItems on iOS).
export function AppMenuAndroid({ tint }: { tint: string }) {
  const { scheme } = useTheme();
  const [open, setOpen] = useState(false);
  const go = (path: string) => {
    setOpen(false);
    router.push(path as never);
  };
  return (
    <Host matchContents colorScheme={scheme}>
      <DropdownMenu expanded={open} onDismissRequest={() => setOpen(false)}>
        <DropdownMenu.Trigger>
          <IconButton onClick={() => setOpen(true)}>
            <Icon name="line.3.horizontal" color={tint} size={24} />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          <DropdownMenuItem onClick={() => go("/(main)/trust")}>
            <DropdownMenuItem.LeadingIcon>
              <Icon name="checkmark.shield" size={20} color={tint} />
            </DropdownMenuItem.LeadingIcon>
            <DropdownMenuItem.Text>
              <Text>Trust</Text>
            </DropdownMenuItem.Text>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => go("/(main)/preferences")}>
            <DropdownMenuItem.LeadingIcon>
              <Icon name="gearshape" size={20} color={tint} />
            </DropdownMenuItem.LeadingIcon>
            <DropdownMenuItem.Text>
              <Text>Settings</Text>
            </DropdownMenuItem.Text>
          </DropdownMenuItem>
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}

// A single-action header icon button (e.g. the "+" add-handle).
export function HeaderIconButtonAndroid({
  tint,
  sf,
  onPress,
}: {
  tint: string;
  sf: SFSymbol;
  onPress: () => void;
}) {
  const { scheme } = useTheme();
  return (
    <Host matchContents colorScheme={scheme}>
      <IconButton onClick={onPress}>
        <Icon name={sf} color={tint} size={24} />
      </IconButton>
    </Host>
  );
}
