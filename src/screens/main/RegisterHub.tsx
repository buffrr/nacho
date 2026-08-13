import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Colors, useTheme } from "@/theme";
import {
  Storefront,
  Ticket,
  Key,
  FileText,
  ChevronRight,
  IconProps,
} from "@/ui/icons";

type Option = {
  title: string;
  subtitle: string;
  Icon: (p: IconProps) => React.JSX.Element;
  go: () => void;
};

// Rendered inside a native formSheet (see app/(main)/_layout.tsx) — the OS
// provides the backdrop, slide-up, grabber and drag-to-dismiss. Options are
// grouped into inset cards (img_18): the common ways up top, external-source
// ways under a labelled section (Import private key kept last).
export default function RegisterHub() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Dismiss the sheet, then run the chosen flow so it reads as one motion.
  const select = (go: () => void) => () => {
    router.back();
    go();
  };

  const groups: { label?: string; items: Option[] }[] = [
    {
      items: [
        {
          title: "Shop for a handle",
          subtitle: "Browse and buy",
          Icon: Storefront,
          go: () => router.push("/(main)/shop"),
        },
        {
          title: "Redeem a code",
          subtitle: "Voucher or gift code",
          Icon: Ticket,
          go: () => router.push("/(main)/redeem"),
        },
      ],
    },
    {
      label: "EXTERNAL SOURCE",
      items: [
        {
          title: "Create a request",
          subtitle: "Generate a key and request inclusion",
          Icon: FileText,
          go: () => router.push("/(main)/create-request"),
        },
        {
          title: "Import a private key",
          subtitle: "Restore a handle you own elsewhere",
          Icon: Key,
          go: () => router.push("/(main)/import-keypair"),
        },
      ],
    },
  ];

  return (
    <View style={styles.sheet}>
      <Text style={styles.title}>Add a handle</Text>

      {groups.map((group, gi) => (
        <View key={gi} style={styles.section}>
          {group.label ? (
            <Text style={styles.sectionLabel}>{group.label}</Text>
          ) : null}
          <View style={styles.group}>
            {group.items.map(({ title, subtitle, Icon, go }, i) => (
              <React.Fragment key={title}>
                {i > 0 && <View style={styles.divider} />}
                <TouchableOpacity
                  style={styles.row}
                  onPress={select(go)}
                  activeOpacity={0.6}
                >
                  {/* Neutral secondary tint — accent-coloured icons here read
                      less native than a calm monochrome row. */}
                  <Icon size={24} color={colors.textSecondary} />
                  <View style={styles.mid}>
                    <Text style={styles.rowTitle}>{title}</Text>
                    <Text style={styles.rowSub}>{subtitle}</Text>
                  </View>
                  <ChevronRight size={18} color={colors.iconDefault} />
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    sheet: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: c.text,
      marginBottom: 8,
    },
    section: {
      marginBottom: 4,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.6,
      color: c.textMuted,
      marginTop: 16,
      marginBottom: 4,
    },
    // Flat rows directly on the sheet (no card bg), separated by a hairline.
    group: {},
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 14,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      // Inset past the icon (icon 24 + gap 14).
      marginLeft: 38,
    },
    mid: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: c.text,
    },
    rowSub: {
      fontSize: 13,
      color: c.textSecondary,
    },
  });
