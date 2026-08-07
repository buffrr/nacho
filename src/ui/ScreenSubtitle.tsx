import React from "react";
import { Text, StyleSheet } from "react-native";
import { Colors, useTheme } from "@/theme";

// The muted intro line that used to live in ScreenHeader's `subtitle`. Now that
// screens use native headers (title + back), the explanatory subtitle moves into
// the content as the first element.
export function ScreenSubtitle({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return <Text style={styles.subtitle}>{children}</Text>;
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    subtitle: {
      fontSize: 15,
      lineHeight: 21,
      color: c.textSecondary,
      marginBottom: 20,
    },
  });
