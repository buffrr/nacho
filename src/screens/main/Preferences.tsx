import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Colors, ThemeMode, useTheme } from "@/theme";
import {
  getNetConfig,
  saveNetConfig,
  DEFAULT_NET_CONFIG,
  NetConfig,
} from "@/config";
import { Layout } from "@/ui/Layout";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { AlertCircle, X } from "@/ui/icons";


const MODES: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

type ListKey = "anchorRelays" | "seeds";

export default function Preferences() {
  const router = useRouter();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [conf, setConf] = useState<NetConfig>(getNetConfig());
  const [saved, setSaved] = useState(false);

  const clean = (l: string[]) => l.map((s) => s.trim()).filter(Boolean);

  const setList = (key: ListKey, list: string[]) =>
    setConf({ ...conf, [key]: list });

  const onSave = async () => {
    await saveNetConfig({
      anchorRelays: clean(conf.anchorRelays),
      seeds: clean(conf.seeds),
      apiUrl: conf.apiUrl.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const onReset = () => setConf(DEFAULT_NET_CONFIG);

  const noAnchors = clean(conf.anchorRelays).length === 0;

  const list = (
    label: string,
    key: ListKey,
    addLabel: string,
    caption?: string,
  ) => {
    const items = conf[key];
    return (
      <View style={styles.section}>
        <View style={styles.listHead}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.count}>{clean(items).length}</Text>
        </View>
        <View style={styles.card}>
          {items.map((item, i) => (
            <View key={i} style={styles.listRow}>
              <View style={styles.dot} />
              <TextInput
                value={item}
                onChangeText={(t) =>
                  setList(key, items.map((x, j) => (j === i ? t : x)))
                }
                placeholder="https://…"
                placeholderTextColor={colors.placeholder}
                style={styles.rowInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setList(key, items.filter((_, j) => j !== i))}
                hitSlop={8}
              >
                <X size={16} color={colors.iconDefault} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={styles.addRow}
            onPress={() => setList(key, [...items, ""])}
          >
            <Text style={styles.addLink}>+ {addLabel}</Text>
          </TouchableOpacity>
        </View>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
    );
  };

  return (
    <Layout
      padTop
      footer={
        <View style={styles.footerRow}>
          <TouchableOpacity onPress={onReset} hitSlop={8}>
            <Text style={styles.resetLink}>Reset to defaults</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
            <Text style={styles.saveText}>{saved ? "Saved" : "Save"}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <ScreenHeader title="Settings" onBack={() => router.back()} />

      {/* APPEARANCE */}
      <Text style={styles.sectionLabel}>APPEARANCE</Text>
      <View style={styles.segment}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.segItem, mode === m.id && styles.segItemActive]}
            onPress={() => setMode(m.id)}
          >
            <Text style={[styles.segText, mode === m.id && styles.segTextActive]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.spacer} />

      {/* NETWORK */}
      <Text style={styles.sectionLabel}>NETWORK</Text>
      <Text style={styles.subtitle}>
        Endpoints used for resolving, publishing, and buying.
      </Text>

      {noAnchors && (
        <View style={styles.banner}>
          <AlertCircle size={18} color={colors.statusAmberFg} />
          <Text style={styles.bannerText}>
            No anchor relays set — resolution falls back to the built-in
            defaults. Add one or Reset.
          </Text>
        </View>
      )}

      {list("Anchor relays", "anchorRelays", "Add relay")}
      {list(
        "Certrelay seeds",
        "seeds",
        "Add seed",
        "Used to bootstrap certrelays when the defaults are unreachable.",
      )}

      <View style={styles.section}>
        <Text style={styles.fieldLabel}>API URL</Text>
        <TextInput
          value={conf.apiUrl}
          onChangeText={(t) => setConf({ ...conf, apiUrl: t })}
          placeholder="https://…/api"
          placeholderTextColor={colors.placeholder}
          style={styles.apiInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    sectionLabel: {
      fontSize: 12,
      fontWeight: "500",
      letterSpacing: 0.6,
      color: c.textMuted,
      marginBottom: 10,
      marginTop: 8,
    },
    spacer: { height: 22 },
    segment: {
      flexDirection: "row",
      backgroundColor: c.field,
      borderRadius: 12,
      padding: 4,
    },
    segItem: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 9,
      alignItems: "center",
    },
    segItemActive: { backgroundColor: c.accent },
    segText: { color: c.textSecondary, fontSize: 14, fontWeight: "500" },
    segTextActive: { color: c.accentText },
    subtitle: {
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 18,
      marginTop: 10,
    },
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.statusAmberBg,
      borderRadius: 12,
      padding: 12,
      marginTop: 14,
    },
    bannerText: {
      flex: 1,
      fontSize: 13,
      color: c.statusAmberFg,
      lineHeight: 18,
    },
    section: { marginTop: 22 },
    listHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    fieldLabel: { fontSize: 14, color: c.text, fontWeight: "500" },
    count: { fontSize: 14, color: c.textMuted },
    card: {
      backgroundColor: c.field,
      borderRadius: 12,
      overflow: "hidden",
    },
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 999,
      backgroundColor: c.textMuted,
    },
    rowInput: {
      flex: 1,
      fontSize: 14,
      color: c.text,
      fontFamily: "monospace",
      paddingVertical: 12,
      // @ts-ignore web-only
      outlineStyle: "none",
    } as any,
    addRow: {
      paddingVertical: 13,
      alignItems: "center",
    },
    addLink: { color: c.accent, fontSize: 14, fontWeight: "600" },
    caption: {
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 18,
      marginTop: 8,
    },
    apiInput: {
      backgroundColor: c.field,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 14,
      color: c.text,
      fontFamily: "monospace",
      // @ts-ignore web-only
      outlineStyle: "none",
    } as any,
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    resetLink: { color: c.textMuted, fontSize: 14, fontWeight: "500" },
    saveBtn: {
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingHorizontal: 28,
      paddingVertical: 12,
    },
    saveText: { color: c.accentText, fontSize: 15, fontWeight: "600" },
  });
