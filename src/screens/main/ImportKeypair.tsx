import React, { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Host,
  TextInput,
  useNativeState,
} from "@expo/ui";
import { FieldGroup } from "@/ui/fieldGroup";
import { Text } from "@/ui/text";
import { ListItem } from "@/ui/listItem";
import { Icon } from "@/ui/icon";
import { useStore } from "@/Store";
import { useTheme, boundedHost } from "@/theme";
import { isValidHandle } from "@/handle";
import { isValidPrivkeyHex } from "@/keys";
import { ActionFooter } from "@/ui/actionFooter";

export default function ImportKeypair() {
  const router = useRouter();
  const params = useLocalSearchParams<{ handle?: string }>();
  const { handles, importKeypair } = useStore();
  const { scheme, colors } = useTheme();
  const handle = useNativeState(params.handle ?? "");
  const privkey = useNativeState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const submit = async () => {
    if (isLoading || handles === null) return;
    setError(null);
    const h = handle.value.trim().toLowerCase();
    const pk = privkey.value.trim().toLowerCase();
    if (!isValidHandle(h)) return setError("Enter a valid handle, e.g. me@bitcoin.");
    if (!isValidPrivkeyHex(pk)) return setError("Enter a valid 64-hex private key.");
    if (h in handles) return setError("This handle already exists in your keystore.");
    setIsLoading(true);
    try {
      await importKeypair(h, pk);
      // Re-root onto the Handles tab so Back returns to the list, not to this form.
      if (router.canDismiss()) router.dismissAll();
      router.navigate("/(main)/(tabs)/handles");
      router.push({ pathname: "/(main)/(tabs)/handles/show-handle", params: { handle: h } });
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : "Failed to import keypair");
    }
  };

  return (
    <>
      <Host style={boundedHost} colorScheme={scheme}>
        <FieldGroup>
          <FieldGroup.Section title="Handle">
            <ListItem>
              <TextInput
                value={handle}
                placeholder="me@bitcoin"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </ListItem>
          </FieldGroup.Section>

          <FieldGroup.Section title="Private key">
            <ListItem>
              <TextInput
                value={privkey}
                placeholder="private key (64 hex characters)"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                editable={!isLoading}
              />
            </ListItem>
            <FieldGroup.SectionFooter>
              <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                Adds a handle backed by an existing private key, not derived from
                your seed phrase.
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
        </FieldGroup>
      </Host>
      <ActionFooter
        primary={{
          label: isLoading ? "Importing…" : "Import keypair",
          onPress: submit,
          disabled: isLoading,
        }}
      />
    </>
  );
}
