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
import { ActionFooter } from "@/ui/actionFooter";
import { claimCode } from "@/api";

export default function Redeem() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const { nextScriptPubkey, createHandle, setHandlePurchase } = useStore();
  const { scheme, colors } = useTheme();
  const code = useNativeState(params.code ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const redeem = async () => {
    if (isLoading) return;
    setError(null);
    if (!code.value.trim()) return setError("Enter your claim code.");
    const script = nextScriptPubkey();
    if (!script) return setError("Keystore not ready.");

    setIsLoading(true);
    const result = await claimCode(code.value.trim(), script);
    if (!result.ok) {
      setIsLoading(false);
      if (result.httpStatus === 402) {
        setError("Payment hasn’t settled yet — wait a few seconds and retry.");
      } else if (result.httpStatus === 409) {
        setError("This code has already been redeemed.");
      } else {
        setError(result.error);
      }
      return;
    }

    try {
      await createHandle(result.handle);
      await setHandlePurchase(result.handle, {});
      if (router.canDismiss()) router.dismissAll();
      router.navigate("/(main)/(tabs)/handles");
      router.push({
        pathname: "/(main)/(tabs)/handles/show-handle",
        params: { handle: result.handle },
      });
    } catch {
      setIsLoading(false);
      setError("Redeemed, but failed to save the handle.");
    }
  };

  return (
    <>
      <Host style={boundedHost} colorScheme={scheme}>
        <FieldGroup>
          <FieldGroup.Section title="Claim code">
            <ListItem>
              <TextInput
                value={code}
                placeholder="ABCD-EFGH-JKLM"
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isLoading}
              />
            </ListItem>
            <FieldGroup.SectionFooter>
              <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                Enter your claim code to bind it to a
                new key in this keystore.
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
          label: isLoading ? "Redeeming…" : "Redeem",
          onPress: redeem,
          disabled: isLoading,
        }}
      />
    </>
  );
}
