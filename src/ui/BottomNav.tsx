import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import { HandlesStackParamList } from "@/Navigation";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/theme";

type Active = "handles" | "settings";

type Nav = NativeStackNavigationProp<HandlesStackParamList>;

function HandlesIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7h16M4 12h16M4 17h16"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function SettingsIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
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
  );
}

function PlusIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function BottomNav({ active }: { active: Active }) {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const ACTIVE = colors.accent;
  const INACTIVE = colors.textMuted;

  return (
    <View style={[styles.bar, { borderTopColor: colors.border }]}>
      <TouchableOpacity
        style={styles.item}
        onPress={() => navigation.navigate("ListHandles")}
        accessibilityRole="button"
        accessibilityLabel="Handles"
      >
        <HandlesIcon color={active === "handles" ? ACTIVE : INACTIVE} />
        <Text
          style={[
            styles.label,
            { color: active === "handles" ? ACTIVE : INACTIVE },
          ]}
        >
          Handles
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.item}
        onPress={() => navigation.navigate("CreateRequest", {})}
        accessibilityRole="button"
        accessibilityLabel="Create request"
      >
        <View style={styles.plusButton}>
          <PlusIcon />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.item}
        onPress={() => navigation.navigate("Settings")}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <SettingsIcon color={active === "settings" ? ACTIVE : INACTIVE} />
        <Text
          style={[
            styles.label,
            { color: active === "settings" ? ACTIVE : INACTIVE },
          ]}
        >
          Settings
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#1F1F1F",
    // Cancel the Layout footer's horizontal padding so the bar spans full width.
    marginHorizontal: -20,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
  },
  plusButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FF7B00",
    alignItems: "center",
    justifyContent: "center",
  },
});
