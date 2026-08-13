import React from "react";
import type { SFSymbol } from "sf-symbols-typescript";
import { Host, Column, Row, Spacer, Icon, Text } from "@expo/ui";
import { useTheme } from "@/theme";
import { ActionFooter } from "@/ui/actionFooter";

type Action = { label: string; onPress: () => void };

// A native (@expo/ui) empty / status / error state: a tinted rounded icon badge,
// title and message sat in the upper third of the screen, with any actions in a
// pinned bottom ActionFooter (the app's full-width button — consistent with the
// rest of the native screens). Used for the Handles / Recents / Shop / Search
// empty + error states.
export function NativeEmpty({
  sf,
  title,
  message,
  primary,
  secondary,
  iconColor,
  iconBg,
}: {
  sf: SFSymbol;
  title: string;
  message?: string;
  primary?: Action;
  secondary?: Action;
  iconColor?: string;
  iconBg?: string;
}) {
  const { scheme, colors } = useTheme();
  const glyph = iconColor ?? colors.textMuted;
  const badge = iconBg ?? (iconColor ? `${iconColor}22` : colors.surfaceSunken);

  return (
    <>
      <Host style={{ flex: 1 }} colorScheme={scheme}>
        {/* Outer Column: fixed gap from the top, the content block, then a
            flexible spacer that expands the column to full height and pins the
            block up. */}
        <Column spacing={0}>
          <Spacer size={96} />
          {/* Row + flexible spacers = full-width horizontal centering. */}
          <Row alignment="center">
            <Spacer flexible />
            <Column alignment="center" spacing={0} style={{ paddingHorizontal: 40 }}>
              <Column
                alignment="center"
                spacing={0}
                style={{ width: 86, height: 86, borderRadius: 26, backgroundColor: badge }}
              >
                <Spacer flexible />
                <Icon name={sf} size={40} color={glyph} />
                <Spacer flexible />
              </Column>

              <Spacer size={18} />
              <Text
                textStyle={{
                  fontSize: 22,
                  fontWeight: "700",
                  color: colors.text,
                  textAlign: "center",
                }}
              >
                {title}
              </Text>

              {message ? (
                <>
                  <Spacer size={8} />
                  <Text
                    textStyle={{
                      fontSize: 15,
                      color: colors.textSecondary,
                      textAlign: "center",
                      lineHeight: 20,
                    }}
                  >
                    {message}
                  </Text>
                </>
              ) : null}
            </Column>
            <Spacer flexible />
          </Row>
          <Spacer flexible />
        </Column>
      </Host>
      {primary || secondary ? (
        <ActionFooter primary={primary} secondary={secondary} />
      ) : null}
    </>
  );
}
