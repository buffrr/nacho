import React, { useState } from "react";
import { Platform, View } from "react-native";
import { Host, Button } from "@expo/ui";
import { Text } from "@/ui/text";
import { IconButton, DropdownMenu, DropdownMenuItem } from "@expo/ui/jetpack-compose";
import type { NativeStackHeaderItem } from "@react-navigation/native-stack";
import type { SFSymbol } from "sf-symbols-typescript";
import { Icon } from "@/ui/icon";
import { useTheme } from "@/theme";

// Renders @react-navigation native-stack header items (iOS-only — they don't
// render on Android) as Android header controls: buttons → IconButton / text
// Button, menus → a Material DropdownMenu. Pass the SAME NativeStackHeaderItem[]
// the iOS path uses; see headerRightItemsOption below to wire it per-platform.
// Each control gets its own <Host> (a Host wrapping a Row collapses to 0 width
// in a header slot), laid out in a plain RN row.

const DANGER = "#E5484D";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyItem = any;

function sfName(icon: AnyItem): SFSymbol | undefined {
  return icon && icon.type === "sfSymbol" ? (icon.name as SFSymbol) : undefined;
}

// A matchContents Host collapses to 0 inside an RN View, so each control gets an
// explicit-size Host that the RN row can measure.
const ICON_HOST = { width: 44, height: 48 } as const;
const TEXT_HOST = { height: 48, minWidth: 96 } as const;

function MenuNode({ item, tint }: { item: AnyItem; tint: string }) {
  const { scheme } = useTheme();
  const [open, setOpen] = useState(false);
  const trigger = sfName(item.icon) ?? ("ellipsis" as SFSymbol);
  return (
    <Host style={ICON_HOST} colorScheme={scheme}>
      <DropdownMenu expanded={open} onDismissRequest={() => setOpen(false)}>
        <DropdownMenu.Trigger>
          <IconButton onClick={() => setOpen(true)}>
            <Icon name={trigger} color={tint} size={24} />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {(item.menu?.items ?? []).map((a: AnyItem, i: number) => {
            const icon = sfName(a.icon);
            const color = a.destructive ? DANGER : tint;
            return (
              <DropdownMenuItem
                key={i}
                onClick={() => {
                  setOpen(false);
                  a.onPress?.();
                }}
              >
                {icon ? (
                  <DropdownMenuItem.LeadingIcon>
                    <Icon name={icon} size={20} color={color} />
                  </DropdownMenuItem.LeadingIcon>
                ) : null}
                <DropdownMenuItem.Text>
                  <Text textStyle={a.destructive ? { color: DANGER } : undefined}>
                    {a.label}
                  </Text>
                </DropdownMenuItem.Text>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}

function ItemNode({ item, tint }: { item: AnyItem; tint: string }) {
  const { scheme } = useTheme();
  if (item.type === "menu") return <MenuNode item={item} tint={tint} />;
  if (item.type === "spacing" || item.type === "custom") return null;
  const icon = sfName(item.icon);
  if (icon) {
    return (
      <Host style={ICON_HOST} colorScheme={scheme}>
        <IconButton onClick={item.onPress} enabled={item.disabled !== true}>
          <Icon name={icon} color={item.tintColor ?? tint} size={24} />
        </IconButton>
      </Host>
    );
  }
  return (
    <Host style={TEXT_HOST} colorScheme={scheme}>
      <Button
        variant="text"
        onPress={item.onPress}
        disabled={item.disabled}
        label={item.label}
      />
    </Host>
  );
}

export function AndroidHeaderItems({
  items,
  tint,
}: {
  items: NativeStackHeaderItem[];
  tint: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      {(items as AnyItem[]).map((item, i) => (
        <ItemNode key={i} item={item} tint={tint} />
      ))}
    </View>
  );
}

// Platform-split header option: iOS keeps its native UIMenu items; Android
// renders the RN equivalents. Spread into a Stack.Screen `options` object.
export function headerRightItemsOption(items: NativeStackHeaderItem[], tint: string) {
  return Platform.OS === "ios"
    ? { unstable_headerRightItems: () => items }
    : { headerRight: () => <AndroidHeaderItems items={items} tint={tint} /> };
}

export function headerLeftItemsOption(items: NativeStackHeaderItem[], tint: string) {
  return Platform.OS === "ios"
    ? { unstable_headerLeftItems: () => items }
    : { headerLeft: () => <AndroidHeaderItems items={items} tint={tint} /> };
}
