import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { useTheme } from "@/theme";

interface HeaderProps {
  headText: string;
  tailText: string;
  subText?: string;
}

export function Header({ headText, tailText, subText }: HeaderProps) {
  const { colors } = useTheme();
  return (
    <>
      <View style={styles.header}>
        <Text style={[styles.orangeText, { color: colors.accent }]}>
          {headText}{" "}
        </Text>
        <Text style={[styles.whiteText, { color: colors.text }]}>
          {tailText}
        </Text>
      </View>
      {subText && (
        <Text style={[styles.subheader, { color: colors.textMuted }]}>
          {subText}
        </Text>
      )}
    </>
  );
}

interface SubheaderProps {
  text: string;
}

export function Subheader({ text }: SubheaderProps) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.subheader, { color: colors.textMuted }]}>{text}</Text>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  orangeText: {
    fontSize: 28,
    fontWeight: "bold",
  },
  whiteText: {
    fontSize: 28,
    fontWeight: "bold",
  },
  subheader: {
    fontSize: 18,
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
});
