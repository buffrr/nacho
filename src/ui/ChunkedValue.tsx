import React from "react";
import { Text, StyleSheet, TextStyle, StyleProp } from "react-native";

// U+2009 thin space between groups.
const THIN_SPACE = " ";

// Renders a key/address in monospace, split into thin-space-separated groups so
// characters are comparable across lines (design-notes.md §7). Used for transfer
// recipients, address records, and payout addresses — never raw hex in a blob.
export function ChunkedValue({
  value,
  groupSize = 4,
  style,
}: {
  value: string;
  groupSize?: number;
  style?: StyleProp<TextStyle>;
}) {
  const groups = value.match(new RegExp(`.{1,${groupSize}}`, "g")) ?? [value];
  return (
    <Text style={[styles.mono, style]} selectable>
      {groups.join(THIN_SPACE)}
    </Text>
  );
}

const styles = StyleSheet.create({
  mono: {
    fontFamily: "monospace",
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.3,
    lineHeight: 22,
  },
});
