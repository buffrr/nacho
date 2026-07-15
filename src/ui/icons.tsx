import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Path, Line } from "react-native-svg";

interface IconButtonProps {
  onPress: () => void;
  color?: string;
  size?: number;
  accessibilityLabel?: string;
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    justifyContent: "center",
    alignItems: "center",
  },
});

export function PlusButton({
  onPress,
  color = "#FF7B00",
  size = 26,
  accessibilityLabel = "Add",
}: IconButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Line
          x1="12"
          y1="5"
          x2="12"
          y2="19"
          stroke={color}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <Line
          x1="5"
          y1="12"
          x2="19"
          y2="12"
          stroke={color}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </Svg>
    </TouchableOpacity>
  );
}

export function GearButton({
  onPress,
  color = "#FFFFFF",
  size = 24,
  accessibilityLabel = "Settings",
}: IconButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
          stroke={color}
          strokeWidth="1.8"
        />
        <Path
          d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8.4 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 3.6 8.4a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H8a1.65 1.65 0 0 0 1-1.51V2a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V8a1.65 1.65 0 0 0 1.51 1H22a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </TouchableOpacity>
  );
}

export function SearchButton({
  onPress,
  color = "#FF7B00",
  size = 24,
  accessibilityLabel = "Resolve a handle",
}: IconButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </TouchableOpacity>
  );
}

export function TrashButton({
  onPress,
  color = "#FF4D4D",
  size = 22,
  accessibilityLabel = "Remove",
}: IconButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6M10 11v6M14 11v6"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </TouchableOpacity>
  );
}
