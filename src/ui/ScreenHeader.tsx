import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Colors, useTheme } from "@/theme";
import { ArrowLeft } from "@/ui/icons";

// The v2 Flows header: an optional back chevron, a single bold title, and a
// muted subtitle — left-aligned, matching every screen in the Figma flows.
export function ScreenHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      {onBack && (
        <TouchableOpacity
          onPress={onBack}
          hitSlop={8}
          style={styles.back}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
      )}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wrap: {
      marginBottom: 24,
    },
    back: {
      width: 22,
      height: 22,
      marginTop: 4,
      marginBottom: 10,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: c.text,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 21,
      color: c.textSecondary,
      marginTop: 8,
    },
  });
