import React from "react";
import { WEB_TOP_INSET } from "@/ui/webInset";
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
  messageIcon,
  messageIconColor,
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
  // Optional leading glyph for the message row (e.g. a clock on "Issuing your
  // certificate…") — distinct from the status-line icon next to statusLabel.
  messageIcon?: SFSymbol;
  messageIconColor?: string;
  details?: StatusDetail[];
  primary?: StatusAction;
  secondary?: StatusAction;
}) {
  const { scheme, colors } = useTheme();
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
                  {/* A bare status dot is small; a seal/shield reads as a badge
                      and gets more presence — matching the profile header. */}
                  <Icon name={icon} size={icon === "circle.fill" ? 9 : 14} color={iconColor} />
                  <Text textStyle={{ fontSize: 14, fontWeight: "600", color: statusColor }}>
                    {statusLabel}
                  </Text>
                </Row>
              </Column>
              <Spacer flexible />
            </Row>
          </FieldGroup.SectionHeader>
          <ListItem
            leading={
              messageIcon ? (
                <Icon
                  name={messageIcon}
                  size={20}
                  color={messageIconColor ?? colors.textSecondary}
                />
              ) : undefined
            }
          >
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
