import React from "react";
import { Stack } from "expo-router";
import { Host, FieldGroup, ListItem, Icon, Text, Column, Row } from "@expo/ui";

// PREVIEW — the handle view rendered with @expo/ui's CROSS-PLATFORM universal
// layer (FieldGroup / ListItem / Icon). One codebase → native SwiftUI on iOS,
// Jetpack Compose on Android, DOM on web. Dummy data. If we like it, this can
// become the real handle view rather than the hand-styled RN version.
//
// Note: Icon takes an SF Symbol string on iOS; a fully cross-platform icon uses
// Icon.select({ ios: "…", android: require("@expo/material-symbols/….xml") }).
// The demo uses SF strings, so Android icons would need the material variants.
export default function NativeDemo() {
  return (
    <>
      <Stack.Screen options={{ title: "Native preview" }} />
      <Host style={{ flex: 1 }}>
        <FieldGroup>
          {/* Centered profile header */}
          <FieldGroup.Section>
            <Column alignment="center" spacing={6}>
              <Icon name="person.crop.circle.fill" size={72} color="#7580BA" />
              <Text textStyle={{ fontSize: 22, fontWeight: "700" }}>
                alice@bitcoin
              </Text>
              <Row alignment="center" spacing={5}>
                <Icon name="checkmark.seal.fill" size={15} color="#34A853" />
                <Text>Sovereign</Text>
              </Row>
            </Column>
          </FieldGroup.Section>

          {/* Records — leading icon, headline label, trailing value */}
          <FieldGroup.Section title="Records">
            <ListItem
              leading={<Icon name="bitcoinsign.circle.fill" size={22} color="#F7931A" />}
              trailing={<Text>bc1q…wf5mdq</Text>}
            >
              <Text>Bitcoin address</Text>
            </ListItem>
            <ListItem
              leading={<Icon name="bolt.fill" size={22} color="#8B5CF6" />}
              trailing={<Text>lno1…4kggd</Text>}
            >
              <Text>Lightning offer</Text>
            </ListItem>
            <ListItem
              leading={<Icon name="at" size={22} color="#8B5CF6" />}
              trailing={<Text>npub1…3qz8k</Text>}
            >
              <Text>Nostr</Text>
            </ListItem>
            <ListItem
              leading={<Icon name="globe" size={22} color="#5B9BD5" />}
              trailing={<Text>alice.example</Text>}
            >
              <Text>Website</Text>
            </ListItem>
          </FieldGroup.Section>

          {/* Details */}
          <FieldGroup.Section title="Details">
            <ListItem trailing={<Text>b7d9…9dac</Text>}>
              <Text>Public key</Text>
            </ListItem>
            <ListItem trailing={<Text>12·8f…21</Text>}>
              <Text>Numeric ID</Text>
            </ListItem>
            <ListItem trailing={<Text>alice</Text>}>
              <Text>Alias</Text>
            </ListItem>
            <ListItem trailing={<Text>Aug 7, 2026</Text>}>
              <Text>Last published</Text>
            </ListItem>
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
    </>
  );
}
