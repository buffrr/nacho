import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { Colors, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { Header } from "@/ui/Header";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";
import { Badge } from "@/ui/Badge";
import { resolveHandle } from "@/fabric";
import {
  ResolvedHandle,
  FabricRecord,
  VerificationBadge,
} from "@/fabricResolver";

type Props = NativeStackScreenProps<HandlesStackParamList, "Resolve">;

const BADGE: Record<VerificationBadge, { label: string; color: string }> = {
  orange: { label: "Verified", color: "#FF7B00" },
  unverified: { label: "Unverified", color: "#6B6B6B" },
  none: { label: "Unverified", color: "#6B6B6B" },
};

function shorten(value: string): string {
  if (value.length <= 32) return value;
  return `${value.slice(0, 18)}…${value.slice(-8)}`;
}

function describeRecord(rec: FabricRecord): { tag: string; lines: string[] } {
  if (typeof rec.key === "string") {
    return { tag: rec.type, lines: [`${rec.key} = ${(rec.value ?? []).join(", ")}`] };
  }
  if (rec.type === "seq") {
    return { tag: "seq", lines: [`version ${rec.version ?? "?"}`] };
  }
  if (rec.type === "sig") {
    return { tag: "sig", lines: [shorten(String(rec.sig ?? ""))] };
  }
  const { type, ...rest } = rec;
  return { tag: rec.type, lines: [JSON.stringify(rest)] };
}

export default function Resolve({}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [handle, setHandle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ResolvedHandle | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canResolve = handle.trim().includes("@") && !isLoading;

  const onResolve = async () => {
    const name = handle.trim().toLowerCase();
    if (!name.includes("@") || isLoading) return;
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    setResult(null);
    try {
      const resolved = await resolveHandle(name);
      if (resolved) {
        setResult(resolved);
      } else {
        setNotFound(true);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to resolve handle",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderHandleName = (name: string) => {
    const parts = name.split("@");
    if (parts.length === 2) {
      return (
        <>
          <Text style={styles.subPart}>{parts[0]}</Text>
          <Text style={styles.spacePart}>@{parts[1]}</Text>
        </>
      );
    }
    return <Text style={styles.spacePart}>{name}</Text>;
  };

  return (
    <Layout
      footer={
        <Button
          text={isLoading ? "Resolving…" : "Resolve"}
          onPress={onResolve}
          type="main"
          disabled={!canResolve}
        />
      }
    >
      <Header
        headText="Resolve"
        tailText="Handle"
        subText="Look up a handle's records from the certrelay network."
      />

      <TextInput
        value={handle}
        onChangeText={(text) => setHandle(text.trim().toLowerCase())}
        onSubmitEditing={onResolve}
        placeholder="grace@key"
        placeholderTextColor={colors.placeholder}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isLoading}
        returnKeyType="search"
      />

      {isLoading && (
        <ActivityIndicator
          color="#FF7B00"
          style={styles.loader}
          size="large"
        />
      )}

      {error && <Message message={error} type="error" />}
      {notFound && (
        <Message message="Handle not found on the network." type="error" />
      )}

      {result && (
        <View style={styles.result}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultHandle}>
              {renderHandleName(result.handle)}
            </Text>
            <Badge
              label={BADGE[result.badge].label}
              color={BADGE[result.badge].color}
            />
          </View>

          {result.zone.sovereignty && (
            <Text style={styles.meta}>
              Sovereignty: {result.zone.sovereignty}
            </Text>
          )}
          {result.zone.num_id && (
            <Text style={styles.meta} numberOfLines={1}>
              ID: {result.zone.num_id}
            </Text>
          )}

          <Text style={styles.sectionLabel}>Records</Text>
          {(result.zone.records ?? []).length === 0 && (
            <Text style={styles.meta}>No records.</Text>
          )}
          {(result.zone.records ?? []).map((rec, i) => {
            const { tag, lines } = describeRecord(rec);
            return (
              <View key={i} style={styles.record}>
                <Text style={styles.recordTag}>{tag}</Text>
                {lines.map((line, j) => (
                  <Text key={j} style={styles.recordValue}>
                    {line}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      )}
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: c.text,
      fontFamily: "monospace",
      // @ts-ignore - web-only style to remove focus outline
      outlineStyle: "none",
    } as any,
    loader: {
      marginTop: 28,
    },
    result: {
      marginTop: 28,
    },
    resultHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    resultHandle: {
      fontSize: 24,
      fontWeight: "400",
      flexShrink: 1,
    },
    subPart: {
      color: c.text,
    },
    spacePart: {
      color: c.accent,
    },
    meta: {
      fontSize: 13,
      color: c.textMuted,
      marginBottom: 4,
    },
    sectionLabel: {
      fontSize: 18,
      color: c.text,
      fontWeight: "400",
      marginTop: 20,
      marginBottom: 12,
    },
    record: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
    },
    recordTag: {
      fontSize: 11,
      fontWeight: "700",
      color: c.accent,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 6,
    },
    recordValue: {
      fontSize: 14,
      color: c.text,
      fontFamily: "monospace",
      lineHeight: 20,
      // @ts-ignore - web-only word breaking
      wordBreak: "break-all",
      overflowWrap: "break-word",
    } as any,
  });
