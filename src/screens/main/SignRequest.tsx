import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  Host,
  Column as NColumn,
  Row as NRow,
  Spacer as NSpacer,
  Checkbox as NCheckbox,
  TextInput as NTextInput,
  useNativeState,
} from "@expo/ui";
import { Icon as NIcon } from "@/ui/icon";
import { FieldGroup as NFieldGroup } from "@/ui/fieldGroup";
import { Text as NText } from "@/ui/text";
import { ListItem as NListItem } from "@/ui/listItem";
import { Colors, useTheme, boundedHost } from "@/theme";
import { Layout } from "@/ui/Layout";
import { Message } from "@/ui/Message";
import { ActionFooter } from "@/ui/actionFooter";
import { ChunkedValue } from "@/ui/ChunkedValue";
import { useStore } from "@/Store";
import {
  AtSign,
  Check,
  AlertCircle,
  Plus,
  Trash,
  ChevronRight,
} from "@/ui/icons";
import {
  decodeSignRequest,
  applyOps,
  RecordDiff,
  MessageRequest,
  RecordsRequest,
  TransferRequest,
  SaleRequest,
  RotateRequest,
  SignRequest as SignReq,
} from "@/signRequest";
import { editableFromZone, EditableRecord } from "@/fabricResolver";
import { resolveHandle, exportCert, publishRecords } from "@/fabric";
import { loadCert, saveCert } from "@/certStore";
import { recordsGet } from "@/db";
import { tierFor, warningLine, needsAck } from "@/recordTiers";
import { lookupRecord } from "@/recordRegistry";
import { RecordGlyph } from "@/ui/handleProfileNative";
import { remainingValidity, formatBtc } from "@/format";
import { signMessage } from "@/messageSign";
import { scriptForHandle } from "@/keys";
import {
  signSingleAnyonecanpay,
  addressToScriptHex,
  DUST_LIMIT,
} from "@/psbtSign";
import { addOffer } from "@/offers";
import { authenticate } from "@/auth";

// Confirmation screens for a signing request (design-notes.md / mockups.html).
// Decodes the untrusted envelope and shows the exact effect before approval. No
// `origin` is ever shown — only an endpoint-derived host, and only at send time.
export default function SignRequest() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { req } = useLocalSearchParams<{ req?: string }>();

  const decoded = useMemo(():
    | { ok: true; value: SignReq }
    | { ok: false; error: string } => {
    try {
      return { ok: true, value: decodeSignRequest(req ?? "") };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Invalid request." };
    }
  }, [req]);

  if (!decoded.ok) {
    return (
      <Layout underHeader>
        <Stack.Screen options={{ title: "Request" }} />
        <View style={styles.mt}>
          <Message message={decoded.error} type="error" />
        </View>
      </Layout>
    );
  }

  const r = decoded.value;
  switch (r.type) {
    case "message":
      return <MessageConfirm request={r} styles={styles} colors={colors} />;
    case "records":
      return <RecordsConfirm request={r} styles={styles} colors={colors} />;
    case "transfer":
      return <TransferConfirm request={r} styles={styles} colors={colors} />;
    case "sale":
      return <SaleConfirm request={r} styles={styles} colors={colors} />;
    case "rotate":
      return <RotateConfirm request={r} styles={styles} colors={colors} />;
    default:
      return (
        <Layout underHeader>
          <Stack.Screen options={{ title: "Request" }} />
          <View style={styles.mt}>
            <Message message="Unknown request type." type="error" />
          </View>
        </Layout>
      );
  }
}

// ---- endpoint helpers -------------------------------------------------------

function hostOf(url: string): string {
  const m = url.match(/^[a-z]+:\/\/([^/:?#]+)/i);
  return m ? m[1] : url;
}

async function postToEndpoint(endpoint: string, body: string): Promise<void> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) throw new Error(`Send failed (${res.status}).`);
}

// ---- shared result ----------------------------------------------------------

function ResultView({
  heading,
  sub,
  blob,
  response,
  endpoint,
  styles,
  colors,
}: {
  heading: string;
  sub: string;
  blob: string;
  response: string;
  endpoint?: string;
  styles: Styles;
  colors: Colors;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const host = endpoint ? hostOf(endpoint) : null;

  const copy = async () => {
    await Clipboard.setStringAsync(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  // Safe dismissal: fall back to the handles tab if there's no back entry (e.g.
  // this screen was reached via a path that left no history) so "Done" can never
  // throw "GO_BACK was not handled by any navigator".
  const done = () =>
    router.canGoBack() ? router.back() : router.replace("/(main)/(tabs)/handles");
  const send = async () => {
    if (!endpoint) return;
    setSending(true);
    setError(null);
    try {
      await postToEndpoint(endpoint, response);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setSending(false);
    }
  };

  const { scheme } = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: "Signed" }} />
      <Host style={boundedHost} colorScheme={scheme}>
        <NFieldGroup>
          <NFieldGroup.Section>
            <NFieldGroup.SectionHeader>
              <NRow alignment="center">
                <NSpacer flexible />
                <NColumn alignment="center" spacing={8}>
                  <NIcon name="checkmark.circle.fill" size={46} color={colors.statusGreenFg} />
                  <NText textStyle={{ fontSize: 14, color: colors.textSecondary }}>
                    {heading}
                  </NText>
                  <NText textStyle={{ fontSize: 20, fontWeight: "700", color: colors.text }}>
                    {sent ? `Sent to ${host}` : sub}
                  </NText>
                </NColumn>
                <NSpacer flexible />
              </NRow>
            </NFieldGroup.SectionHeader>
            <NListItem>
              <NText textStyle={{ color: colors.textSecondary }}>{blob}</NText>
            </NListItem>
          </NFieldGroup.Section>

          {error ? (
            <NFieldGroup.Section>
              <NListItem
                leading={
                  <NIcon name="exclamationmark.triangle.fill" size={18} color={colors.dangerText} />
                }
              >
                <NText textStyle={{ color: colors.textSecondary }}>{error}</NText>
              </NListItem>
            </NFieldGroup.Section>
          ) : null}

        </NFieldGroup>
      </Host>
      <ActionFooter
        primary={
          host && !sent
            ? { label: sending ? "Sending…" : `Send to ${host}`, onPress: send, disabled: sending }
            : { label: copied ? "Copied ✓" : "Copy response", onPress: copy }
        }
        secondary={
          host && !sent
            ? { label: copied ? "Copied ✓" : "Copy response", onPress: copy }
            : { label: "Done", onPress: done }
        }
      />
    </>
  );
}

// ---- message (sign-in) ------------------------------------------------------

function MessageConfirm({
  request,
  styles,
  colors,
}: {
  request: MessageRequest;
  styles: Styles;
  colors: Colors;
}) {
  const router = useRouter();
  const { scheme } = useTheme();
  const { handles, getSigningKey } = useStore();
  const owned = useMemo(() => (handles ? Object.keys(handles) : []), [handles]);
  const [handle, setHandle] = useState<string | null>(request.handle ?? null);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const host = request.endpoint ? hostOf(request.endpoint) : null;

  const sign = useCallback(async () => {
    if (!handle) return;
    setSigning(true);
    setError(null);
    try {
      const key = await getSigningKey(handle);
      if (!key) throw new Error("No private key available for this handle.");
      const res = signMessage(handle, request.challenge, key, request.ref);
      setResponse(JSON.stringify(res));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign.");
    } finally {
      setSigning(false);
    }
  }, [handle, request, getSigningKey]);

  if (response) {
    return (
      <ResultView
        heading="Signed"
        sub={host ? "Nothing has been sent yet" : "Paste this back where you started"}
        blob={response}
        response={response}
        endpoint={request.endpoint}
        styles={styles}
        colors={colors}
      />
    );
  }

  if (!handle) {
    return (
      <>
        <Stack.Screen options={{ title: "Sign message" }} />
        <Host style={boundedHost} colorScheme={scheme}>
          <NFieldGroup>
            <NFieldGroup.Section title="Sign with">
              {owned.map((h) => (
                <NListItem
                  key={h}
                  leading={<NIcon name="at" size={22} color={colors.accent} />}
                  trailing={<NIcon name="chevron.forward" size={14} color={colors.chevron} />}
                  onPress={() => setHandle(h)}
                >
                  <NText>{h}</NText>
                </NListItem>
              ))}
            </NFieldGroup.Section>
          </NFieldGroup>
        </Host>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Sign message" }} />
      <Host style={boundedHost} colorScheme={scheme}>
        <NFieldGroup>
          <NFieldGroup.Section>
            <NFieldGroup.SectionHeader>
              <NRow alignment="center">
                <NSpacer flexible />
                <NColumn alignment="center" spacing={8}>
                  <NIcon name="signature" size={38} color={colors.accent} />
                  <NText textStyle={{ fontSize: 14, color: colors.textSecondary }}>
                    Sign with
                  </NText>
                  <NText textStyle={{ fontSize: 20, fontWeight: "700", color: colors.text }}>{handle}</NText>
                </NColumn>
                <NSpacer flexible />
              </NRow>
            </NFieldGroup.SectionHeader>
          </NFieldGroup.Section>

          {/* Show exactly what will be signed, verbatim. */}
          <NFieldGroup.Section title="Message">
            <NListItem>
              <NText textStyle={{ color: colors.text }}>{request.challenge}</NText>
            </NListItem>
            {request.exp !== undefined ? (
              <NListItem
                trailing={
                  <NText textStyle={{ color: colors.textSecondary }}>
                    {remainingValidity(request.exp)}
                  </NText>
                }
              >
                <NText>Expires</NText>
              </NListItem>
            ) : null}
            <NFieldGroup.SectionFooter>
              <NText textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                {host
                  ? `Signs the text above with ${handle}. The signature is sent to ${host} only when you tap Sign — nothing before that.`
                  : `Signs the text above with ${handle} — proof this handle's key signed it. Your records aren't changed.`}
              </NText>
            </NFieldGroup.SectionFooter>
          </NFieldGroup.Section>

          {error ? (
            <NFieldGroup.Section>
              <NListItem
                leading={
                  <NIcon name="exclamationmark.triangle.fill" size={18} color={colors.dangerText} />
                }
              >
                <NText textStyle={{ color: colors.textSecondary }}>{error}</NText>
              </NListItem>
            </NFieldGroup.Section>
          ) : null}

        </NFieldGroup>
      </Host>
      <ActionFooter
        primary={{
          label: signing ? "Signing…" : host ? `Sign & send to ${host}` : "Sign",
          onPress: sign,
          disabled: signing,
        }}
        secondary={{ label: "Cancel", onPress: () => router.back() }}
      />
    </>
  );
}

// ---- records ----------------------------------------------------------------

function RecordsConfirm({
  request,
  styles,
  colors,
}: {
  request: RecordsRequest;
  styles: Styles;
  colors: Colors;
}) {
  const router = useRouter();
  const { scheme } = useTheme();
  const { handles, getSigningKey } = useStore();
  const owned = useMemo(() => (handles ? Object.keys(handles) : []), [handles]);
  const [handle, setHandle] = useState<string | null>(request.handle ?? null);
  const [phase, setPhase] = useState<
    "picking" | "review" | "publishing" | "changed" | "done"
  >(request.handle ? "review" : "picking");
  const [error, setError] = useState<string | null>(null);
  // Diff shown to the user: computed from the CACHED zone at review, or the live
  // zone on the "changed" screen.
  const [diff, setDiff] = useState<RecordDiff | null>(null);
  const [acks, setAcks] = useState<Record<number, boolean>>({});

  // Ownership check for a requested handle.
  useEffect(() => {
    if (request.handle && handles && !handles[request.handle]) {
      setError(`You don't own ${request.handle}.`);
      setHandle(null);
      setPhase("picking");
    }
  }, [request.handle, handles]);

  // Compute the displayed diff from the cached zone (no network) once a handle is set.
  useEffect(() => {
    if (!handle || phase !== "review") return;
    let cancelled = false;
    (async () => {
      let current: EditableRecord[] = [];
      try {
        const json = await recordsGet(handle);
        if (json) {
          const parsed = JSON.parse(json);
          current = Array.isArray(parsed.records) ? parsed.records : [];
        }
      } catch {
        current = [];
      }
      if (cancelled) return;
      setDiff(applyOps(current, request.ops));
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, phase, request.ops]);

  // Ack gating: destination/identity ADDS need a recognition tap.
  const ackable = useMemo(() => {
    if (!diff) return [] as number[];
    return diff.added
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => needsAck(tierFor(r.type, r.key)))
      .map(({ i }) => i);
  }, [diff]);
  const allAcked = ackable.every((i) => acks[i]);

  const resolveLive = async (): Promise<{ records: EditableRecord[]; seq: number }> => {
    const resolved = await Promise.race([
      resolveHandle(handle!),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timed out loading current records.")), 20000),
      ),
    ]);
    return resolved ? editableFromZone(resolved.zone) : { records: [], seq: 0 };
  };

  const publishDiff = async (d: RecordDiff, lastSeq: number) => {
    const key = await getSigningKey(handle!);
    if (!key) throw new Error("No private key available for this handle.");
    let cert = await loadCert(handle!);
    if (!cert) {
      cert = await exportCert(handle!);
      await saveCert(handle!, cert);
    }
    // Monotonic seq: unix seconds, but never collide/regress against the last one.
    const seq = Math.max(Math.floor(Date.now() / 1000), lastSeq + 1);
    await publishRecords(cert, d.next, seq, key);
  };

  const approve = useCallback(async () => {
    if (!handle || !diff) return;
    setError(null);
    setPhase("publishing");
    try {
      const live = await resolveLive();
      const liveDiff = applyOps(live.records, request.ops);
      // If the real diff differs from what we showed, require a second look.
      const changed =
        JSON.stringify(liveDiff.next) !== JSON.stringify(diff.next);
      if (changed) {
        setDiff(liveDiff);
        setPhase("changed");
        return;
      }
      await publishDiff(liveDiff, live.seq);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish records.");
      setPhase("review");
    }
  }, [handle, diff, request.ops, getSigningKey]);

  const publishAnyway = useCallback(async () => {
    if (!handle || !diff) return;
    setError(null);
    setPhase("publishing");
    try {
      const live = await resolveLive();
      await publishDiff(applyOps(live.records, request.ops), live.seq);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish records.");
      setPhase("changed");
    }
  }, [handle, diff, request.ops, getSigningKey]);

  if (phase === "picking" || !handle) {
    return (
      <>
        <Stack.Screen options={{ title: "Sign in" }} />
        <Host style={boundedHost} colorScheme={scheme}>
          <NFieldGroup>
            {error ? (
              <NFieldGroup.Section>
                <NListItem
                  leading={
                    <NIcon name="exclamationmark.triangle.fill" size={18} color={colors.dangerText} />
                  }
                >
                  <NText textStyle={{ color: colors.textSecondary }}>{error}</NText>
                </NListItem>
              </NFieldGroup.Section>
            ) : null}
            <NFieldGroup.Section title="Choose the handle to use">
              {owned.map((h) => (
                <NListItem
                  key={h}
                  leading={<NIcon name="at" size={22} color={colors.accent} />}
                  trailing={<NIcon name="chevron.forward" size={14} color={colors.chevron} />}
                  onPress={() => {
                    setError(null);
                    setHandle(h);
                    setPhase("review");
                  }}
                >
                  <NText>{h}</NText>
                </NListItem>
              ))}
            </NFieldGroup.Section>
          </NFieldGroup>
        </Host>
      </>
    );
  }

  if (phase === "done") {
    return (
      <>
        <Stack.Screen options={{ title: "Done" }} />
        <Host style={boundedHost} colorScheme={scheme}>
          <NFieldGroup>
            <NFieldGroup.Section>
              <NFieldGroup.SectionHeader>
                <NRow alignment="center">
                  <NSpacer flexible />
                  <NColumn alignment="center" spacing={8}>
                    <NIcon name="checkmark.circle.fill" size={46} color={colors.statusGreenFg} />
                    <NText textStyle={{ fontSize: 20, fontWeight: "700", color: colors.text }}>
                      Records published
                    </NText>
                    <NText textStyle={{ fontSize: 14, color: colors.textSecondary }}>
                      {`${handle} was updated.`}
                    </NText>
                  </NColumn>
                  <NSpacer flexible />
                </NRow>
              </NFieldGroup.SectionHeader>
            </NFieldGroup.Section>
          </NFieldGroup>
        </Host>
        <ActionFooter
          primary={
            request.return
              ? {
                  label: `Return to ${hostOf(request.return)}`,
                  onPress: () => {
                    Linking.openURL(request.return!).catch(() => {});
                    router.back();
                  },
                }
              : { label: "Done", onPress: () => router.back() }
          }
        />
      </>
    );
  }

  const changed = phase === "changed";
  const busy = phase === "publishing";
  const canApprove = !busy && (changed || allAcked);

  return (
    <>
      <Stack.Screen
        options={{ title: changed ? "Records changed" : "Approve record change" }}
      />
      <Host style={boundedHost} colorScheme={scheme}>
        <NFieldGroup>
          {changed ? (
            <NFieldGroup.Section>
              <NListItem
                leading={
                  <NIcon name="exclamationmark.triangle.fill" size={18} color={colors.statusAmberFg} />
                }
              >
                <NText textStyle={{ color: colors.textSecondary }}>
                  This handle changed since the last screen. Here’s what would
                  actually happen now.
                </NText>
              </NListItem>
            </NFieldGroup.Section>
          ) : null}

          {diff ? (
            <RecordDiffView
              diff={diff}
              acks={acks}
              setAck={(i, v) => setAcks((a) => ({ ...a, [i]: v }))}
              colors={colors}
            />
          ) : null}

          <NFieldGroup.Section title="Publishing to">
            <NListItem trailing={<NText textStyle={{ color: colors.textSecondary }}>{handle}</NText>}>
              <NText>Handle</NText>
            </NListItem>
            {request.exp !== undefined ? (
              <NListItem
                trailing={
                  <NText textStyle={{ color: colors.textSecondary }}>
                    {remainingValidity(request.exp)}
                  </NText>
                }
              >
                <NText>Expires</NText>
              </NListItem>
            ) : null}
          </NFieldGroup.Section>

          {error ? (
            <NFieldGroup.Section>
              <NListItem
                leading={
                  <NIcon name="exclamationmark.triangle.fill" size={18} color={colors.dangerText} />
                }
              >
                <NText textStyle={{ color: colors.textSecondary }}>{error}</NText>
              </NListItem>
            </NFieldGroup.Section>
          ) : null}

        </NFieldGroup>
      </Host>
      <ActionFooter
        primary={{
          label: busy ? "Publishing…" : changed ? "Publish anyway" : "Approve & publish",
          onPress: changed ? publishAnyway : approve,
          disabled: !canApprove,
        }}
        secondary={{ label: "Cancel", onPress: () => router.back(), disabled: busy }}
      />
    </>
  );
}

// The record diff, rendered as native grouped sections — one section per op so
// the exact key + value the user is approving is always visible. Destination /
// identity records show a warning + an ack the user must tick.
function RecordDiffView({
  diff,
  acks,
  setAck,
  colors,
}: {
  diff: RecordDiff;
  acks: Record<number, boolean>;
  setAck: (i: number, v: boolean) => void;
  colors: Colors;
}) {
  return (
    <>
      {diff.added.map((r, i) => {
        const { def } = lookupRecord(r.type, r.key);
        const warn = warningLine(tierFor(r.type, r.key));
        const mustAck = needsAck(tierFor(r.type, r.key));
        return (
          <NFieldGroup.Section key={`a${i}`} title={`Add · ${r.type} · ${r.key}`}>
            <NListItem
              leading={<RecordGlyph def={def} size={28} color={def.color} />}
              trailing={
                <NText textStyle={{ color: colors.statusGreenFg, fontWeight: "700" }}>
                  ADD
                </NText>
              }
            >
              <NText>{def.label}</NText>
            </NListItem>
            <NListItem>
              <NText>{r.value.join(" ")}</NText>
            </NListItem>
            {warn ? (
              <NFieldGroup.SectionFooter>
                <NText textStyle={{ fontSize: 12, color: colors.statusAmberFg }}>
                  {warn}
                </NText>
              </NFieldGroup.SectionFooter>
            ) : null}
            {mustAck ? (
              <NCheckbox
                value={!!acks[i]}
                onValueChange={(v) => setAck(i, v)}
                label="I’ve read this and it’s the one I meant to add"
              />
            ) : null}
          </NFieldGroup.Section>
        );
      })}

      {diff.replaced.map((r, i) => {
        const { def } = lookupRecord(r.after.type, r.after.key);
        return (
          <NFieldGroup.Section
            key={`r${i}`}
            title={`Replace · ${r.after.type} · ${r.after.key}`}
          >
            <NListItem
              leading={<RecordGlyph def={def} size={28} color={def.color} />}
              trailing={<NText textStyle={{ color: colors.textSecondary }}>was</NText>}
            >
              <NText textStyle={{ color: colors.textSecondary }}>
                {r.before.value.join(" ")}
              </NText>
            </NListItem>
            <NListItem
              trailing={
                <NText textStyle={{ color: colors.statusGreenFg, fontWeight: "700" }}>
                  now
                </NText>
              }
            >
              <NText>{r.after.value.join(" ")}</NText>
            </NListItem>
          </NFieldGroup.Section>
        );
      })}

      {diff.removed.map((r, i) => {
        const { def } = lookupRecord(r.type, r.key);
        return (
          <NFieldGroup.Section key={`d${i}`} title={`Remove · ${r.type} · ${r.key}`}>
            <NListItem
              leading={<RecordGlyph def={def} size={28} color={def.color} />}
              trailing={
                <NText textStyle={{ color: colors.dangerText, fontWeight: "700" }}>
                  REMOVE
                </NText>
              }
            >
              <NText textStyle={{ color: colors.textSecondary }}>
                {r.value.join(" ")}
              </NText>
            </NListItem>
          </NFieldGroup.Section>
        );
      })}
    </>
  );
}

// ---- transfer ---------------------------------------------------------------

function TransferConfirm({
  request,
  styles,
  colors,
}: {
  request: TransferRequest;
  styles: Styles;
  colors: Colors;
}) {
  const router = useRouter();
  const { scheme } = useTheme();
  const { handles, xpub, getSigningKey } = useStore();
  const [ack, setAck] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);

  const data = handles?.[request.handle];
  const inputScript = data && xpub ? scriptForHandle(xpub, data) : null;
  const toMine = useMemo(
    () =>
      !!(
        xpub &&
        handles &&
        Object.values(handles).some(
          (d) => scriptForHandle(xpub, d).toLowerCase() === request.to.toLowerCase(),
        )
      ),
    [xpub, handles, request.to],
  );

  const sign = useCallback(async () => {
    if (!data || !xpub || !inputScript) {
      setError("You don't own this handle.");
      return;
    }
    setSigning(true);
    setError(null);
    try {
      const key = await getSigningKey(request.handle);
      if (!key) throw new Error("No private key available for this handle.");
      const psbt = signSingleAnyonecanpay(
        { ...request.outpoint, script: inputScript },
        { script: request.to, amount: request.outpoint.amount }, // equal value = ownership move
        key,
      );
      await addOffer({
        id: request.ref ?? String(Date.now()),
        handle: request.handle,
        kind: "transfer",
        outpoint: request.outpoint,
        to: request.to,
        psbtB64: psbt,
        createdAt: Date.now(),
        status: "live",
      });
      setResponse(psbt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign.");
    } finally {
      setSigning(false);
    }
  }, [data, xpub, inputScript, request, getSigningKey]);

  if (response) {
    return (
      <ResultView
        heading="Transfer signed"
        sub="Broadcast this to move the handle"
        blob={response}
        response={response}
        endpoint={request.endpoint}
        styles={styles}
        colors={colors}
      />
    );
  }

  const canSign = !signing && (toMine || ack);

  return (
    <>
      <Stack.Screen options={{ title: "Transfer handle" }} />
      <Host style={boundedHost} colorScheme={scheme}>
        <NFieldGroup>
          <NFieldGroup.Section>
            <NFieldGroup.SectionHeader>
              <NRow alignment="center">
                <NSpacer flexible />
                <NColumn alignment="center" spacing={8}>
                  <NIcon name="arrow.right.circle.fill" size={40} color={colors.dangerText} />
                  <NText textStyle={{ fontSize: 20, fontWeight: "700", color: colors.text }}>
                    {`Give away ${request.handle}`}
                  </NText>
                  <NText textStyle={{ fontSize: 14, color: colors.textSecondary }}>
                    You will no longer control this handle
                  </NText>
                </NColumn>
                <NSpacer flexible />
              </NRow>
            </NFieldGroup.SectionHeader>
          </NFieldGroup.Section>

          <NFieldGroup.Section title={toMine ? "Recipient · your key" : "Recipient · external"}>
            <NListItem>
              <NText>{request.to}</NText>
            </NListItem>
            {!toMine ? (
              <NCheckbox
                value={ack}
                onValueChange={setAck}
                label="This matches the key the recipient gave me"
              />
            ) : null}
            <NFieldGroup.SectionFooter>
              <NText textStyle={{ fontSize: 12, color: colors.statusAmberFg }}>
                Once this transaction is broadcast, the handle is theirs. There is
                no way to undo it.
              </NText>
            </NFieldGroup.SectionFooter>
          </NFieldGroup.Section>

          {error ? (
            <NFieldGroup.Section>
              <NListItem
                leading={<NIcon name="exclamationmark.triangle.fill" size={18} color={colors.dangerText} />}
              >
                <NText textStyle={{ color: colors.textSecondary }}>{error}</NText>
              </NListItem>
            </NFieldGroup.Section>
          ) : null}

        </NFieldGroup>
      </Host>
      <ActionFooter
        primary={{
          label: signing ? "Signing…" : "Sign transfer",
          onPress: sign,
          disabled: !canSign,
          type: "danger",
        }}
        secondary={{ label: "Cancel", onPress: () => router.back() }}
      />
    </>
  );
}

// ---- sale -------------------------------------------------------------------

function SaleConfirm({
  request,
  styles,
  colors,
}: {
  request: SaleRequest;
  styles: Styles;
  colors: Colors;
}) {
  const router = useRouter();
  const { scheme } = useTheme();
  const { handles, xpub, getSigningKey } = useStore();
  // When the seller starts the sale from Options → Sell handle, they already
  // entered the payout address there — it arrives as a param and seeds the field.
  const { payout: payoutParam } = useLocalSearchParams<{ payout?: string }>();
  const payout = useNativeState(payoutParam ?? ""); // .value is the payout address
  const [payoutSource, setPayoutSource] = useState<string | null>(
    payoutParam ? "you entered" : null,
  );
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);

  const data = handles?.[request.handle];
  const inputScript = data && xpub ? scriptForHandle(xpub, data) : null;

  // If no payout was supplied, prefill from the user's own addr:btc record
  // (re-read live at sign).
  useEffect(() => {
    if (payoutParam) return; // already seeded from the Sell handle page
    let cancelled = false;
    (async () => {
      try {
        const r = await resolveHandle(request.handle);
        if (r && !cancelled) {
          const btc = editableFromZone(r.zone).records.find(
            (x) => x.type === "addr" && x.key.toLowerCase() === "btc",
          );
          if (btc?.value[0]) {
            payout.value = btc.value[0];
            setPayoutSource("addr · btc");
          }
        }
      } catch {
        // leave payout empty → user enters one
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request.handle, payoutParam]);

  const sign = useCallback(async () => {
    if (!data || !xpub || !inputScript) {
      setError("You don't own this handle.");
      return;
    }
    if (!payout.value.trim()) {
      setError("Enter a payout address.");
      return;
    }
    setError(null);
    let outScript: string;
    try {
      outScript = addressToScriptHex(payout.value);
    } catch {
      setError("That payout address isn't valid.");
      return;
    }
    const outAmount = request.outpoint.amount + request.price; // input + price
    if (outAmount < DUST_LIMIT) {
      setError("The payout would be below the dust limit.");
      return;
    }
    // Highest-consequence action — gate behind device auth (proceeds if none enrolled).
    const ok = await authenticate("Sign offer");
    if (!ok) {
      setError("Authentication failed.");
      return;
    }
    setSigning(true);
    try {
      const key = await getSigningKey(request.handle);
      if (!key) throw new Error("No private key available for this handle.");
      const psbt = signSingleAnyonecanpay(
        { ...request.outpoint, script: inputScript },
        { script: outScript, amount: outAmount },
        key,
      );
      await addOffer({
        id: request.ref ?? String(Date.now()),
        handle: request.handle,
        kind: "sale",
        outpoint: request.outpoint,
        price: request.price,
        psbtB64: psbt,
        createdAt: Date.now(),
        status: "live",
      });
      setResponse(psbt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign.");
    } finally {
      setSigning(false);
    }
  }, [data, xpub, inputScript, payout, request, getSigningKey]);

  if (response) {
    return (
      <ResultView
        heading="Offer signed"
        sub="This offer stays valid until you cancel it"
        blob={response}
        response={response}
        endpoint={request.endpoint}
        styles={styles}
        colors={colors}
      />
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Sell handle" }} />
      <Host style={boundedHost} colorScheme={scheme}>
        <NFieldGroup>
          <NFieldGroup.Section>
            <NFieldGroup.SectionHeader>
              <NRow alignment="center">
                <NSpacer flexible />
                <NColumn alignment="center" spacing={4}>
                  <NText textStyle={{ fontSize: 13, color: colors.textSecondary }}>
                    Asking price
                  </NText>
                  <NText textStyle={{ fontSize: 34, fontWeight: "800", color: colors.text }}>
                    {formatBtc(request.price)}
                  </NText>
                  <NText textStyle={{ fontSize: 14, color: colors.textSecondary }}>
                    {`for ${request.handle}`}
                  </NText>
                </NColumn>
                <NSpacer flexible />
              </NRow>
            </NFieldGroup.SectionHeader>
          </NFieldGroup.Section>

          <NFieldGroup.Section title="You get paid to">
            <NListItem>
              <NTextInput
                value={payout}
                placeholder="bc1…"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </NListItem>
            {payoutSource ? (
              <NFieldGroup.SectionFooter>
                <NText textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                  {`Prefilled from your ${payoutSource} record`}
                </NText>
              </NFieldGroup.SectionFooter>
            ) : null}
          </NFieldGroup.Section>

          <NFieldGroup.Section>
            <NListItem
              leading={<NIcon name="exclamationmark.triangle.fill" size={18} color={colors.statusAmberFg} />}
            >
              <NText>
                {`Anyone who pays ${formatBtc(request.price)} can take ownership of this handle. The offer stays valid until you cancel it (by moving the handle to yourself).`}
              </NText>
            </NListItem>
          </NFieldGroup.Section>

          {error ? (
            <NFieldGroup.Section>
              <NListItem
                leading={<NIcon name="exclamationmark.triangle.fill" size={18} color={colors.dangerText} />}
              >
                <NText textStyle={{ color: colors.textSecondary }}>{error}</NText>
              </NListItem>
            </NFieldGroup.Section>
          ) : null}

        </NFieldGroup>
      </Host>
      <ActionFooter
        primary={{
          label: signing ? "Signing…" : "Sign offer",
          onPress: sign,
          disabled: signing,
          type: "danger",
        }}
        secondary={{ label: "Cancel", onPress: () => router.back() }}
      />
    </>
  );
}

// ---- rotate -----------------------------------------------------------------

function RotateConfirm({
  request,
  styles,
  colors,
}: {
  request: RotateRequest;
  styles: Styles;
  colors: Colors;
}) {
  const router = useRouter();
  const { scheme } = useTheme();
  const { handles, xpub, getSigningKey, addPendingRotation } = useStore();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [newScript, setNewScript] = useState<string | null>(null);

  const data = handles?.[request.handle];
  const inputScript = data && xpub ? scriptForHandle(xpub, data) : null;

  // Generate the candidate key up front so the user sees where it's going.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const k = await addPendingRotation(request.handle);
      if (!cancelled) setNewScript(k?.script ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [request.handle]);

  const sign = useCallback(async () => {
    if (!data || !xpub || !inputScript || !newScript) {
      setError("Couldn't prepare a new key for this handle.");
      return;
    }
    setSigning(true);
    setError(null);
    try {
      const key = await getSigningKey(request.handle);
      if (!key) throw new Error("No private key available for this handle.");
      // Spend the current UTXO (current key signs) to the NEW key's spk — equal
      // value, so it's an ownership move to yourself on a fresh key.
      const psbt = signSingleAnyonecanpay(
        { ...request.outpoint, script: inputScript },
        { script: newScript, amount: request.outpoint.amount },
        key,
      );
      setResponse(psbt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign.");
    } finally {
      setSigning(false);
    }
  }, [data, xpub, inputScript, newScript, request, getSigningKey]);

  if (response) {
    return (
      <ResultView
        heading="Rotation signed"
        sub="Broadcast this to move to the new key"
        blob={response}
        response={response}
        endpoint={request.endpoint}
        styles={styles}
        colors={colors}
      />
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Rotate key" }} />
      <Host style={boundedHost} colorScheme={scheme}>
        <NFieldGroup>
          <NFieldGroup.Section>
            <NFieldGroup.SectionHeader>
              <NRow alignment="center">
                <NSpacer flexible />
                <NColumn alignment="center" spacing={8}>
                  <NIcon name="arrow.triangle.2.circlepath" size={40} color={colors.accent} />
                  <NText textStyle={{ fontSize: 20, fontWeight: "700", color: colors.text }}>
                    Move to a new key
                  </NText>
                  <NText textStyle={{ fontSize: 14, color: colors.textSecondary }}>
                    {`${request.handle} stays yours`}
                  </NText>
                </NColumn>
                <NSpacer flexible />
              </NRow>
            </NFieldGroup.SectionHeader>
          </NFieldGroup.Section>

          <NFieldGroup.Section title="New key · generated now">
            <NListItem>
              <NText>{newScript ?? "Preparing…"}</NText>
            </NListItem>
          </NFieldGroup.Section>

          <NFieldGroup.Section title="Effect">
            <NListItem trailing={<NText textStyle={{ color: colors.statusGreenFg }}>Stays sovereign</NText>}>
              <NText>Handle</NText>
            </NListItem>
            <NListItem trailing={<NText textStyle={{ color: colors.statusAmberFg }}>Invalidated</NText>}>
              <NText>Live offers</NText>
            </NListItem>
            <NListItem trailing={<NText textStyle={{ color: colors.textSecondary }}>Kept</NText>}>
              <NText>Records</NText>
            </NListItem>
            <NFieldGroup.SectionFooter>
              <NText textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                Copy this to your wallet and broadcast it. The new key takes effect
                once the move is seen on-chain, which can take up to a day here.
              </NText>
            </NFieldGroup.SectionFooter>
          </NFieldGroup.Section>

          {error ? (
            <NFieldGroup.Section>
              <NListItem
                leading={<NIcon name="exclamationmark.triangle.fill" size={18} color={colors.dangerText} />}
              >
                <NText textStyle={{ color: colors.textSecondary }}>{error}</NText>
              </NListItem>
            </NFieldGroup.Section>
          ) : null}

        </NFieldGroup>
      </Host>
      <ActionFooter
        primary={{
          label: signing ? "Signing…" : "Sign & copy",
          onPress: sign,
          disabled: signing || !newScript,
        }}
        secondary={{ label: "Cancel", onPress: () => router.back() }}
      />
    </>
  );
}

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    mt: { marginTop: 16 },
    mb: { marginBottom: 16 },
    prompt: { fontSize: 15, color: c.textSecondary, marginBottom: 16, lineHeight: 21 },
    lbl: {
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.5,
      color: c.textMuted,
      textTransform: "uppercase",
      marginTop: 8,
      marginBottom: 8,
    },
    hero: { alignItems: "center", marginTop: 8, marginBottom: 22, gap: 8 },
    heroIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      borderCurve: "continuous",
      backgroundColor: c.statusGreenBg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    heroIconAccent: {
      width: 60,
      height: 60,
      borderRadius: 30,
      borderCurve: "continuous",
      backgroundColor: c.accent + "22",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    heroH: { fontSize: 15, color: c.textSecondary },
    heroS: { fontSize: 20, fontWeight: "700", color: c.text },
    bigPrice: { fontSize: 40, fontWeight: "800", color: c.text, letterSpacing: -0.5 },
    lblRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 8,
    },
    tag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderCurve: "continuous",
      marginBottom: 8,
    },
    tagExt: { backgroundColor: "#DC262622" },
    tagMine: { backgroundColor: c.statusGreenBg },
    tagText: { fontSize: 11, fontWeight: "700", color: c.textSecondary, textTransform: "uppercase" },
    payoutInput: {
      fontFamily: "monospace",
      fontSize: 13,
      color: c.text,
      paddingHorizontal: 14,
      paddingVertical: 14,
      // @ts-ignore web-only
      outlineStyle: "none",
    } as any,
    noteDot: {
      backgroundColor: c.statusAmberBg,
      borderRadius: 12,
      borderCurve: "continuous",
      padding: 13,
      marginTop: 12,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderCurve: "continuous",
      overflow: "hidden",
    },
    cardTop: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderCurve: "continuous",
      overflow: "hidden",
      marginTop: 14,
    },
    kv: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    kvK: { fontSize: 14, color: c.textSecondary },
    kvV: { fontSize: 14, fontWeight: "600", color: c.text },
    divider: { height: 1, backgroundColor: c.border },
    pickRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
    },
    pickIcon: {
      width: 32,
      height: 32,
      borderRadius: 9,
      borderCurve: "continuous",
      backgroundColor: c.accent + "22",
      alignItems: "center",
      justifyContent: "center",
    },
    pickName: { flex: 1, fontSize: 16, fontWeight: "600", color: c.text },
    recBlock: {
      backgroundColor: c.card,
      borderRadius: 14,
      borderCurve: "continuous",
      padding: 14,
      marginBottom: 10,
    },
    recHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    recIco: {
      width: 30,
      height: 30,
      borderRadius: 8,
      borderCurve: "continuous",
      alignItems: "center",
      justifyContent: "center",
    },
    recMetaMid: { flex: 1, gap: 1 },
    recName: { fontSize: 14.5, fontWeight: "500", color: c.text },
    opTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      borderCurve: "continuous",
    },
    opTagText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
    recKey: { fontSize: 13, color: c.textSecondary, fontFamily: "monospace" },
    recVal: { fontSize: 15, color: c.text, marginTop: 8, lineHeight: 21 },
    recChunk: { fontSize: 15, color: c.text, marginTop: 8 },
    recValOld: {
      fontSize: 15,
      color: c.textSecondary,
      marginTop: 6,
      textDecorationLine: "line-through",
      fontFamily: "monospace",
    },
    notePlain: {
      backgroundColor: c.card,
      borderRadius: 12,
      borderCurve: "continuous",
      padding: 13,
      marginTop: 12,
    },
    noteWarn: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
      backgroundColor: c.statusAmberBg,
      borderRadius: 12,
      borderCurve: "continuous",
      padding: 12,
      marginTop: 10,
    },
    noteText: { flex: 1, fontSize: 13, color: c.textSecondary, lineHeight: 18 },
    noteStrong: { color: c.text, fontWeight: "700" },
    ackRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
      paddingTop: 12,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderCurve: "continuous",
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
    ackText: { flex: 1, fontSize: 13, color: c.textSecondary, lineHeight: 19 },
    blob: {
      backgroundColor: c.field,
      borderRadius: 12,
      borderCurve: "continuous",
      padding: 14,
      marginBottom: 4,
    },
    blobText: { fontFamily: "monospace", fontSize: 12, color: c.textSecondary },
    primaryBtn: {
      backgroundColor: c.accent,
      borderRadius: 14,
      borderCurve: "continuous",
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 20,
    },
    primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
    dangerBtn: {
      backgroundColor: "#DC2626",
      borderRadius: 14,
      borderCurve: "continuous",
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 20,
    },
    dangerBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
    btnDisabled: { opacity: 0.5 },
    secondaryBtn: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
    secondaryBtnText: { color: c.textSecondary, fontSize: 15, fontWeight: "500" },
  });
