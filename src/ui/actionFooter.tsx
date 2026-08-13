import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/ui/Button";
import { useTheme } from "@/theme";

type Primary = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  type?: "main" | "danger";
};
type Secondary = { label: string; onPress: () => void; disabled?: boolean };

// A pinned bottom action bar for the native (@expo/ui Host) screens: the app's
// full-width Button as the primary CTA + an optional text secondary. Sits below
// the native content (a real full-width button reads better than a native
// borderedProminent button squeezed into a Form row).
export function ActionFooter({
  primary,
  secondary,
}: {
  primary?: Primary;
  secondary?: Secondary;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.footer,
        { paddingBottom: insets.bottom + 8, backgroundColor: colors.background },
      ]}
    >
      {primary ? (
        <Button
          text={primary.label}
          onPress={primary.onPress}
          type={primary.type ?? "main"}
          disabled={primary.disabled}
        />
      ) : null}
      {secondary ? (
        <TouchableOpacity
          onPress={secondary.onPress}
          disabled={secondary.disabled}
          style={styles.secondary}
        >
          <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>
            {secondary.label}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingHorizontal: 20, paddingTop: 10 },
  secondary: { paddingVertical: 14, alignItems: "center" },
  secondaryText: { fontSize: 15, fontWeight: "500" },
});
