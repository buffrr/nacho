import React, { useCallback, useEffect, useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Host, FieldGroup, ListItem, Icon, Text, Column, Row } from "@expo/ui";
import { refreshable } from "@/ui/rowModifiers";
import { useTheme, boundedHost } from "@/theme";
import { NativeEmpty } from "@/ui/nativeEmpty";
import { resolveHandleWithCerts } from "@/fabric";
import { chainRows, getCachedCerts, setCachedCerts, ChainRow, CertState } from "@/certState";
import type { ResolvedWithCerts } from "@/fabricResolver";

const short = (v: string) => (v.length > 16 ? `${v.slice(0, 6)}…${v.slice(-6)}` : v);

const ROLE_LABEL: Record<"leaf" | "parent" | "root", string> = {
  leaf: "This handle",
  parent: "Parent zone",
  root: "Root zone",
};

// The certificate chain (certs_mockup.html §04). Two alternating row kinds: a
// ZONE row (name + role + its own status), and a COMMITMENT EDGE between each
// child and its parent. The commitment lives on the edge — a handle publishes no
// root of its own, it's *included in* its parent's — so the edge below a name
// shows the parent's root + block height, tap-to-copy the root. A parent that
// hasn't committed the child is an empty edge ("No commitment yet"), which makes
// the weakest link visible without a special rule.
export default function CertificateChain() {
  const { scheme, colors } = useTheme();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const [resolved, setResolved] = useState<ResolvedWithCerts | null>(() =>
    getCachedCerts(handle),
  );
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (resolved) return;
    let active = true;
    resolveHandleWithCerts(handle)
      .then((r) => {
        if (r && active) {
          setCachedCerts(handle, r);
          setResolved(r);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [handle, resolved]);

  const [showRaw, setShowRaw] = useState(false);

  // Pull-to-refresh re-runs resolveWithCerts (fresh), same as the Certificate
  // screen — so a commitment landing / confirmations advancing shows up here too.
  const onRefresh = useCallback(async () => {
    try {
      const r = await resolveHandleWithCerts(handle, true);
      if (r) {
        setCachedCerts(handle, r);
        setResolved(r);
      }
    } catch {
      // keep whatever we have
    }
  }, [handle]);

  const copyRoot = useCallback((root: string) => {
    Clipboard.setStringAsync(root);
    setCopied(root);
    setTimeout(() => setCopied((c) => (c === root ? null : c)), 1400);
  }, []);

  if (!resolved) {
    return (
      <>
        <Stack.Screen options={{ title: "Certificate chain" }} />
        <NativeEmpty sf="clock" title="Loading chain…" />
      </>
    );
  }

  const rows = chainRows(resolved);
  const rawJson = JSON.stringify(
    { zone: resolved.zone, parents: resolved.parents },
    null,
    2,
  );

  // Final is the only state with an accent (green); Provisional and Confirming
  // stay the default color.
  const chip = (s: CertState): { label: string; color: string } => {
    if (s === "final") return { label: "Final", color: colors.statusGreenFg };
    if (s === "confirming") return { label: "Confirming", color: colors.textSecondary };
    return { label: "Provisional", color: colors.textSecondary };
  };

  return (
    <>
      <Stack.Screen options={{ title: "Certificate chain" }} />
      <Host style={boundedHost} colorScheme={scheme}>
        <FieldGroup modifiers={[refreshable(onRefresh)]}>
          <FieldGroup.Section title="How this handle is anchored">
            {rows.map((r, i) =>
              r.kind === "zone" ? (
                <ListItem
                  key={`z:${i}`}
                  supportingText={ROLE_LABEL[r.role]}
                  trailing={
                    <Text textStyle={{ fontSize: 12, color: chip(r.state).color }}>
                      {chip(r.state).label}
                    </Text>
                  }
                >
                  <Text textStyle={{ fontSize: 15, fontWeight: "600" }}>{r.name}</Text>
                </ListItem>
              ) : r.commitment ? (
                <ListItem
                  key={`e:${i}`}
                  leading={
                    <Icon
                      name={r.included ? "arrow.down" : "signature"}
                      size={15}
                      color={r.included ? colors.textMuted : colors.statusAmberFg}
                    />
                  }
                  onPress={
                    r.commitment.root
                      ? () => copyRoot(r.commitment!.root as string)
                      : undefined
                  }
                >
                  <Column spacing={5}>
                    {/* An included child (sovereign/pending) is proven IN the
                        parent's commitment. A dependent child is signed by the
                        parent and proven NOT yet in it — the same root, opposite
                        meaning. */}
                    <Text
                      textStyle={{
                        fontSize: 12,
                        color: r.included ? colors.textMuted : colors.statusAmberFg,
                      }}
                    >
                      {r.included
                        ? "Included in this commitment"
                        : `Signed by ${r.parentName} · provably not yet included in`}
                    </Text>
                    {r.commitment.root ? (
                      <Row spacing={6} alignment="center">
                        <Text textStyle={{ fontSize: 13, color: colors.textSecondary }}>
                          Root
                        </Text>
                        <Text textStyle={{ fontSize: 13, color: colors.text }}>
                          {copied === r.commitment.root
                            ? "Copied ✓"
                            : short(r.commitment.root)}
                        </Text>
                        <Icon name="doc.on.doc" size={12} color={colors.textMuted} />
                      </Row>
                    ) : null}
                    <Row spacing={6} alignment="center">
                      <Text textStyle={{ fontSize: 13, color: colors.textSecondary }}>
                        Block
                      </Text>
                      <Text textStyle={{ fontSize: 13, color: colors.text }}>
                        {r.commitment.blockHeight.toLocaleString()}
                      </Text>
                    </Row>
                    {r.included && r.commitment.confirmations != null ? (
                      <Row spacing={6} alignment="center">
                        <Text textStyle={{ fontSize: 13, color: colors.textSecondary }}>
                          Confirmations
                        </Text>
                        <Text textStyle={{ fontSize: 13, color: colors.text }}>
                          {r.commitment.confirmations.toLocaleString()}
                        </Text>
                      </Row>
                    ) : null}
                  </Column>
                </ListItem>
              ) : (
                <ListItem
                  key={`e:${i}`}
                  leading={<Icon name="clock" size={15} color={colors.statusAmberFg} />}
                >
                  <Column spacing={4}>
                    <Text textStyle={{ fontSize: 12, color: colors.statusAmberFg }}>
                      No commitment yet
                    </Text>
                    <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                      {`${r.parentName} hasn’t published a root covering this handle.`}
                    </Text>
                  </Column>
                </ListItem>
              ),
            )}
            <FieldGroup.SectionFooter>
              <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                A zone is included in the commitment its parent publishes. Tap a root to
                copy it.
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>

          {/* Raw JSON — debug aid: the exact zone + parents shape. */}
          <FieldGroup.Section>
            <ListItem
              trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
              onPress={() => setShowRaw((v) => !v)}
            >
              <Text>{showRaw ? "Hide raw" : "View raw"}</Text>
            </ListItem>
            {showRaw ? (
              <ListItem
                onPress={() => {
                  Clipboard.setStringAsync(rawJson);
                  setCopied("__raw__");
                  setTimeout(
                    () => setCopied((c) => (c === "__raw__" ? null : c)),
                    1400,
                  );
                }}
              >
                <Text
                  textStyle={{
                    fontSize: 11,
                    color: colors.textSecondary,
                    fontFamily: "Menlo",
                  }}
                >
                  {(copied === "__raw__" ? "Copied ✓\n\n" : "") + rawJson}
                </Text>
              </ListItem>
            ) : null}
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
    </>
  );
}
