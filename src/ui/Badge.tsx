import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/theme";

interface BadgeProps {
  label: string;
  color: string;
}

export function Badge({ label, color }: BadgeProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
  },
});
