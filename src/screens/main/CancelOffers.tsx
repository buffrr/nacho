import React, { useCallback, useEffect, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
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
import { useTheme } from "@/theme";
import { NativeEmpty } from "@/ui/nativeEmpty";
import { useStore } from "@/Store";
import { scriptForHandle } from "@/keys";
import { signSingleAnyonecanpay } from "@/psbtSign";
import { liveOffers, markAllCancelled, Offer } from "@/offers";
import { formatBtc } from "@/format";

// Cancel outstanding sale/transfer offers by spending the handle's UTXO back to
// the SAME key (ownership move to yourself). Native @expo/ui.
export default function CancelOffers() {
  const { scheme, colors } = useTheme();
  const router = useRouter();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { handles, xpub, getSigningKey } = useStore();

  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [psbt, setPsbt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    liveOffers(handle!).then(setOffers);
  }, [handle]);

  const sign = useCallback(async () => {
    const data = handles?.[handle!];
    if (!data || !xpub || !offers || offers.length === 0) return;
    setSigning(true);
    setError(null);
    try {
      const script = scriptForHandle(xpub, data);
      const key = await getSigningKey(handle!);
      if (!key) throw new Error("No private key available for this handle.");
      const { outpoint } = offers[0];
      const signed = signSingleAnyonecanpay(
        { ...outpoint, script },
        { script, amount: outpoint.amount },
        key,
      );
      await markAllCancelled(handle!);
      setPsbt(signed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign.");
    } finally {
      setSigning(false);
    }
  }, [handles, xpub, offers, handle, getSigningKey]);

  const copy = async () => {
    if (!psbt) return;
    await Clipboard.setStringAsync(psbt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Signed → copy / done.
  if (psbt) {
    return (
      <>
        <Stack.Screen options={{ title: "Cancel offers" }} />
        <Host style={{ flex: 1 }} colorScheme={scheme}>
          <FieldGroup>
            <FieldGroup.Section>
              <FieldGroup.SectionHeader>
                <Row alignment="center">
                  <Spacer />
                  <Column alignment="center" spacing={8}>
                    <Icon name="checkmark.circle.fill" size={46} color={colors.statusGreenFg} />
                    <Text textStyle={{ fontSize: 20, fontWeight: "700" }}>
                      Cancellation signed
                    </Text>
                    <Text textStyle={{ fontSize: 14, color: colors.textSecondary }}>
                      Copy this to your wallet and broadcast it. Offers stay valid
                      until it confirms — up to a day to clear here.
                    </Text>
                  </Column>
                  <Spacer />
                </Row>
              </FieldGroup.SectionHeader>
            </FieldGroup.Section>
            <FieldGroup.Section>
              <ListItem onPress={copy}>
                <Text textStyle={{ color: colors.accent, fontWeight: "700" }}>
                  {copied ? "Copied ✓" : "Copy transaction"}
                </Text>
              </ListItem>
              <ListItem onPress={() => router.back()}>
                <Text textStyle={{ color: colors.textSecondary }}>Done</Text>
              </ListItem>
            </FieldGroup.Section>
          </FieldGroup>
        </Host>
      </>
    );
  }

  if (offers === null) {
    return (
      <>
        <Stack.Screen options={{ title: "Cancel offers" }} />
        <NativeEmpty sf="clock" title="Loading offers…" />
      </>
    );
  }

  if (offers.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: "Cancel offers" }} />
        <NativeEmpty
          sf="checkmark.circle"
          title="No live offers"
          message="There’s nothing to cancel for this handle."
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Cancel offers" }} />
      <Host style={{ flex: 1 }} colorScheme={scheme}>
        <FieldGroup>
          <FieldGroup.Section
            title={`Invalidate ${offers.length} live offer${offers.length === 1 ? "" : "s"}`}
          >
            {offers.map((o) => (
              <ListItem
                key={o.id}
                trailing={<Text textStyle={{ color: colors.textSecondary }}>{o.kind}</Text>}
              >
                <Text>
                  {o.kind === "sale" && o.price ? formatBtc(o.price) : "Transfer"}
                </Text>
              </ListItem>
            ))}
            <FieldGroup.SectionFooter>
              <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                {`${handle} stays on the same key. Spending the UTXO is the only way to invalidate a signed offer — copy the transaction to your wallet and broadcast it.`}
              </Text>
            </FieldGroup.SectionFooter>
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

          <FieldGroup.Section>
            <ListItem onPress={signing ? undefined : sign}>
              <Text textStyle={{ color: colors.accent, fontWeight: "700" }}>
                {signing ? "Signing…" : "Sign & copy"}
              </Text>
            </ListItem>
            <ListItem onPress={() => router.back()}>
              <Text textStyle={{ color: colors.textSecondary }}>Cancel</Text>
            </ListItem>
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
    </>
  );
}
