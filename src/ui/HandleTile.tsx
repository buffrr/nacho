import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Colors, useTheme } from "@/theme";
import { AvatarColors, TileInfo } from "@/handleTile";
import {
  AtSign,
  ChevronRight,
  ShieldCheck,
  Clock,
  AlertCircle,
} from "@/ui/icons";

// Inline status glyph next to the name (img_11): sovereign → green shield,
// waiting-for-cert → grey clock, attention → amber alert. A handle that already
// holds a temporary/dependent/pending cert is the quiet default → no glyph.
function StatusIcon({ info, c }: { info: TileInfo; c: Colors }) {
  switch (info.status) {
    case "sovereign":
      return <ShieldCheck size={15} color={c.statusGreenFg} strokeWidth={2.2} />;
    case "waiting":
      return <Clock size={15} color={c.statusGreyFg} strokeWidth={2.2} />;
    case "attention":
      return <AlertCircle size={15} color={c.statusAmberFg} strokeWidth={2.2} />;
    default:
      return null;
  }
}

export function HandleTile({
  handle,
  info,
  avatar,
  onPress,
}: {
  handle: string;
  info: TileInfo;
  avatar: AvatarColors;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={[styles.card, info.attention && styles.cardAttention]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
        <AtSign size={24} color={avatar.fg} />
      </View>
      <View style={styles.mid}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {handle}
          </Text>
          <StatusIcon info={info} c={colors} />
        </View>
        <Text
          style={[
            styles.subtitle,
            info.attention && { color: colors.statusAmberFg },
          ]}
          numberOfLines={1}
        >
          {info.subtitle}
        </Text>
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
      // Fill, not border; continuous (squircle) corners read as native on iOS.
      borderRadius: 16,
      borderCurve: "continuous",
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginBottom: 10,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },
    cardAttention: {
      borderWidth: 1,
      borderColor: c.accent,
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
      gap: 3,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    name: {
      fontSize: 16,
      fontWeight: "500",
      color: c.text,
      flexShrink: 1,
    },
    subtitle: {
      fontSize: 13,
      fontWeight: "400",
      color: c.textMuted,
    },
  });
