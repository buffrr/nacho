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
import { Colors, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { Message } from "@/ui/Message";
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

  return (
    <Layout underHeader>
      <Stack.Screen options={{ title: "Signed" }} />
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Check size={30} color={colors.statusGreenFg} />
        </View>
        <Text style={styles.heroH}>{heading}</Text>
        <Text style={styles.heroS}>{sent ? `Sent to ${host}` : sub}</Text>
      </View>
      <View style={styles.blob}>
        <Text style={styles.blobText} numberOfLines={4}>
          {blob}
        </Text>
      </View>
      {error && (
        <View style={styles.mt}>
          <Message message={error} type="error" />
        </View>
      )}
      {host && !sent ? (
        <>
          <TouchableOpacity
            style={[styles.primaryBtn, sending && styles.btnDisabled]}
            onPress={send}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Send to {host}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={copy}>
            <Text style={styles.secondaryBtnText}>
              {copied ? "Copied ✓" : "Copy response"}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity style={styles.primaryBtn} onPress={copy}>
            <Text style={styles.primaryBtnText}>
              {copied ? "Copied ✓" : "Copy response"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>Done</Text>
          </TouchableOpacity>
        </>
      )}
    </Layout>
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
      <Layout underHeader>
        <Stack.Screen options={{ title: "Sign in" }} />
        <Text style={styles.prompt}>Choose the handle to prove you own:</Text>
        {owned.map((h, i) => (
          <React.Fragment key={h}>
            {i > 0 && <View style={styles.divider} />}
            <TouchableOpacity style={styles.pickRow} onPress={() => setHandle(h)}>
              <View style={styles.pickIcon}>
                <AtSign size={18} color={colors.accent} />
              </View>
              <Text style={styles.pickName}>{h}</Text>
              <ChevronRight size={18} color={colors.iconDefault} />
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </Layout>
    );
  }

  return (
    <Layout underHeader>
      <Stack.Screen options={{ title: "Sign in" }} />
      <View style={styles.hero}>
        <View style={styles.heroIconAccent}>
          <AtSign size={26} color={colors.accent} />
        </View>
        <Text style={styles.heroH}>Prove you own</Text>
        <Text style={styles.heroS}>{handle}</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.kv}>
          <Text style={styles.kvK}>Signs</Text>
          <Text style={styles.kvV}>A one-time challenge</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.kv}>
          <Text style={styles.kvK}>Expires</Text>
          <Text style={styles.kvV}>{remainingValidity(request.exp)}</Text>
        </View>
      </View>
      {host && (
        <View style={styles.notePlain}>
          <Text style={styles.noteText}>
            Your signature will be sent to <Text style={styles.noteStrong}>{host}</Text>{" "}
            when you tap below. Nothing is sent before that.
          </Text>
        </View>
      )}
      {error && (
        <View style={styles.mt}>
          <Message message={error} type="error" />
        </View>
      )}
      <TouchableOpacity
        style={[styles.primaryBtn, signing && styles.btnDisabled]}
        onPress={sign}
        disabled={signing}
      >
        {signing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryBtnText}>
            {host ? `Sign & send to ${host}` : "Sign"}
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
        <Text style={styles.secondaryBtnText}>Cancel</Text>
      </TouchableOpacity>
    </Layout>
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
      <Layout underHeader>
        <Stack.Screen options={{ title: "Sign in" }} />
        <Text style={styles.prompt}>Choose the handle to use:</Text>
        {error && (
          <View style={styles.mb}>
            <Message message={error} type="error" />
          </View>
        )}
        {owned.map((h, i) => (
          <React.Fragment key={h}>
            {i > 0 && <View style={styles.divider} />}
            <TouchableOpacity
              style={styles.pickRow}
              onPress={() => {
                setError(null);
                setHandle(h);
                setPhase("review");
              }}
            >
              <View style={styles.pickIcon}>
                <AtSign size={18} color={colors.accent} />
              </View>
              <Text style={styles.pickName}>{h}</Text>
              <ChevronRight size={18} color={colors.iconDefault} />
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </Layout>
    );
  }

  if (phase === "done") {
    return (
      <Layout underHeader>
        <Stack.Screen options={{ title: "Done" }} />
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Check size={30} color={colors.statusGreenFg} />
          </View>
          <Text style={styles.heroH}>Records published</Text>
          <Text style={styles.heroS}>{handle} was updated.</Text>
        </View>
        {request.return ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              Linking.openURL(request.return!).catch(() => {});
              router.back();
            }}
          >
            <Text style={styles.primaryBtnText}>
              Return to {hostOf(request.return)}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Done</Text>
          </TouchableOpacity>
        )}
      </Layout>
    );
  }

  const changed = phase === "changed";
  const busy = phase === "publishing";

  return (
    <Layout underHeader>
      <Stack.Screen
        options={{ title: changed ? "Records changed" : "Approve record change" }}
      />
      {changed && (
        <View style={styles.noteWarn}>
          <AlertCircle size={18} color={colors.statusAmberFg} />
          <Text style={styles.noteText}>
            This handle changed since the last screen. Here's what would actually
            happen now.
          </Text>
        </View>
      )}

      {diff && (
        <RecordDiffView
          diff={diff}
          acks={acks}
          setAck={(i, v) => setAcks((a) => ({ ...a, [i]: v }))}
          styles={styles}
          colors={colors}
        />
      )}

      <View style={styles.cardTop}>
        <View style={styles.kv}>
          <Text style={styles.kvK}>Publishing to</Text>
          <Text style={styles.kvV}>{handle}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.kv}>
          <Text style={styles.kvK}>Expires</Text>
          <Text style={styles.kvV}>{remainingValidity(request.exp)}</Text>
        </View>
      </View>

      {error && (
        <View style={styles.mt}>
          <Message message={error} type="error" />
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.primaryBtn,
          (busy || (!changed && !allAcked)) && styles.btnDisabled,
        ]}
        onPress={changed ? publishAnyway : approve}
        disabled={busy || (!changed && !allAcked)}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryBtnText}>
            {changed ? "Publish anyway" : "Approve & publish"}
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={() => router.back()}
        disabled={busy}
      >
        <Text style={styles.secondaryBtnText}>Cancel</Text>
      </TouchableOpacity>
    </Layout>
  );
}

function RecordDiffView({
  diff,
  acks,
  setAck,
  styles,
  colors,
}: {
  diff: RecordDiff;
  acks: Record<number, boolean>;
  setAck: (i: number, v: boolean) => void;
  styles: Styles;
  colors: Colors;
}) {
  return (
    <View>
      {diff.added.length > 0 && (
        <Text style={styles.lbl}>A request asks to add</Text>
      )}
      {diff.added.map((r, i) => {
        const tier = tierFor(r.type, r.key);
        const warn = warningLine(tier);
        const mustAck = needsAck(tier);
        return (
          <View key={`a${i}`} style={styles.recBlock}>
            <View style={styles.recHead}>
              <View style={[styles.opTag, { backgroundColor: colors.statusGreenBg }]}>
                <Plus size={12} color={colors.statusGreenFg} />
                <Text style={[styles.opTagText, { color: colors.statusGreenFg }]}>
                  add
                </Text>
              </View>
              <Text style={styles.recKey}>
                {r.type} · {r.key}
              </Text>
            </View>
            {tier === "generic" ? (
              <Text style={styles.recVal}>{r.value.join(", ")}</Text>
            ) : (
              <ChunkedValue value={r.value.join(" ")} style={styles.recChunk} />
            )}
            {warn && (
              <View style={styles.noteWarn}>
                <AlertCircle size={16} color={colors.statusAmberFg} />
                <Text style={styles.noteText}>{warn}</Text>
              </View>
            )}
            {mustAck && (
              <TouchableOpacity
                style={styles.ackRow}
                onPress={() => setAck(i, !acks[i])}
              >
                <View style={[styles.checkbox, acks[i] && styles.checkboxOn]}>
                  {acks[i] && <Check size={14} color="#FFFFFF" />}
                </View>
                <Text style={styles.ackText}>
                  I've read this address and it's the one I meant to add
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {diff.replaced.length > 0 && (
        <Text style={styles.lbl}>A request asks to replace</Text>
      )}
      {diff.replaced.map((r, i) => (
        <View key={`r${i}`} style={styles.recBlock}>
          <View style={styles.recHead}>
            <View style={[styles.opTag, { backgroundColor: colors.border }]}>
              <Text style={[styles.opTagText, { color: colors.textSecondary }]}>
                was
              </Text>
            </View>
            <Text style={styles.recKey}>
              {r.before.type} · {r.before.key}
            </Text>
          </View>
          <Text style={styles.recValOld}>{r.before.value.join(", ")}</Text>
          <View style={[styles.recHead, { marginTop: 8 }]}>
            <View style={[styles.opTag, { backgroundColor: colors.statusGreenBg }]}>
              <Text style={[styles.opTagText, { color: colors.statusGreenFg }]}>
                now
              </Text>
            </View>
            <Text style={styles.recKey}>
              {r.after.type} · {r.after.key}
            </Text>
          </View>
          <Text style={styles.recVal}>{r.after.value.join(", ")}</Text>
        </View>
      ))}

      {diff.removed.length > 0 && (
        <Text style={styles.lbl}>Removes {diff.removed.length} record{diff.removed.length === 1 ? "" : "s"}</Text>
      )}
      {diff.removed.map((r, i) => (
        <View key={`d${i}`} style={styles.recBlock}>
          <View style={styles.recHead}>
            <View style={[styles.opTag, { backgroundColor: "#DC262622" }]}>
              <Trash size={12} color="#DC2626" />
              <Text style={[styles.opTagText, { color: "#DC2626" }]}>remove</Text>
            </View>
            <Text style={styles.recKey}>
              {r.type} · {r.key}
            </Text>
          </View>
          <Text style={styles.recValOld}>{r.value.join(", ")}</Text>
        </View>
      ))}
    </View>
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

  return (
    <Layout underHeader>
      <Stack.Screen options={{ title: "Transfer handle" }} />
      <View style={styles.hero}>
        <Text style={styles.heroH}>Give away {request.handle}</Text>
        <Text style={styles.heroS}>You will no longer control this handle</Text>
      </View>

      <View style={styles.lblRow}>
        <Text style={styles.lbl}>Recipient</Text>
        <View style={[styles.tag, toMine ? styles.tagMine : styles.tagExt]}>
          <Text style={styles.tagText}>{toMine ? "your key" : "external"}</Text>
        </View>
      </View>
      <View style={styles.recBlock}>
        <ChunkedValue value={request.to} style={styles.recChunk} />
      </View>

      {!toMine && (
        <TouchableOpacity style={styles.ackRow} onPress={() => setAck((a) => !a)}>
          <View style={[styles.checkbox, ack && styles.checkboxOn]}>
            {ack && <Check size={14} color="#FFFFFF" />}
          </View>
          <Text style={styles.ackText}>This matches the key the recipient gave me</Text>
        </TouchableOpacity>
      )}

      <View style={styles.noteDot}>
        <Text style={styles.noteText}>
          Once this transaction is broadcast, the handle is theirs. There is no way
          to undo it.
        </Text>
      </View>

      {error && (
        <View style={styles.mt}>
          <Message message={error} type="error" />
        </View>
      )}

      <TouchableOpacity
        style={[styles.dangerBtn, (signing || (!toMine && !ack)) && styles.btnDisabled]}
        onPress={sign}
        disabled={signing || (!toMine && !ack)}
      >
        {signing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.dangerBtnText}>Sign transfer</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
        <Text style={styles.secondaryBtnText}>Cancel</Text>
      </TouchableOpacity>
    </Layout>
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
  const { handles, xpub, getSigningKey } = useStore();
  const [payout, setPayout] = useState("");
  const [payoutSource, setPayoutSource] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);

  const data = handles?.[request.handle];
  const inputScript = data && xpub ? scriptForHandle(xpub, data) : null;

  // Prefill the payout from the user's own addr:btc record (re-read live at sign).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await resolveHandle(request.handle);
        if (r && !cancelled) {
          const btc = editableFromZone(r.zone).records.find(
            (x) => x.type === "addr" && x.key.toLowerCase() === "btc",
          );
          if (btc?.value[0]) {
            setPayout(btc.value[0]);
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
  }, [request.handle]);

  const sign = useCallback(async () => {
    if (!data || !xpub || !inputScript) {
      setError("You don't own this handle.");
      return;
    }
    if (!payout.trim()) {
      setError("Enter a payout address.");
      return;
    }
    setError(null);
    let outScript: string;
    try {
      outScript = addressToScriptHex(payout);
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
    <Layout underHeader>
      <Stack.Screen options={{ title: "Sell handle" }} />
      <View style={styles.hero}>
        <Text style={styles.lbl}>Asking price</Text>
        <Text style={styles.bigPrice}>{formatBtc(request.price)}</Text>
        <Text style={styles.heroS}>for {request.handle}</Text>
      </View>

      <Text style={styles.lbl}>You get paid to</Text>
      <View style={styles.card}>
        <TextInput
          value={payout}
          onChangeText={setPayout}
          placeholder="bc1…"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.payoutInput}
        />
        {payoutSource && (
          <>
            <View style={styles.divider} />
            <View style={styles.kv}>
              <Text style={styles.kvK}>From your record</Text>
              <Text style={[styles.kvV, { fontFamily: "monospace" }]}>{payoutSource}</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.noteDot}>
        <Text style={styles.noteText}>
          <Text style={styles.noteStrong}>
            Anyone who pays {formatBtc(request.price)} can take ownership of this
            handle.
          </Text>
        </Text>
      </View>
      <View style={styles.noteWarn}>
        <AlertCircle size={16} color={colors.statusAmberFg} />
        <Text style={styles.noteText}>
          This offer stays valid until you cancel it. Cancelling means moving the
          handle to yourself.
        </Text>
      </View>

      {error && (
        <View style={styles.mt}>
          <Message message={error} type="error" />
        </View>
      )}

      <TouchableOpacity
        style={[styles.dangerBtn, signing && styles.btnDisabled]}
        onPress={sign}
        disabled={signing}
      >
        {signing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.dangerBtnText}>Sign offer</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
        <Text style={styles.secondaryBtnText}>Cancel</Text>
      </TouchableOpacity>
    </Layout>
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
    <Layout underHeader>
      <Stack.Screen options={{ title: "Rotate key" }} />
      <View style={styles.hero}>
        <Text style={styles.heroH}>Move to a new key</Text>
        <Text style={styles.heroS}>{request.handle} stays yours</Text>
      </View>

      <View style={styles.lblRow}>
        <Text style={styles.lbl}>New key</Text>
        <View style={[styles.tag, styles.tagMine]}>
          <Text style={styles.tagText}>generated now</Text>
        </View>
      </View>
      <View style={styles.recBlock}>
        {newScript ? (
          <ChunkedValue value={newScript} style={styles.recChunk} />
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.kv}>
          <Text style={styles.kvK}>Handle</Text>
          <Text style={[styles.kvV, { color: colors.statusGreenFg }]}>Stays sovereign</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.kv}>
          <Text style={styles.kvK}>Live offers</Text>
          <Text style={[styles.kvV, { color: colors.statusAmberFg }]}>Invalidated</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.kv}>
          <Text style={styles.kvK}>Records</Text>
          <Text style={styles.kvV}>Kept</Text>
        </View>
      </View>

      <View style={styles.notePlain}>
        <Text style={styles.noteText}>
          Copy this to your wallet and broadcast it. The new key takes effect once
          the move is seen on-chain, which can take up to a day to clear here.
        </Text>
      </View>

      {error && (
        <View style={styles.mt}>
          <Message message={error} type="error" />
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryBtn, (signing || !newScript) && styles.btnDisabled]}
        onPress={sign}
        disabled={signing || !newScript}
      >
        {signing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryBtnText}>Sign &amp; copy</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
        <Text style={styles.secondaryBtnText}>Cancel</Text>
      </TouchableOpacity>
    </Layout>
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
      backgroundColor: c.statusGreenBg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    heroIconAccent: {
      width: 60,
      height: 60,
      borderRadius: 30,
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
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 12,
      padding: 13,
      marginTop: 12,
    },
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 16,
      overflow: "hidden",
    },
    cardTop: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 16,
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
      backgroundColor: c.accent + "22",
      alignItems: "center",
      justifyContent: "center",
    },
    pickName: { flex: 1, fontSize: 16, fontWeight: "600", color: c.text },
    recBlock: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
    },
    recHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    opTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
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
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 12,
      padding: 13,
      marginTop: 12,
    },
    noteWarn: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
      backgroundColor: c.statusAmberBg,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 12,
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
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
    ackText: { flex: 1, fontSize: 13, color: c.textSecondary, lineHeight: 19 },
    blob: {
      backgroundColor: c.field,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 12,
      padding: 14,
      marginBottom: 4,
    },
    blobText: { fontFamily: "monospace", fontSize: 12, color: c.textSecondary },
    primaryBtn: {
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 20,
    },
    primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
    dangerBtn: {
      backgroundColor: "#DC2626",
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 20,
    },
    dangerBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
    btnDisabled: { opacity: 0.5 },
    secondaryBtn: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
    secondaryBtnText: { color: c.textSecondary, fontSize: 15, fontWeight: "500" },
  });
