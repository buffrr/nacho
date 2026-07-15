import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";
import {
  resolveHandle,
  publishRecords,
  packedByteLength,
  exportCert,
} from "@/fabric";
import { editableFromZone, EditableRecord } from "@/fabricResolver";
import { loadCert, saveCert } from "@/certStore";

type Preset = {
  id: string;
  label: string;
  type: "txt" | "addr";
  key: string;
  placeholder: string;
};

// Common records, mirroring the kinds the web editor offers.
const PRESETS: Preset[] = [
  { id: "nostr", label: "Nostr", type: "txt", key: "nostr", placeholder: "npub1…" },
  { id: "website", label: "Website", type: "txt", key: "url", placeholder: "https://…" },
  { id: "email", label: "Email", type: "txt", key: "email", placeholder: "you@example.com" },
  { id: "btc", label: "Bitcoin", type: "addr", key: "btc", placeholder: "bc1…" },
  { id: "lightning", label: "Lightning", type: "txt", key: "lnaddr", placeholder: "you@wallet" },
  { id: "x", label: "X", type: "txt", key: "x", placeholder: "@handle" },
  { id: "avatar", label: "Avatar", type: "txt", key: "avatar", placeholder: "https://…/pic.png" },
  { id: "bio", label: "Bio", type: "txt", key: "bio", placeholder: "About you" },
];

type Row = {
  presetId: string | null;
  type: "txt" | "addr";
  key: string;
  valueText: string;
};

function presetForRecord(rec: EditableRecord): Preset | undefined {
  return PRESETS.find((p) => p.key === rec.key && p.type === rec.type);
}

function rowsToRecords(rows: Row[]): EditableRecord[] {
  return rows
    .map((r) => ({
      type: r.type,
      key: r.key.trim(),
      value: r.valueText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    }))
    .filter((r) => r.key.length > 0 && r.value.length > 0);
}

export function RecordsEditor({ handle }: { handle: string }) {
  const { getSigningKey } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [seq, setSeq] = useState(0);
  const [byteLength, setByteLength] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const resolved = await resolveHandle(handle);
        if (!active) return;
        if (resolved) {
          const { records, seq: currentSeq } = editableFromZone(resolved.zone);
          setRows(
            records.map((r) => ({
              presetId: presetForRecord(r)?.id ?? null,
              type: r.type,
              key: r.key,
              valueText: r.value.join(", "),
            })),
          );
          setSeq(currentSeq);
        }
      } catch (e) {
        // start empty on resolve failure
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [handle]);

  const records = rowsToRecords(rows);
  const nextSeq = seq + 1;

  useEffect(() => {
    let active = true;
    packedByteLength(records, nextSeq)
      .then((n) => active && setByteLength(n))
      .catch(() => active && setByteLength(null));
    return () => {
      active = false;
    };
  }, [JSON.stringify(records), nextSeq]);

  const dirty = () => {
    setError(null);
    setSuccess(false);
  };

  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    dirty();
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    dirty();
  };

  const addPreset = (preset: Preset) => {
    setRows((prev) => [
      ...prev,
      { presetId: preset.id, type: preset.type, key: preset.key, valueText: "" },
    ]);
    setPickerOpen(false);
    dirty();
  };

  const addCustom = () => {
    setRows((prev) => [
      ...prev,
      { presetId: null, type: "txt", key: "", valueText: "" },
    ]);
    setPickerOpen(false);
    dirty();
  };

  const publish = async () => {
    setError(null);
    setSuccess(false);
    setPublishing(true);
    try {
      const secretKey = await getSigningKey(handle);
      if (!secretKey) {
        throw new Error("No private key available for this handle.");
      }
      let cert = await loadCert(handle);
      if (!cert) {
        cert = await exportCert(handle);
        await saveCert(handle, cert);
      }
      await publishRecords(cert, records, nextSeq, secretKey);
      setSeq(nextSeq);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish records.");
    } finally {
      setPublishing(false);
    }
  };

  const renderRow = (row: Row, index: number) => {
    const preset = row.presetId
      ? PRESETS.find((p) => p.id === row.presetId)
      : undefined;

    return (
      <View key={index} style={styles.card}>
        <View style={styles.cardHeader}>
          {preset ? (
            <Text style={styles.presetLabel}>{preset.label}</Text>
          ) : (
            <View style={styles.typeToggle}>
              {(["txt", "addr"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => updateRow(index, { type: t })}
                  style={[styles.typeChip, row.type === t && styles.typeChipActive]}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      row.type === t && styles.typeChipTextActive,
                    ]}
                  >
                    {t.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity onPress={() => removeRow(index)} hitSlop={8}>
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>

        {!preset && (
          <TextInput
            value={row.key}
            onChangeText={(text) => updateRow(index, { key: text })}
            placeholder="key (e.g. website)"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
        <TextInput
          value={row.valueText}
          onChangeText={(text) => updateRow(index, { valueText: text })}
          placeholder={preset ? preset.placeholder : "value"}
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Records</Text>
        <TouchableOpacity
          onPress={() => setPickerOpen(true)}
          style={styles.addButton}
          accessibilityLabel="Add record"
        >
          <Text style={styles.addPlus}>+</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#FF7B00" style={styles.loader} />
      ) : rows.length === 0 ? (
        <TouchableOpacity
          style={styles.emptyCard}
          onPress={() => setPickerOpen(true)}
        >
          <Text style={styles.emptyPlus}>+</Text>
          <Text style={styles.emptyText}>Add a record</Text>
        </TouchableOpacity>
      ) : (
        rows.map(renderRow)
      )}

      {rows.length > 0 && (
        <Button
          text={publishing ? "Publishing…" : "Sign & Publish"}
          onPress={publish}
          type="main"
          disabled={publishing}
        />
      )}

      <TouchableOpacity
        onPress={() => setShowAdvanced((v) => !v)}
        style={styles.advancedToggle}
      >
        <Text style={styles.advancedToggleText}>
          {showAdvanced ? "Hide advanced" : "Advanced"}
        </Text>
      </TouchableOpacity>

      {showAdvanced && (
        <>
          <Text style={styles.metaText}>
            seq {nextSeq} · {records.length} record
            {records.length === 1 ? "" : "s"}
            {byteLength !== null ? ` · ${byteLength} bytes` : ""}
          </Text>
          <Text style={styles.json} textBreakStrategy="simple">
            {JSON.stringify(records, null, 2)}
          </Text>
        </>
      )}

      {error && <Message message={error} type="error" />}
      {success && (
        <Message message="Records published to certrelay." type="success" />
      )}

      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setPickerOpen(false)}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Add record</Text>
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.sheetRow}
                onPress={() => addPreset(p)}
              >
                <Text style={styles.sheetRowLabel}>{p.label}</Text>
                <Text style={styles.sheetRowHint}>{p.placeholder}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.sheetRow} onPress={addCustom}>
              <Text style={styles.sheetRowLabel}>Custom</Text>
              <Text style={styles.sheetRowHint}>Any key / value</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      marginBottom: 20,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    title: {
      color: c.text,
      fontSize: 18,
      fontWeight: "400",
    },
    addButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    addPlus: {
      color: c.accentText,
      fontSize: 22,
      lineHeight: 24,
      fontWeight: "500",
    },
    loader: {
      marginVertical: 20,
    },
    emptyCard: {
      borderWidth: 1,
      borderColor: c.border,
      borderStyle: "dashed",
      borderRadius: 12,
      paddingVertical: 28,
      alignItems: "center",
      gap: 6,
      marginBottom: 8,
    },
    emptyPlus: {
      color: c.accent,
      fontSize: 30,
      fontWeight: "300",
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 15,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    presetLabel: {
      color: c.accent,
      fontSize: 15,
      fontWeight: "600",
    },
    typeToggle: {
      flexDirection: "row",
      gap: 6,
    },
    typeChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: c.chip,
    },
    typeChipActive: {
      backgroundColor: c.accent,
    },
    typeChipText: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    typeChipTextActive: {
      color: c.accentText,
    },
    removeText: {
      color: c.danger,
      fontSize: 14,
      fontWeight: "500",
    },
    input: {
      backgroundColor: c.surfaceSunken,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: c.text,
      fontFamily: "monospace",
      marginBottom: 8,
      // @ts-ignore - web-only style to remove focus outline
      outlineStyle: "none",
    } as any,
    advancedToggle: {
      alignSelf: "center",
      paddingVertical: 10,
      marginTop: 4,
    },
    advancedToggleText: {
      color: c.textMuted,
      fontSize: 14,
      fontWeight: "500",
    },
    metaText: {
      color: c.textMuted,
      fontSize: 13,
      marginBottom: 10,
    },
    json: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 14,
      color: c.textFaint,
      fontFamily: "monospace",
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 12,
      // @ts-ignore - web-only word breaking
      wordBreak: "break-all",
      overflowWrap: "break-word",
    } as any,
    sheetBackdrop: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 20,
      paddingBottom: 40,
      paddingHorizontal: 20,
    },
    sheetTitle: {
      color: c.text,
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 12,
    },
    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    sheetRowLabel: {
      color: c.text,
      fontSize: 16,
      fontWeight: "500",
    },
    sheetRowHint: {
      color: c.textMuted,
      fontSize: 13,
      fontFamily: "monospace",
    },
  });
