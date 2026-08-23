import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";
import { Button } from "@/ui/Button";
import { useTheme } from "@/theme";
import {
  AtSign,
  ShoppingBag,
  Check,
  Clock,
  ShieldX,
  AlertCircle,
  Search,
  SearchX,
  WifiOff,
} from "@/ui/icons";

// Web variant of NativeEmpty: the @expo/ui Column/Row/Spacer primitives don't lay
// out correctly on web (react-native-web), so the empty/error states rendered
// mis-aligned. This renders the same design with plain RN flexbox (reliable on
// web) + the app's SVG icons (SF Symbols don't exist on web). iOS keeps the
// native @expo/ui version (nativeEmpty.tsx) untouched.
type Action = { label: string; onPress: () => void };
type IconCmp = React.ComponentType<{ size?: number; color?: string }>;

const ICONS: Record<string, IconCmp> = {
  at: AtSign,
  bag: ShoppingBag,
  "checkmark.circle": Check,
  clock: Clock,
  "clock.arrow.circlepath": Clock,
  "exclamationmark.shield.fill": ShieldX,
  "exclamationmark.triangle": AlertCircle,
  magnifyingglass: Search,
  "questionmark.circle": SearchX,
  "wifi.slash": WifiOff,
};

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
  const { colors } = useTheme();
  const Ico = ICONS[sf] ?? AtSign;
  const glyph = iconColor ?? colors.textMuted;
  const badge = iconBg ?? (iconColor ? `${iconColor}22` : colors.surfaceSunken);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.badge, { backgroundColor: badge }]}>
        <Ico size={40} color={glyph} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {message ? (
        <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      ) : null}
      {primary ? (
        <View style={styles.primary}>
          <Button text={primary.label} onPress={primary.onPress} type="main" />
        </View>
      ) : null}
      {secondary ? (
        <TouchableOpacity onPress={secondary.onPress} style={styles.secondary}>
          <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>
            {secondary.label}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    paddingTop: 120,
    paddingHorizontal: 40,
  },
  badge: {
    width: 86,
    height: 86,
    borderRadius: 26,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 18,
  },
  message: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
  },
  primary: {
    alignSelf: "stretch",
    marginTop: 24,
  },
  secondary: {
    marginTop: 10,
    paddingVertical: 6,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
