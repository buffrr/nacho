import React, { useState, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Host,
  FieldGroup,
  ListItem,
  Icon,
  Text,
  TextInput,
  useNativeState,
} from "@expo/ui";
import { useStore } from "@/Store";
import { useTheme, boundedHost } from "@/theme";
import { ActionFooter } from "@/ui/actionFooter";
import {
  fetchHandleStatus,
  checkPurchaseInfo,
  PurchaseSupport,
  formatPrice,
} from "@/api";
import { resolveHandle } from "@/fabric";
import { isValidHandle } from "@/handle";

type CreateRequestError = "handleExists" | "handleTaken" | null;

export default function CreateRequest() {
  const router = useRouter();
  const { initialHandle } = useLocalSearchParams<{ initialHandle?: string }>();
  const handleObs = useNativeState(initialHandle || ""); // native input display
  const [handle, setHandle] = useState(initialHandle || ""); // drives checks/hint
  const [error, setError] = useState<CreateRequestError>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [support, setSupport] = useState<PurchaseSupport | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [registered, setRegistered] = useState<boolean | null>(null);

  const { handles, createHandle } = useStore();
  const { scheme, colors } = useTheme();

  const valid = isValidHandle(handle);
  const canSubmit = handles !== null && !isLoading && valid;

  useEffect(() => {
    if (!valid) {
      setSupport(null);
      setPrice(null);
      setRegistered(null);
      return;
    }
    setSupport(null);
    setPrice(null);
    setRegistered(null);
    let active = true;
    const timeoutId = setTimeout(async () => {
      const [info, resolved] = await Promise.all([
        checkPurchaseInfo(handle),
        resolveHandle(handle).catch(() => null),
      ]);
      if (active) {
        setSupport(info.support);
        setPrice(info.price ?? null);
        setRegistered(resolved !== null);
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [handle, valid]);

  const hint = (): string => {
    if (!valid) return "Enter a handle to add it to your keystore and derive its key.";
    if (registered)
      return "Already registered on the network — import its private key to manage it.";
    if (support === null) return "Checking availability…";
    if (support === "supported")
      return price !== null
        ? `Available to buy for ${formatPrice(price)} — purchase it on the next screen.`
        : "Available to buy directly — you can purchase it on the next screen.";
    if (support === "unsupported")
      return "Not sold here — this creates a request to send to an operator.";
    return "";
  };

  const buttonText = isLoading
    ? "Checking…"
    : registered
      ? "Import private key"
      : support === "unsupported"
        ? "Create request"
        : "Add handle";

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    if (handle in handles!) return setError("handleExists");
    if (registered) {
      router.push({ pathname: "/(main)/(tabs)/handles/import-keypair", params: { handle } });
      return;
    }
    setIsLoading(true);
    const { status } = await fetchHandleStatus(handle);
    if (status === "taken") {
      setError("handleTaken");
      setIsLoading(false);
      return;
    }
    try {
      await createHandle(handle);
      // Re-root onto the Handles tab so the handle sits on the list (Back → Handles),
      // not stranded on top of the register-hub modal with nothing beneath it.
      if (router.canDismiss()) router.dismissAll();
      router.navigate("/(main)/(tabs)/handles");
      router.push({ pathname: "/(main)/(tabs)/handles/show-handle", params: { handle } });
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  };

  return (
    <>
      <Host style={boundedHost} colorScheme={scheme}>
        <FieldGroup>
          <FieldGroup.Section title="Handle">
            <ListItem>
              <TextInput
                value={handleObs}
                placeholder="me@bitcoin"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                onChangeText={(t) => {
                  setHandle(t.trim().toLowerCase());
                  setError(null);
                }}
              />
            </ListItem>
            <FieldGroup.SectionFooter>
              <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                {hint()}
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>

          {error ? (
            <FieldGroup.Section>
              <ListItem
                leading={<Icon name="exclamationmark.triangle.fill" size={18} color={colors.dangerText} />}
              >
                <Text textStyle={{ color: colors.textSecondary }}>
                  {error === "handleExists"
                    ? "This handle already exists in your keystore."
                    : "This handle is already taken."}
                </Text>
              </ListItem>
            </FieldGroup.Section>
          ) : null}
        </FieldGroup>
      </Host>
      <ActionFooter
        primary={{ label: buttonText, onPress: submit, disabled: !canSubmit }}
      />
    </>
  );
}
