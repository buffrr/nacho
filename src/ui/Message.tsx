import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, useTheme } from "@/theme";

interface MessageProps {
  message: string;
  type: "success" | "error";
}

export function Message({ message, type }: MessageProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View
      style={[
        styles.container,
        type === "success" ? styles.containerSuccess : styles.containerError,
      ]}
    >
      <Text
        style={[
          styles.text,
          type === "success" ? styles.textSuccess : styles.textError,
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      borderRadius: 8,
      borderCurve: "continuous",
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginTop: 20,
      marginBottom: 20,
    },
    text: {
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
    },
    containerSuccess: {
      backgroundColor: c.successBg,
    },
    textSuccess: {
      color: c.successText,
    },
    containerError: {
      backgroundColor: c.dangerBg,
    },
    textError: {
      color: c.dangerText,
    },
  });
