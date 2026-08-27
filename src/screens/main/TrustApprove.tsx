import React, { useState } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  Host,
  FieldGroup,
  ListItem,
  Icon,
  Text,
  Column,
  Row,
  Spacer,
} from "@expo/ui";
import { useTheme, boundedHost } from "@/theme";
import { ActionFooter } from "@/ui/actionFooter";
import { authenticate } from "@/auth";
import { trustFromInput } from "@/fabric";

// Approval gate for a Trust ID scanned from the Scan tab. Pinning a Trust ID
// changes how EVERY handle is verified, so it is never pinned silently: it lands
// here and requires an explicit, device-authenticated approval.
function idFromPayload(payload: string): string | null {
  const m = /[?&]id=([0-9a-fA-F]{8,})/.exec(payload);
  return m ? m[1] : null;
}
function chunk(v: string): string {
  return v.replace(/(.{4})(?=.)/g, "$1 ");
}

export default function TrustApprove() {
  const router = useRouter();
  const { scheme, colors } = useTheme();
  const { payload } = useLocalSearchParams<{ payload: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const id = payload ? idFromPayload(payload) : null;

  const approve = async () => {
    if (!payload || busy) return;
    setError(null);
    if (!(await authenticate("Approve this Trust ID"))) return;
    setBusy(true);
    try {
      await trustFromInput(payload);
      router.replace("/(main)/trust");
    } catch {
      setError(
        "That isn’t a valid Trust ID. Scan the QR from a Veritas client running locally on your machine.",
      );
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Trust ID" }} />
      <Host style={boundedHost} colorScheme={scheme}>
        <FieldGroup>
          <FieldGroup.Section>
            <FieldGroup.SectionHeader>
              <Row alignment="center">
                <Spacer />
                <Column alignment="center" spacing={8}>
                  <Icon name="checkmark.shield.fill" size={40} color={colors.accent} />
                  <Text textStyle={{ fontSize: 20, fontWeight: "700" }}>
                    Pin this Trust ID?
                  </Text>
                </Column>
                <Spacer />
              </Row>
            </FieldGroup.SectionHeader>
          </FieldGroup.Section>

          {id ? (
            <FieldGroup.Section title="Trust ID">
              <ListItem>
                <Text>{chunk(id)}</Text>
              </ListItem>
            </FieldGroup.Section>
          ) : null}

          <FieldGroup.Section>
            <ListItem
              leading={<Icon name="exclamationmark.triangle.fill" size={18} color={colors.statusAmberFg} />}
            >
              <Text>
                Pinning a Trust ID changes how every handle is verified. Approve
                only if you scanned this from your own local Veritas client — a
                Trust ID from anyone else can make forged handles look verified.
              </Text>
            </ListItem>
          </FieldGroup.Section>

          {error ? (
            <FieldGroup.Section>
              <ListItem
                leading={<Icon name="exclamationmark.triangle.fill" size={18} color={colors.dangerText} />}
              >
                <Text textStyle={{ color: colors.textSecondary }}>{error}</Text>
              </ListItem>
            </FieldGroup.Section>
          ) : null}
        </FieldGroup>
      </Host>
      <ActionFooter
        primary={{
          label: busy ? "Pinning…" : "Approve Trust ID",
          onPress: approve,
          disabled: busy || !payload,
        }}
        secondary={{ label: "Cancel", onPress: () => router.back() }}
      />
    </>
  );
}
