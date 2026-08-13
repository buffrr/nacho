import React, { useId } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Circle } from "react-native-svg";
import { AtSign } from "@/ui/icons";
import { avatarGradient } from "@/handleTile";
import { useTheme } from "@/theme";

// The single source of the handle-avatar look (used in the list, handle screen,
// Shop and Resolve so it stays consistent): a circular vertical gradient with a
// white @ glyph — calm, Messages/Contacts style. Gradient via react-native-svg
// (already a dep — no native gradient module needed).
export function Avatar({ handle, size = 44 }: { handle: string; size?: number }) {
  // Unique gradient id per instance (RNSVG registers ids; colons from useId
  // aren't valid in a url(#…) reference).
  const gid = "ag" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const { scheme } = useTheme();
  const [from, to] = avatarGradient(handle, scheme);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gid})`} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <AtSign size={Math.round(size * 0.5)} color="#FFFFFF" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
