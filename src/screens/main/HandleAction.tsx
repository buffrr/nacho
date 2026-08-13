import React from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  Host,
  FieldGroup,
  ListItem,
  Icon,
  Text,
  TextInput,
  useNativeState,
} from "@expo/ui";
import { useTheme } from "@/theme";
import { ActionFooter } from "@/ui/actionFooter";
import { encodeSignRequest, extractReqParam, SignRequest } from "@/signRequest";

// User-initiated Sell / Transfer / Rotate, off any QR/deeplink: the user supplies
// the handle's current outpoint (txid:vout + value) and terms, and we build the
// same v2 envelope + route through /sign. Native @expo/ui form.
export default function HandleAction() {
  const { scheme, colors } = useTheme();
  const router = useRouter();
  const { handle, action } = useLocalSearchParams<{
    handle: string;
    action: "sale" | "transfer" | "rotate";
  }>();

  const txid = useNativeState("");
  const vout = useNativeState("0");
  const amount = useNativeState("");
  const to = useNativeState(""); // transfer
  const price = useNativeState(""); // sale
  const [error, setError] = React.useState<string | null>(null);

  const isSale = action === "sale";
  const isRotate = action === "rotate";
  const title = isSale ? "Sell handle" : isRotate ? "Rotate key" : "Transfer handle";

  const proceed = () => {
    setError(null);
    if (!/^[0-9a-fA-F]{64}$/.test(txid.value.trim()))
      return setError("Enter a valid 64-character txid.");
    const voutN = Number(vout.value);
    const amountN = Number(amount.value);
    if (!Number.isInteger(voutN) || voutN < 0) return setError("Enter a valid vout.");
    if (!Number.isInteger(amountN) || amountN <= 0)
      return setError("Enter the UTXO value in ₿ base units.");

    const outpoint = { txid: txid.value.trim().toLowerCase(), vout: voutN, amount: amountN };
    let req: SignRequest;
    if (isSale) {
      const priceN = Number(price.value);
      if (!Number.isInteger(priceN) || priceN <= 0)
        return setError("Enter a price in ₿ base units.");
      req = { v: 1, type: "sale", handle: handle!, price: priceN, outpoint };
    } else if (isRotate) {
      req = { v: 1, type: "rotate", handle: handle!, outpoint };
    } else {
      if (!/^[0-9a-fA-F]+$/.test(to.value.trim()))
        return setError("Enter the recipient's script (hex).");
      req = {
        v: 1,
        type: "transfer",
        handle: handle!,
        to: to.value.trim().toLowerCase(),
        outpoint,
      };
    }
    const param = extractReqParam(encodeSignRequest(req));
    router.replace({ pathname: "/(main)/sign", params: { req: param ?? "" } });
  };

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Host style={{ flex: 1 }} colorScheme={scheme}>
        <FieldGroup>
          <FieldGroup.Section title="Current UTXO">
            <ListItem>
              <TextInput value={txid} placeholder="txid (64 hex)" autoCapitalize="none" autoCorrect={false} />
            </ListItem>
            <ListItem>
              <TextInput value={vout} placeholder="vout" keyboardType="number-pad" />
            </ListItem>
            <ListItem>
              <TextInput value={amount} placeholder="value (₿ base units)" keyboardType="number-pad" />
            </ListItem>
            <FieldGroup.SectionFooter>
              <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                You’ll review and sign on the next screen.
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>

          {isSale ? (
            <FieldGroup.Section title="Price (₿ base units)">
              <ListItem>
                <TextInput value={price} placeholder="500000" keyboardType="number-pad" />
              </ListItem>
            </FieldGroup.Section>
          ) : null}

          {!isSale && !isRotate ? (
            <FieldGroup.Section title="Recipient script (hex)">
              <ListItem>
                <TextInput value={to} placeholder="5120…" autoCapitalize="none" autoCorrect={false} />
              </ListItem>
            </FieldGroup.Section>
          ) : null}

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
      <ActionFooter primary={{ label: "Review", onPress: proceed }} />
    </>
  );
}
