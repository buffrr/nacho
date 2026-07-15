import React, { useMemo } from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { Colors, useTheme } from "@/theme";

interface ButtonProps {
  text: string;
  onPress: () => void;
  type: "main" | "secondary" | "danger";
  disabled?: boolean;
}

export function Button({
  text,
  onPress,
  type = "main",
  disabled = false,
}: ButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const getButtonStyle = () => {
    switch (type) {
      case "main":
        return [
          styles.button,
          styles.mainButton,
          disabled && styles.mainButtonDisabled,
        ];
      case "danger":
        return [
          styles.button,
          styles.dangerButton,
          disabled && styles.dangerButtonDisabled,
        ];
      case "secondary":
        return [styles.button, styles.secondaryButton];
    }
  };

  const getTextStyle = () => {
    switch (type) {
      case "main":
        return [styles.buttonText, styles.mainButtonText];
      case "danger":
        return [
          styles.buttonText,
          styles.dangerButtonText,
          disabled && styles.dangerButtonTextDisabled,
        ];
      case "secondary":
        return [
          styles.buttonText,
          styles.secondaryButtonText,
          disabled && styles.secondaryButtonTextDisabled,
        ];
    }
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
    >
      <Text style={getTextStyle()}>{text}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    button: {
      borderRadius: 14,
      paddingVertical: 18,
      paddingHorizontal: 24,
      marginBottom: 16,
      alignItems: "center",
    },
    buttonText: {
      fontSize: 18,
      fontWeight: "400",
    },
    mainButton: {
      backgroundColor: c.accent,
    },
    mainButtonText: {
      color: c.accentText,
      fontWeight: "600",
    },
    mainButtonDisabled: {
      backgroundColor: c.accentDisabledBg,
    },
    secondaryButton: {
      backgroundColor: "transparent",
    },
    secondaryButtonText: {
      color: c.accent,
    },
    secondaryButtonTextDisabled: {
      color: c.accentMuted,
    },
    dangerButton: {
      backgroundColor: c.dangerBg,
    },
    dangerButtonText: {
      color: c.dangerText,
    },
    dangerButtonDisabled: {
      backgroundColor: c.dangerBgDisabled,
    },
    dangerButtonTextDisabled: {
      color: c.dangerTextDisabled,
    },
  });
