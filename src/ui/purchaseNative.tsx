import React from "react";
import { WEB_TOP_INSET } from "@/ui/webInset";
import {
  Host,
  FieldGroup,
  ListItem,
  Icon,
  Text,
  Column,
  Row,
  Spacer,
  RNHostView,
} from "@expo/ui";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { ActionFooter } from "@/ui/actionFooter";
import { formatPrice } from "@/api";

// Native buy view for an available handle: profile + why-own it + the key it
// binds to + one-time price + Buy action. Buy triggers the existing IAP flow via
// onBuy. (No "copy request" here — that's for handles NOT sold through our flow.)
export function PurchaseNative({
  handle,
  pubkey,
  price,
  purchasing,
  onBuy,
  onCopyKey,
}: {
  handle: string;
  pubkey: string;
  price: number | null;
  purchasing: boolean;
  onBuy: () => void;
  onCopyKey: () => void;
}) {
  const { scheme, colors } = useTheme();
  const priceText = price !== null ? formatPrice(price) : "—";
  return (
    <>
      <Host style={{ flex: 1, paddingTop: WEB_TOP_INSET }} colorScheme={scheme}>
      <FieldGroup>
        <FieldGroup.Section>
          <FieldGroup.SectionHeader>
            <Row alignment="center">
              <Spacer flexible />
              <Column alignment="center" spacing={8} style={{ paddingTop: 10, paddingBottom: 14 }}>
                <RNHostView matchContents style={{ width: 72, height: 72 }}>
                  <Avatar handle={handle} size={72} />
                </RNHostView>
                <Text textStyle={{ fontSize: 22, fontWeight: "700", color: colors.text }}>{handle}</Text>
                <Row alignment="center" spacing={5}>
                  <Icon name="checkmark.circle.fill" size={14} color={colors.statusGreenFg} />
                  <Text textStyle={{ fontSize: 14, fontWeight: "600", color: colors.statusGreenFg }}>
                    Available
                  </Text>
                </Row>
              </Column>
              <Spacer flexible />
            </Row>
          </FieldGroup.SectionHeader>
          <ListItem leading={<Icon name="infinity" size={22} color={colors.text} />}>
            <Text>Yours permanently, no renewal</Text>
          </ListItem>
          <ListItem leading={<Icon name="lock.fill" size={22} color={colors.text} />}>
            <Text>Self-custodial, no accounts</Text>
          </ListItem>
        </FieldGroup.Section>

        <FieldGroup.Section title="Binds to">
          <ListItem
            supportingText={`${pubkey.slice(0, 8)}…${pubkey.slice(-8)}`}
            trailing={<Icon name="doc.on.doc" size={16} color={colors.chevron} />}
            onPress={onCopyKey}
          >
            <Text>This keystore</Text>
          </ListItem>
          <FieldGroup.SectionFooter>
            <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
              No one can take the handle from you, and no one can restore it for
              you. Back up your certificate once issued, and your seed.
            </Text>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>

      </FieldGroup>
      </Host>
      <ActionFooter
        primary={{
          label: purchasing
            ? "Processing…"
            : price !== null
              ? `Buy handle · ${priceText}`
              : "Buy handle",
          onPress: onBuy,
          disabled: purchasing,
        }}
      />
    </>
  );
}
