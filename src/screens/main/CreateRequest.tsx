import React, { useState, useEffect, useMemo } from "react";
import { Text, TextInput, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";
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
  const [handle, setHandle] = useState(initialHandle || "");
  const [error, setError] = useState<CreateRequestError>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [support, setSupport] = useState<PurchaseSupport | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  // Whether the handle is already live on certrelay (so it has a fixed key that
  // isn't ours — deriving a new key would be pointless; import instead).
  const [registered, setRegistered] = useState<boolean | null>(null);

  const { handles, createHandle } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const valid = isValidHandle(handle);
  const canSubmit = handles !== null && !isLoading && valid;

  // Debounced check of whether this space is purchasable directly, so the UI can
  // tell the user upfront whether this is a direct buy or a request to an operator.
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

  const getMessage = (error: CreateRequestError): string => {
    switch (error) {
      case "handleExists":
        return "This handle already exists in your keystore.";
      case "handleTaken":
        return "This handle is already taken";
      default:
        return "";
    }
  };

  const hint = (): string | null => {
    if (!valid) {
      return null;
    }
    if (registered) {
      return "Already registered on the network — import its private key to manage it.";
    }
    if (support === null) {
      return null;
    }
    if (support === "supported") {
      return price !== null
        ? `Available to buy for ${formatPrice(price)} — purchase it on the next screen.`
        : "Available to buy directly — you can purchase it on the next screen.";
    }
    if (support === "unsupported") {
      return "Not sold here — this creates a request to send to an operator.";
    }
    return null;
  };

  const buttonText = isLoading
    ? "Checking..."
    : registered
      ? "Import Private Key"
      : support === "unsupported"
        ? "Create Request"
        : "Add Handle";

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    if (handle in handles) {
      setError("handleExists");
      return;
    }

    // Already on certrelay under a fixed key: don't derive a new one, import it.
    if (registered) {
      router.push({ pathname: "/(main)/import-keypair", params: { handle } });
      return;
    }

    setIsLoading(true);
    // Only block when the purchase rail positively reports the handle is taken.
    // An "invalid"/unsupported space isn't an error here — it just means this
    // handle goes through the create-request path instead of a direct purchase.
    const { status } = await fetchHandleStatus(handle);
    if (status === "taken") {
      setError("handleTaken");
      setIsLoading(false);
      return;
    }
    try {
      await createHandle(handle);
      router.replace({ pathname: "/(main)/show-handle", params: { handle } });
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  };

  const hintText = hint();

  return (
    <Layout
      padTop
      footer={
        <Button
          text={buttonText}
          onPress={submit}
          type="main"
          disabled={!canSubmit}
        />
      }
    >
      <ScreenHeader
        title="Create a request"
        subtitle="Enter a handle to add it to your keystore and derive its key."
        onBack={() => router.back()}
      />
      <TextInput
        value={handle}
        onChangeText={(text) => {
          setHandle(text.trim().toLowerCase());
          setError(null);
        }}
        placeholder="me@bitcoin"
        placeholderTextColor={colors.placeholder}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isLoading}
      />
      {hintText && <Text style={styles.hint}>{hintText}</Text>}
      {error && <Message message={getMessage(error)} type="error" />}
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    input: {
      backgroundColor: c.field,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 17,
      fontSize: 16,
      color: c.text,
      fontFamily: "monospace",
      // @ts-ignore - web-only style to remove focus outline
      outlineStyle: "none",
    } as any,
    hint: {
      marginTop: 12,
      fontSize: 14,
      color: c.textMuted,
      lineHeight: 20,
    },
  });
