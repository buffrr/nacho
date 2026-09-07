import React from "react";
import { Row, Column, Spacer } from "@expo/ui";
import { Text } from "@/ui/text";
import { fillMaxWidth, weight, padding } from "@expo/ui/jetpack-compose/modifiers";
import type { ComponentProps } from "react";
import { ListItem as ExpoListItem } from "@expo/ui";

type Props = ComponentProps<typeof ExpoListItem>;

// Compose can't render bare strings — wrap them in <Text>.
function node(n: React.ReactNode): React.ReactNode {
  return typeof n === "string" || typeof n === "number" ? <Text>{String(n)}</Text> : n;
}

// Android parity fix. @expo/ui's FieldSection.android already wraps EACH child in
// its own Compose ListItem (surfaceContainer, rounded, the "connected list"
// look). Using the real @expo/ui <ListItem> here would nest a SECOND Material
// ListItem inside it — a white elevated card inside the grey row (the double
// surface). Instead we render the row as a plain Row (leading + label/supporting
// + trailing) so FieldSection surfaces it exactly once. iOS/web keep the real
// ListItem (see listItem.ios.tsx / listItem.tsx). Same prop API as @expo/ui's
// ListItem so call sites don't change.
export function ListItem({
  children,
  onPress,
  leading,
  trailing,
  supportingText,
  modifiers,
}: Props) {
  return (
    <Row
      alignment="center"
      spacing={14}
      onPress={onPress}
      // Own padding so rows have height + edge insets whether they sit in a
      // plain @expo/ui List (no row chrome — otherwise flush to the screen edge)
      // or inside a FieldSection (whose ListItem enforces a 56dp min).
      modifiers={[fillMaxWidth(), padding(16, 14, 16, 14), ...(modifiers ?? [])]}
    >
      {leading ?? null}
      <Column spacing={1} modifiers={[weight(1)]}>
        {node(children)}
        {supportingText != null ? node(supportingText) : null}
      </Column>
      {trailing != null ? <Spacer size={12} /> : null}
      {trailing ?? null}
    </Row>
  );
}
