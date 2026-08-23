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
    action: "sale" | "transfer";
  }>();

  const txid = useNativeState("");
  const vout = useNativeState("0");
  const amount = useNativeState("");
  const to = useNativeState(""); // transfer
  const price = useNativeState(""); // sale
  const payout = useNativeState(""); // sale: where the seller gets paid
  const [error, setError] = React.useState<string | null>(null);

  const isSale = action === "sale";
  const title = isSale ? "Sell handle" : "Transfer handle";

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
    let payoutParam: string | undefined;
    if (isSale) {
      const priceN = Number(price.value);
      if (!Number.isInteger(priceN) || priceN <= 0)
        return setError("Enter a price in ₿ base units.");
      if (!payout.value.trim())
        return setError("Enter the bitcoin address where you’ll be paid.");
      payoutParam = payout.value.trim();
      req = { v: 1, type: "sale", handle: handle!, price: priceN, outpoint };
    } else {
      const recipient = to.value.trim();
      if (recipient) {
        // A recipient → transfer to them.
        if (!/^[0-9a-fA-F]+$/.test(recipient))
          return setError("Enter the recipient's script (hex), or leave it empty to rotate.");
        req = {
          v: 1,
          type: "transfer",
          handle: handle!,
          to: recipient.toLowerCase(),
          outpoint,
        };
      } else {
        // No recipient → just rotate the key to a fresh one (same owner).
        req = { v: 1, type: "rotate", handle: handle!, outpoint };
      }
    }
    const param = extractReqParam(encodeSignRequest(req));
    router.replace({
      pathname: "/(main)/sign",
      params: { req: param ?? "", ...(payoutParam ? { payout: payoutParam } : {}) },
    });
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
            <>
              <FieldGroup.Section title="Price (₿ base units)">
                <ListItem>
                  <TextInput value={price} placeholder="500000" keyboardType="number-pad" />
                </ListItem>
              </FieldGroup.Section>
              <FieldGroup.Section title="You get paid to">
                <ListItem>
                  <TextInput
                    value={payout}
                    placeholder="bc1… (your bitcoin address)"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </ListItem>
                <FieldGroup.SectionFooter>
                  <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                    Where the sale proceeds are sent when a buyer takes the handle —
                    not the handle’s own address.
                  </Text>
                </FieldGroup.SectionFooter>
              </FieldGroup.Section>
            </>
          ) : null}

          {!isSale ? (
            <FieldGroup.Section title="Recipient (optional)">
              <ListItem>
                <TextInput value={to} placeholder="5120… recipient script (hex)" autoCapitalize="none" autoCorrect={false} />
              </ListItem>
              <FieldGroup.SectionFooter>
                <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                  Leave empty to just rotate this handle to a fresh key (you keep
                  ownership). Enter a recipient’s script to transfer it to them.
                </Text>
              </FieldGroup.SectionFooter>
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
