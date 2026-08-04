import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { HandlesStackParamList } from "@/Navigation";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/theme";
import { AtSign, ShoppingBag, ArrowLeftRight, ShieldCheck, IconProps } from "@/ui/icons";

type Active = "handles" | "shop" | "resolve" | "trust";

type Nav = NativeStackNavigationProp<HandlesStackParamList>;

const TABS: {
  key: Active;
  label: string;
  route: keyof HandlesStackParamList;
  Icon: (p: IconProps) => React.JSX.Element;
}[] = [
  { key: "handles", label: "Handles", route: "ListHandles", Icon: AtSign },
  { key: "shop", label: "Shop", route: "Shop", Icon: ShoppingBag },
  { key: "resolve", label: "Resolve", route: "Resolve", Icon: ArrowLeftRight },
  { key: "trust", label: "Trust", route: "Settings", Icon: ShieldCheck },
];

export function BottomNav({ active }: { active: Active }) {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();

  return (
    <View style={[styles.bar, { backgroundColor: colors.card }]}>
      <View style={[styles.hairline, { backgroundColor: colors.border }]} />
      {TABS.map(({ key, label, route, Icon }) => {
        const color = active === key ? colors.accent : colors.textMuted;
        return (
          <TouchableOpacity
            key={key}
            style={styles.item}
            onPress={() => navigation.navigate(route as any)}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Icon size={24} color={color} />
            <Text style={[styles.label, { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    // Cancel the Layout footer's horizontal padding so the bar spans full width.
    marginHorizontal: -20,
    paddingHorizontal: 8,
    // Symmetric so the icon+label pair sits vertically centred in the bar.
    paddingVertical: 10,
  },
  hairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
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
});
