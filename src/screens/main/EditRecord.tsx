import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Colors, useTheme } from "@/theme";
import { useRecordsDraft } from "@/RecordsDraft";
import { Layout } from "@/ui/Layout";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";
import { lookupRecord } from "@/recordRegistry";

const TYPES = ["ADDR", "TXT"] as const;

export default function EditRecord() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    handle: string;
    index?: string;
    rtype?: string;
    key?: string;
  }>();
  const handle = params.handle;
  // useLocalSearchParams returns strings; parse the record index back to a
  // number (absent/empty → "append new record").
  const index =
    params.index !== undefined && params.index !== ""
      ? Number(params.index)
      : undefined;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { getRecords, setRecord, deleteRecord } = useRecordsDraft();

  const existing = index !== undefined ? getRecords(handle)[index] : undefined;

  // The record's type + key come from (in priority): the existing record being
  // edited, or the type the Add-record picker preset via params. Absent both,
  // it's a freeform "Other" record and the user picks type + key by hand.
  const presetType = existing?.type ?? (params.rtype as "addr" | "txt" | undefined);
  const presetKey = existing?.key ?? params.key;
  const { def, known } =
    presetType && presetKey
      ? lookupRecord(presetType, presetKey)
      : { def: null, known: false };
  // Slot-based form for recognised types; freeform for custom / unknown keys.
  const useSlots = !!def && known;

  const [type, setType] = useState<string>(
    (presetType ?? "addr").toUpperCase(),
  );
  const [key, setKey] = useState(presetKey ?? "");

  // Index of the single "multi" slot (repeatable, e.g. relay hints), if any.
  const multiIdx = def ? def.slots.findIndex((s) => s.multi) : -1;

  const [values, setValues] = useState<string[]>(() => {
    if (existing && existing.value.length) return existing.value;
    if (def) {
      // One empty field per slot; a leading single slot + trailing multi both
      // start with one empty input.
      return def.slots.map(() => "");
    }
    return [""];
  });
  const [error, setError] = useState<string | null>(null);

  const updateValue = (i: number, text: string) =>
    setValues((prev) => prev.map((v, j) => (j === i ? text : v)));
  const addValue = () => setValues((prev) => [...prev, ""]);
  const removeValue = (i: number) =>
    setValues((prev) => prev.filter((_, j) => j !== i));

  const save = () => {
    setError(null);
    const cleanKey = (useSlots ? def!.key : key).trim();
    const cleanValues = values.map((v) => v.trim()).filter(Boolean);
    if (!cleanKey) {
      setError("Enter a key.");
      return;
    }
    if (cleanValues.length === 0) {
      setError("Enter at least one value.");
      return;
    }
    // The first slot is the required one (address / public key / text). If it's
    // blank but a later optional slot is filled, the shape is wrong.
    if (useSlots && !values[0]?.trim()) {
      setError(`Enter the ${def!.slots[0].label.toLowerCase()}.`);
      return;
    }
    setRecord(handle, index ?? null, {
      type: (useSlots ? def!.rtype : type.toLowerCase()) as "txt" | "addr",
      key: cleanKey,
      value: cleanValues,
    });
    router.back();
  };

  const remove = () => {
    if (index !== undefined) deleteRecord(handle, index);
    router.back();
  };

  const title = index !== undefined ? "Edit record" : "Add record";

  return (
    <Layout
      underHeader
      keyboardAware
      footer={<Button text="Save record" onPress={save} type="main" />}
    >
      <Stack.Screen options={{ title }} />

      {useSlots && def ? (
        // ── Recognised type: header + one labelled field per value slot ──────
        <>
          <View style={styles.typeHead}>
            <View style={[styles.typeIco, { backgroundColor: def.color + "22" }]}>
              <def.Icon size={20} color={def.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.typeName}>{def.label}</Text>
              <Text style={styles.typeKey}>
                {def.rtype} · {def.key}
              </Text>
            </View>
          </View>

          {def.slots.map((slot, si) => {
            // A trailing multi slot renders every value from its index onward as
            // a repeatable list; single slots render one field bound to values[si].
            if (slot.multi) {
              const start = multiIdx >= 0 ? multiIdx : si;
              return (
                <View key={si}>
                  <Text style={styles.label}>
                    {slot.label.toUpperCase()}
                    {slot.optional ? (
                      <Text style={styles.optional}> · optional</Text>
                    ) : null}
                  </Text>
                  {values
                    .slice(start)
                    .map((v, k) => {
                      const vi = start + k;
                      return (
                        <View key={vi} style={styles.valueRow}>
                          <TextInput
                            value={v}
                            onChangeText={(t) => updateValue(vi, t)}
                            placeholder={slot.placeholder ?? slot.label}
                            placeholderTextColor={colors.placeholder}
                            style={[styles.input, styles.valueInput]}
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                          {values.length > start + 1 && (
                            <TouchableOpacity
                              onPress={() => removeValue(vi)}
                              hitSlop={8}
                            >
                              <Text style={styles.remove}>✕</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  <TouchableOpacity onPress={addValue}>
                    <Text style={styles.addValue}>+ Add {slot.label.toLowerCase()}</Text>
                  </TouchableOpacity>
                </View>
              );
            }
            return (
              <View key={si}>
                <Text style={styles.label}>
                  {slot.label.toUpperCase()}
                  {slot.optional ? (
                    <Text style={styles.optional}> · optional</Text>
                  ) : null}
                </Text>
                <TextInput
                  value={values[si] ?? ""}
                  onChangeText={(t) => updateValue(si, t)}
                  placeholder={slot.placeholder ?? slot.label}
                  placeholderTextColor={colors.placeholder}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            );
          })}
        </>
      ) : (
        // ── Freeform "Other" / unknown key: choose type, key, values by hand ──
        <>
          <Text style={styles.label}>TYPE</Text>
          <View style={styles.segment}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.segItem, type === t && styles.segItemActive]}
                onPress={() => setType(t)}
              >
                <Text
                  style={[styles.segText, type === t && styles.segTextActive]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>KEY</Text>
          <TextInput
            value={key}
            onChangeText={setKey}
            placeholder="e.g. age"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>VALUES</Text>
          {values.map((v, i) => (
            <View key={i} style={styles.valueRow}>
              <TextInput
                value={v}
                onChangeText={(t) => updateValue(i, t)}
                placeholder="value"
                placeholderTextColor={colors.placeholder}
                style={[styles.input, styles.valueInput]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {values.length > 1 && (
                <TouchableOpacity onPress={() => removeValue(i)} hitSlop={8}>
                  <Text style={styles.remove}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity onPress={addValue}>
            <Text style={styles.addValue}>+ Add value</Text>
          </TouchableOpacity>
        </>
      )}

      {error && <Message message={error} type="error" />}

      {index !== undefined && (
        <TouchableOpacity onPress={remove} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete record</Text>
        </TouchableOpacity>
      )}
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    typeHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 6,
      marginBottom: 4,
    },
    typeIco: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    typeName: { fontSize: 19, fontWeight: "600", color: c.text },
    typeKey: {
      fontSize: 12,
      color: c.textMuted,
      fontFamily: "monospace",
      marginTop: 1,
    },
    label: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.5,
      color: c.textMuted,
      marginTop: 20,
      marginBottom: 10,
    },
    optional: { fontWeight: "500", color: c.textFaint },
    segment: {
      flexDirection: "row",
      backgroundColor: c.field,
      borderRadius: 12,
      padding: 4,
      gap: 4,
    },
    segItem: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: "center",
    },
    segItemActive: { backgroundColor: c.accent },
    segText: { color: c.textMuted, fontSize: 14, fontWeight: "600" },
    segTextActive: { color: c.accentText },
    input: {
      backgroundColor: c.field,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: c.text,
      fontFamily: "monospace",
      // @ts-ignore web-only
      outlineStyle: "none",
    } as any,
    valueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 8,
    },
    valueInput: { flex: 1 },
    remove: { color: c.textMuted, fontSize: 16 },
    addValue: {
      color: c.accent,
      fontSize: 14,
      fontWeight: "600",
      marginTop: 2,
    },
    deleteBtn: { alignItems: "center", paddingVertical: 16, marginTop: 12 },
    deleteText: { color: c.danger, fontSize: 15, fontWeight: "500" },
  });
