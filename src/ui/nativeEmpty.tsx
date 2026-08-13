import React from "react";
import type { SFSymbol } from "sf-symbols-typescript";
import { Host, Column, Row, Spacer, Icon, Text, Button } from "@expo/ui";
import { useTheme } from "@/theme";

type Action = { label: string; onPress: () => void };

// A native (@expo/ui) empty / status state: centered icon + title + message and
// up to two actions. Used for the Handles / Recents / Shop empty + error states.
export function NativeEmpty({
  sf,
  title,
  message,
  primary,
  secondary,
  iconColor,
}: {
  sf: SFSymbol;
  title: string;
  message?: string;
  primary?: Action;
  secondary?: Action;
  iconColor?: string;
}) {
  const { scheme, colors } = useTheme();
  return (
    <Host style={{ flex: 1 }} colorScheme={scheme}>
      {/* Row+Spacer centers horizontally; top padding drops it below the header. */}
      <Row alignment="center" style={{ paddingTop: 92, paddingHorizontal: 32 }}>
        <Spacer />
        <Column alignment="center" spacing={10}>
          <Icon name={sf} size={46} color={iconColor ?? colors.textMuted} />
          <Text textStyle={{ fontSize: 20, fontWeight: "700" }}>{title}</Text>
          {message ? (
            <Text textStyle={{ fontSize: 14, color: colors.textSecondary }}>
              {message}
            </Text>
          ) : null}
          {primary ? (
            <Button label={primary.label} variant="filled" onPress={primary.onPress} />
          ) : null}
          {secondary ? (
            <Button label={secondary.label} variant="text" onPress={secondary.onPress} />
          ) : null}
        </Column>
        <Spacer />
      </Row>
    </Host>
  );
}
