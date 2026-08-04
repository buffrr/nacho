import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { Colors, useTheme } from "@/theme";
import { useRecordsDraft } from "@/RecordsDraft";
import { Layout } from "@/ui/Layout";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";

type Props = NativeStackScreenProps<HandlesStackParamList, "EditRecord">;

const TYPES = ["ADDR", "TXT", "BLOB"] as const;

export default function EditRecord({ route, navigation }: Props) {
  const { handle, index } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { getRecords, setRecord, deleteRecord } = useRecordsDraft();

  const existing = index !== undefined ? getRecords(handle)[index] : undefined;
  const [type, setType] = useState<string>(
    existing ? existing.type.toUpperCase() : "ADDR",
  );
  const [key, setKey] = useState(existing?.key ?? "");
  const [values, setValues] = useState<string[]>(
    existing && existing.value.length ? existing.value : [""],
  );
  const [error, setError] = useState<string | null>(null);

  const updateValue = (i: number, text: string) =>
    setValues((prev) => prev.map((v, j) => (j === i ? text : v)));
  const addValue = () => setValues((prev) => [...prev, ""]);
  const removeValue = (i: number) =>
    setValues((prev) => prev.filter((_, j) => j !== i));

  const save = () => {
    setError(null);
    if (type === "BLOB") {
      setError("BLOB records aren't supported yet.");
      return;
    }
    const cleanKey = key.trim();
    const cleanValues = values.map((v) => v.trim()).filter(Boolean);
    if (!cleanKey || cleanValues.length === 0) {
      setError("Enter a key and at least one value.");
      return;
    }
    setRecord(handle, index ?? null, {
      type: type.toLowerCase() as "txt" | "addr",
      key: cleanKey,
      value: cleanValues,
    });
    navigation.goBack();
  };

  const remove = () => {
    if (index !== undefined) {
      deleteRecord(handle, index);
    }
    navigation.goBack();
  };

  return (
    <Layout
      padTop
      footer={
        <Button text="Save record" onPress={save} type="main" />
      }
    >
      <ScreenHeader
        title={index !== undefined ? "Edit record" : "Add record"}
        onBack={() => navigation.goBack()}
      />

      <Text style={styles.label}>TYPE</Text>
      <View style={styles.segment}>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.segItem, type === t && styles.segItemActive]}
            onPress={() => setType(t)}
          >
            <Text style={[styles.segText, type === t && styles.segTextActive]}>
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

      <Text style={styles.note}>
        SEQ and SIG are managed automatically when you sign and publish.
      </Text>

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
    label: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.5,
      color: c.textMuted,
      marginTop: 20,
      marginBottom: 10,
    },
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
    segItemActive: {
      backgroundColor: c.accent,
    },
    segText: {
      color: c.textMuted,
      fontSize: 14,
      fontWeight: "600",
    },
    segTextActive: {
      color: c.accentText,
    },
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
    valueInput: {
      flex: 1,
    },
    remove: {
      color: c.textMuted,
      fontSize: 16,
    },
    addValue: {
      color: c.accent,
      fontSize: 14,
      fontWeight: "600",
      marginTop: 2,
    },
    note: {
      color: c.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 20,
    },
    deleteBtn: {
      alignItems: "center",
      paddingVertical: 16,
      marginTop: 12,
    },
    deleteText: {
      color: c.danger,
      fontSize: 15,
      fontWeight: "500",
    },
  });
