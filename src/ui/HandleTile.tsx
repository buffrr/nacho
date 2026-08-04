import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Colors, useTheme } from "@/theme";
import { Pill } from "@/handleTile";
import { AvatarColors } from "@/handleTile";
import { AtSign, ChevronRight } from "@/ui/icons";

export function HandleTile({
  handle,
  pill,
  avatar,
  onPress,
}: {
  handle: string;
  pill: Pill;
  avatar: AvatarColors;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
        <AtSign size={24} color={avatar.fg} />
      </View>
      <View style={styles.mid}>
        <Text style={styles.name} numberOfLines={1}>
          {handle}
        </Text>
        <View style={[styles.pill, { backgroundColor: pill.bg }]}>
          <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
        </View>
      </View>
      <ChevronRight size={18} color={colors.iconDefault} />
    </TouchableOpacity>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 18,
      padding: 14,
      marginBottom: 12,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    mid: {
      flex: 1,
      gap: 7,
    },
    name: {
      fontSize: 16,
      fontWeight: "500",
      color: c.text,
    },
    pill: {
      alignSelf: "flex-start",
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 8,
    },
    pillText: {
      fontSize: 12,
      fontWeight: "500",
    },
  });
