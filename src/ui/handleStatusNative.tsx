import React from "react";
import { WEB_TOP_INSET } from "@/ui/webInset";
import type { SFSymbol } from "sf-symbols-typescript";
import {
  Host,
  Column,
  Row,
  Spacer,
  RNHostView,
} from "@expo/ui";
import { FieldGroup } from "@/ui/fieldGroup";
import { Text } from "@/ui/text";
import { ListItem } from "@/ui/listItem";
import { Icon } from "@/ui/icon";
import { useTheme, boundedHost } from "@/theme";
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
  // Omit for a clean text-only status line (e.g. "is yours") — a coloured dot
  // adds nothing there. Set it for badge states (seal/shield/clock).
  icon?: SFSymbol;
  iconColor?: string;
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
      <Host style={[boundedHost, { paddingTop: WEB_TOP_INSET }]} colorScheme={scheme}>
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
                  {/* Icon is optional: badge states (seal/shield/clock) show a
                      glyph; plain states like "is yours" are text-only. */}
                  {icon ? (
                    <Icon name={icon} size={14} color={iconColor} />
                  ) : null}
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
