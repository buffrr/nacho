import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors, useTheme } from "@/theme";
import {
  Storefront,
  Ticket,
  Key,
  AtSign,
  ChevronRight,
  X,
  IconProps,
} from "@/ui/icons";

// Rendered inside a native formSheet (see app/(main)/_layout.tsx) — the OS
// provides the backdrop, slide-up, grabber and drag-to-dismiss, so this just
// lays out the content.
export default function RegisterHub() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Dismiss the sheet, then run the chosen flow so it reads as one motion.
  const select = (go: () => void) => () => {
    router.back();
    go();
  };

  const options: {
    title: string;
    subtitle: string;
    Icon: (p: IconProps) => React.JSX.Element;
    bg: string;
    go: () => void;
  }[] = [
    {
      title: "Shop for a handle",
      subtitle: "Browse and buy available handles",
      Icon: Storefront,
      bg: colors.tileOrangeBg,
      go: () => router.navigate("/(main)/(tabs)/shop"),
    },
    {
      title: "Redeem a code",
      subtitle: "Have a voucher or gift code",
      Icon: Ticket,
      bg: colors.tileLavenderBg,
      go: () => router.push("/(main)/redeem"),
    },
    {
      title: "Create a request",
      subtitle: "Setup a key pair and create inclusion request",
      Icon: AtSign,
      bg: colors.tileGoldBg,
      go: () => router.push("/(main)/create-request"),
    },
    {
      title: "Import private key",
      subtitle: "Already own a handle elsewhere",
      Icon: Key,
      bg: colors.tileTealBg,
      go: () => router.push("/(main)/import-keypair"),
    },
  ];

  return (
    <View
      style={[
        styles.sheet,
        { backgroundColor: colors.background, paddingBottom: insets.bottom + 12 },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Register a handle</Text>
          <Text style={styles.subtitle}>
            Choose how you'd like to add a handle.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.closeBtn}
        >
          <X size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {options.map(({ title, subtitle, Icon, bg, go }) => (
        <TouchableOpacity
          key={title}
          style={styles.option}
          onPress={select(go)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconBox, { backgroundColor: bg }]}>
            <Icon size={26} color={colors.text} />
          </View>
          <View style={styles.optionMid}>
            <Text style={styles.optionTitle}>{title}</Text>
            <Text style={styles.optionSub}>{subtitle}</Text>
          </View>
          <ChevronRight size={18} color={colors.iconDefault} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    sheet: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    headerText: {
      flex: 1,
      gap: 6,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: c.text,
    },
    subtitle: {
      fontSize: 15,
      color: c.textSecondary,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.field,
      alignItems: "center",
      justifyContent: "center",
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: c.card,
      borderRadius: 18,
      borderCurve: "continuous",
      padding: 14,
      marginBottom: 12,
    },
    iconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    optionMid: {
      flex: 1,
      gap: 3,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: c.text,
    },
    optionSub: {
      fontSize: 13,
      color: c.textSecondary,
    },
  });
