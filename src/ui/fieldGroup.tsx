import React from "react";
import { Platform, StyleSheet } from "react-native";
import { FieldGroup as ExpoFieldGroup } from "@expo/ui";
import { useTheme } from "@/theme";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof ExpoFieldGroup>;

// @expo/ui's FieldGroup defaults its Android background to the Material `surface`
// charcoal (a wallpaper-tinted grey), which clashes with our pure-black (#000)
// native header — the grouped body reads as a different shade than the header
// above it. Pin the background to colors.background on Android so the body
// matches the header and gets the same pure-black grouped look as iOS (cards
// stay on Material `surfaceContainer`). The android impl spreads `style`, so we
// flatten to a single object. iOS uses the native Form and is passed through
// untouched (bg is null there).
export function FieldGroup({ style, ...rest }: Props) {
  const { colors } = useTheme();
  const bg =
    Platform.OS === "android" ? { backgroundColor: colors.background } : null;
  return <ExpoFieldGroup style={StyleSheet.flatten([bg, style])} {...rest} />;
}

FieldGroup.Section = ExpoFieldGroup.Section;
FieldGroup.SectionHeader = ExpoFieldGroup.SectionHeader;
FieldGroup.SectionFooter = ExpoFieldGroup.SectionFooter;
