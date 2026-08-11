import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Colors, useTheme } from "@/theme";
import { TileInfo } from "@/handleTile";
import { Avatar } from "@/ui/Avatar";
import { ChevronRight, ShieldCheck, Clock, AlertCircle } from "@/ui/icons";

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
  onPress,
}: {
  handle: string;
  info: TileInfo;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={[styles.row, info.attention && styles.rowAttention]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Avatar handle={handle} size={44} />
      <View style={styles.mid}>
        {/* Name + status + chevron share the top line (Messages style); the
            chevron top-aligns with the name and the subtitle spans full width. */}
        <View style={styles.topRow}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {handle}
            </Text>
            <StatusIcon info={info} c={colors} />
          </View>
          <ChevronRight size={15} color={colors.chevron} strokeWidth={2} />
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
    </TouchableOpacity>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    // Plain full-width row (no card/divider); content aligned to the standard
    // 20px content margin, press highlight spans the full width.
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    // Needs-action rows get a subtle amber wash rather than a border.
    rowAttention: {
      backgroundColor: c.statusAmberBg,
    },
    mid: {
      flex: 1,
      gap: 3,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    nameRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    name: {
      fontSize: 17,
      fontWeight: "600",
      color: c.text,
      flexShrink: 1,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: "400",
      color: c.textMuted,
    },
  });
