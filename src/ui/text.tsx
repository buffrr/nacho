import React from "react";
import { Platform } from "react-native";
import type { ComponentProps } from "react";
import { Text as ExpoText } from "@expo/ui";
import { useTheme } from "@/theme";

type Props = ComponentProps<typeof ExpoText>;

// Drop-in @expo/ui <Text>. On ANDROID, @expo/ui's Text hardcodes `Color.Black`
// when no color is set (TextView.kt), so any uncolored Text is invisible in dark
// mode — we default the color to the theme's text color there. On iOS it's a
// passthrough (iOS Text already uses the adaptive label color — leave it exactly
// as-is). An explicit `textStyle.color` always wins (spread last).
export function Text({ textStyle, ...rest }: Props) {
  const { colors } = useTheme();
  const base = Platform.OS === "android" ? { color: colors.text } : undefined;
  return (
    <ExpoText textStyle={{ ...base, ...(textStyle ?? {}) }} {...rest} />
  );
}
