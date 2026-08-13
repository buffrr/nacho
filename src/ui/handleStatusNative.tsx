import React from "react";
import type { SFSymbol } from "sf-symbols-typescript";
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

export type StatusDetail = { label: string; value: string };
export type StatusAction = { label: string; onPress: () => void };

// A native profile + status view for a handle's transient states (post-purchase
// onboarding, waiting-for-certificate, etc.): centered avatar + handle + a
// coloured status line in the section header, a message row, optional detail
// rows, and up to two action rows. Same @expo/ui vocabulary as the handle view.
export function HandleStatusNative({
  handle,
  icon,
  iconColor,
  statusLabel,
  statusColor,
  message,
  details,
  primary,
  secondary,
}: {
  handle: string;
  icon: SFSymbol;
  iconColor: string;
  statusLabel: string;
  statusColor: string;
  message: string;
  details?: StatusDetail[];
  primary?: StatusAction;
  secondary?: StatusAction;
}) {
  const { scheme, colors } = useTheme();
  return (
    <>
      <Host style={{ flex: 1 }} colorScheme={scheme}>
      <FieldGroup>
        <FieldGroup.Section>
          <FieldGroup.SectionHeader>
            <Row alignment="center">
              <Spacer />
              <Column alignment="center" spacing={8}>
                <RNHostView matchContents style={{ width: 72, height: 72 }}>
                  <Avatar handle={handle} size={72} />
                </RNHostView>
                <Text textStyle={{ fontSize: 22, fontWeight: "700" }}>{handle}</Text>
                <Row alignment="center" spacing={5}>
                  <Icon name={icon} size={14} color={iconColor} />
                  <Text textStyle={{ fontSize: 14, fontWeight: "600", color: statusColor }}>
                    {statusLabel}
                  </Text>
                </Row>
              </Column>
              <Spacer />
            </Row>
          </FieldGroup.SectionHeader>
          <ListItem>
            <Text textStyle={{ color: colors.textSecondary }}>{message}</Text>
          </ListItem>
        </FieldGroup.Section>

        {details && details.length > 0 ? (
          <FieldGroup.Section title="Details">
            {details.map((d) => (
              <ListItem
                key={d.label}
                trailing={
                  <Text textStyle={{ color: colors.textSecondary }}>{d.value}</Text>
                }
              >
                <Text>{d.label}</Text>
              </ListItem>
            ))}
          </FieldGroup.Section>
        ) : null}

      </FieldGroup>
      </Host>
      {primary || secondary ? (
        <ActionFooter primary={primary} secondary={secondary} />
      ) : null}
    </>
  );
}
