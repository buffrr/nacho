import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
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
import { useStore } from "@/Store";
import {
  AtSign,
  Check,
  AlertCircle,
  Plus,
  Pencil,
  Trash,
  Bitcoin,
  ChevronRight,
} from "@/ui/icons";
import {
  decodeSignRequest,
  applyOps,
  RecordDiff,
  RecordsRequest,
  PsbtRequest,
  SignRequest as SignReq,
} from "@/signRequest";
import { editableFromZone, EditableRecord } from "@/fabricResolver";
import { resolveHandle, exportCert, publishRecords } from "@/fabric";
import { loadCert, saveCert } from "@/certStore";
import { scriptForHandle } from "@/keys";
import { signPsbtRequest, SignedInputInfo } from "@/psbtSign";

// Confirmation screen for a signing request (nacho://sign — see
// docs/signing-requests.md). Decodes the untrusted envelope and shows the EXACT
// effect before the user approves: a record diff (which is then published), or a
// PSBT input→output binding (which is then signed and offered as a copyable PSBT).
export default function SignRequest() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { req } = useLocalSearchParams<{ req?: string }>();

  const decoded = useMemo((): { ok: true; value: SignReq } | { ok: false; error: string } => {
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
        <View style={styles.errorWrap}>
          <Message message={decoded.error} type="error" />
        </View>
      </Layout>
    );
  }

  return decoded.value.type === "records" ? (
    <RecordsConfirm request={decoded.value} styles={styles} colors={colors} />
  ) : (
    <PsbtConfirm request={decoded.value} styles={styles} colors={colors} />
  );
}

// ---------------------------------------------------------------- Records flow

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

  const owned = useMemo(
    () => (handles ? Object.keys(handles) : []),
    [handles],
  );
  const [handle, setHandle] = useState<string | null>(request.handle ?? null);
  const [diff, setDiff] = useState<RecordDiff | null>(null);
  const [phase, setPhase] = useState<
    "picking" | "loading" | "confirm" | "publishing" | "done"
  >(request.handle ? "loading" : "picking");
  const [error, setError] = useState<string | null>(null);

  // Validate a requested handle is one we own.
  useEffect(() => {
    if (request.handle && handles && !handles[request.handle]) {
      setError(`You don't own ${request.handle}.`);
      setPhase("picking");
      setHandle(null);
    }
  }, [request.handle, handles]);

  // Load the live zone for the chosen handle and compute the diff.
  useEffect(() => {
    if (!handle || phase !== "loading") return;
    let cancelled = false;
    (async () => {
      try {
        const resolved = await resolveHandle(handle);
        const current: EditableRecord[] = resolved
          ? editableFromZone(resolved.zone).records
          : [];
        if (cancelled) return;
        setDiff(applyOps(current, request.ops));
        setPhase("confirm");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load the handle's records.");
        setPhase("confirm");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, phase, request.ops]);

  const publish = useCallback(async () => {
    if (!handle || !diff) return;
    setError(null);
    setPhase("publishing");
    try {
      const secretKey = await getSigningKey(handle);
      if (!secretKey) throw new Error("No private key available for this handle.");
      let cert = await loadCert(handle);
      if (!cert) {
        cert = await exportCert(handle);
        await saveCert(handle, cert);
      }
      const seq = Math.floor(Date.now() / 1000);
      await publishRecords(cert, diff.next, seq, secretKey);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish records.");
      setPhase("confirm");
    }
  }, [handle, diff, getSigningKey]);

  const finish = () => router.back();
  const returnToApp = () => {
    if (request.return) Linking.openURL(request.return).catch(() => {});
    router.back();
  };

  // Handle picker (no handle specified in the request).
  if (phase === "picking" || !handle) {
    return (
      <Layout underHeader>
        <Stack.Screen options={{ title: "Sign in" }} />
        <RequestOrigin origin={request.origin} styles={styles} colors={colors} />
        <Text style={styles.prompt}>Choose the handle to use:</Text>
        {error && <View style={styles.mb}><Message message={error} type="error" /></View>}
        <View style={styles.card}>
          {owned.map((h, i) => (
            <React.Fragment key={h}>
              {i > 0 && <View style={styles.divider} />}
              <TouchableOpacity
                style={styles.pickRow}
                onPress={() => {
                  setError(null);
                  setHandle(h);
                  setPhase("loading");
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
        </View>
      </Layout>
    );
  }

  if (phase === "loading") {
    return (
      <Layout underHeader>
        <Stack.Screen options={{ title: "Sign in" }} />
        <ActivityIndicator color={colors.accent} size="large" style={styles.loader} />
      </Layout>
    );
  }

  if (phase === "done") {
    return (
      <Layout underHeader>
        <Stack.Screen options={{ title: "Done" }} />
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}>
            <Check size={30} color={colors.statusGreenFg} />
          </View>
          <Text style={styles.doneTitle}>Records published</Text>
          <Text style={styles.doneSub}>
            {handle} was updated. It may take a moment to propagate.
          </Text>
        </View>
        {request.return ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={returnToApp}>
            <Text style={styles.primaryBtnText}>
              Return to {request.origin ?? "app"}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={finish}>
            <Text style={styles.primaryBtnText}>Done</Text>
          </TouchableOpacity>
        )}
      </Layout>
    );
  }

  // confirm / publishing
  return (
    <Layout underHeader>
      <Stack.Screen options={{ title: "Approve changes" }} />
      <RequestOrigin origin={request.origin} styles={styles} colors={colors} />

      <View style={styles.targetRow}>
        <View style={styles.pickIcon}>
          <AtSign size={18} color={colors.accent} />
        </View>
        <Text style={styles.targetName}>{handle}</Text>
      </View>

      {diff && <RecordDiffView diff={diff} styles={styles} colors={colors} />}

      {error && <View style={styles.mt}><Message message={error} type="error" /></View>}

      <TouchableOpacity
        style={[styles.primaryBtn, phase === "publishing" && styles.btnDisabled]}
        onPress={publish}
        disabled={phase === "publishing"}
      >
        {phase === "publishing" ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryBtnText}>Approve &amp; publish</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={finish}
        disabled={phase === "publishing"}
      >
        <Text style={styles.secondaryBtnText}>Cancel</Text>
      </TouchableOpacity>
    </Layout>
  );
}

function RecordDiffView({
  diff,
  styles,
  colors,
}: {
  diff: RecordDiff;
  styles: Styles;
  colors: Colors;
}) {
  const recLine = (r: EditableRecord) => `${r.type} · ${r.key}`;
  return (
    <View style={styles.card}>
      {diff.added.map((r, i) => (
        <DiffRow
          key={`a${i}`}
          Icon={Plus}
          color={colors.statusGreenFg}
          label={recLine(r)}
          value={r.value.join(", ")}
          styles={styles}
        />
      ))}
      {diff.replaced.map((r, i) => (
        <DiffRow
          key={`r${i}`}
          Icon={Pencil}
          color={colors.accent}
          label={recLine(r.after)}
          value={`${r.before.value.join(", ")}  →  ${r.after.value.join(", ")}`}
          styles={styles}
        />
      ))}
      {diff.removed.map((r, i) => (
        <DiffRow
          key={`d${i}`}
          Icon={Trash}
          color="#DC2626"
          label={recLine(r)}
          value={r.value.join(", ")}
          styles={styles}
        />
      ))}
      {diff.added.length + diff.replaced.length + diff.removed.length === 0 && (
        <Text style={styles.emptyNote}>This request makes no changes.</Text>
      )}
    </View>
  );
}

function DiffRow({
  Icon,
  color,
  label,
  value,
  styles,
}: {
  Icon: (p: { size?: number; color?: string }) => React.JSX.Element;
  color: string;
  label: string;
  value: string;
  styles: Styles;
}) {
  return (
    <View style={styles.diffRow}>
      <View style={[styles.diffIcon, { backgroundColor: color + "22" }]}>
        <Icon size={16} color={color} />
      </View>
      <View style={styles.diffMid}>
        <Text style={styles.diffLabel}>{label}</Text>
        <Text style={styles.diffValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ------------------------------------------------------------------- PSBT flow

function PsbtConfirm({
  request,
  styles,
  colors,
}: {
  request: PsbtRequest;
  styles: Styles;
  colors: Colors;
}) {
  const router = useRouter();
  const { handles, xpub, getSigningKey } = useStore();

  // spk (lowercased) → handle name, for matching inputs and labelling outputs.
  const spkToHandle = useMemo(() => {
    const m = new Map<string, string>();
    if (handles && xpub) {
      for (const [h, data] of Object.entries(handles)) {
        m.set(scriptForHandle(xpub, data).toLowerCase(), h);
      }
    }
    return m;
  }, [handles, xpub]);

  // Per-input preview computed before signing (so the user sees what they sign).
  const preview = useMemo(
    () =>
      request.sign.map((inp, i) => {
        const out = request.outputs[i];
        return {
          handle: spkToHandle.get(inp.script.toLowerCase()) ?? null,
          inAmount: inp.amount,
          outAmount: out.amount,
          outHandle: spkToHandle.get(out.script.toLowerCase()) ?? null,
          outScript: out.script,
        };
      }),
    [request, spkToHandle],
  );
  const foreign = preview.find((p) => p.handle === null);

  const [phase, setPhase] = useState<"confirm" | "signing" | "done">("confirm");
  const [error, setError] = useState<string | null>(null);
  const [psbt, setPsbt] = useState<string | null>(null);
  const [signedInfo, setSignedInfo] = useState<SignedInputInfo[]>([]);
  const [copied, setCopied] = useState(false);

  const sign = useCallback(async () => {
    setError(null);
    setPhase("signing");
    try {
      const result = await signPsbtRequest(request, async (script) => {
        const h = spkToHandle.get(script.toLowerCase());
        if (!h) return null;
        const privkeyHex = await getSigningKey(h);
        if (!privkeyHex) return null;
        return { handle: h, privkeyHex };
      });
      setPsbt(result.psbtBase64);
      setSignedInfo(result.inputs);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign.");
      setPhase("confirm");
    }
  }, [request, spkToHandle, getSigningKey]);

  const copy = async () => {
    if (!psbt) return;
    await Clipboard.setStringAsync(psbt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (phase === "done" && psbt) {
    return (
      <Layout underHeader>
        <Stack.Screen options={{ title: "Signed" }} />
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}>
            <Check size={30} color={colors.statusGreenFg} />
          </View>
          <Text style={styles.doneTitle}>PSBT signed</Text>
          <Text style={styles.doneSub}>
            Signed {signedInfo.length} input{signedInfo.length === 1 ? "" : "s"} with
            SIGHASH_SINGLE | ANYONECANPAY. Copy it back to the requesting app to
            combine and broadcast.
          </Text>
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={copy}>
          <Text style={styles.primaryBtnText}>
            {copied ? "Copied ✓" : "Copy signed PSBT"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Done</Text>
        </TouchableOpacity>
      </Layout>
    );
  }

  return (
    <Layout underHeader>
      <Stack.Screen options={{ title: "Sign transaction" }} />
      <RequestOrigin origin={request.origin} styles={styles} colors={colors} />
      <Text style={styles.prompt}>
        You are producing a partial signature (ANYONECANPAY): only your input is
        signed, each bound to the output below.
      </Text>

      <View style={styles.card}>
        {preview.map((p, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={styles.divider} />}
            <View style={styles.psbtRow}>
              <View style={styles.psbtLine}>
                <View style={[styles.diffIcon, { backgroundColor: colors.accent + "22" }]}>
                  <Bitcoin size={16} color={colors.accent} />
                </View>
                <View style={styles.diffMid}>
                  <Text style={styles.diffLabel}>
                    Spend {formatSats(p.inAmount)} from{" "}
                    {p.handle ?? "an unknown input"}
                  </Text>
                  <Text style={styles.diffValue}>
                    → {formatSats(p.outAmount)} to{" "}
                    {p.outHandle
                      ? p.outHandle + " (yours)"
                      : shortHex(p.outScript)}
                  </Text>
                </View>
              </View>
            </View>
          </React.Fragment>
        ))}
      </View>

      {foreign && (
        <View style={styles.mt}>
          <Message
            message="One or more inputs aren't your handles — nacho will refuse to sign this request."
            type="error"
          />
        </View>
      )}
      {error && <View style={styles.mt}><Message message={error} type="error" /></View>}

      <TouchableOpacity
        style={[
          styles.primaryBtn,
          (phase === "signing" || !!foreign) && styles.btnDisabled,
        ]}
        onPress={sign}
        disabled={phase === "signing" || !!foreign}
      >
        {phase === "signing" ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryBtnText}>Approve &amp; sign</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
        <Text style={styles.secondaryBtnText}>Cancel</Text>
      </TouchableOpacity>
    </Layout>
  );
}

// --------------------------------------------------------------------- shared

function RequestOrigin({
  origin,
  styles,
  colors,
}: {
  origin?: string;
  styles: Styles;
  colors: Colors;
}) {
  return (
    <View style={styles.originRow}>
      <View style={styles.originIcon}>
        <AlertCircle size={18} color={colors.statusAmberFg} />
      </View>
      <Text style={styles.originText}>
        {origin ? (
          <>
            Request from <Text style={styles.originStrong}>{origin}</Text>. Only
            approve if you trust it.
          </>
        ) : (
          <>Untrusted request. Review carefully before approving.</>
        )}
      </Text>
    </View>
  );
}

// Thousands-separated sats (Hermes lacks full Intl number formatting).
function formatSats(n: number): string {
  return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} sats`;
}
function shortHex(h: string): string {
  return h.length <= 18 ? h : `${h.slice(0, 10)}…${h.slice(-6)}`;
}

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    errorWrap: { marginTop: 20 },
    mt: { marginTop: 16 },
    mb: { marginBottom: 16 },
    loader: { marginTop: 40 },
    prompt: {
      fontSize: 15,
      color: c.textSecondary,
      marginBottom: 16,
      lineHeight: 21,
    },
    originRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.statusAmberBg,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 14,
      padding: 14,
      marginBottom: 20,
    },
    originIcon: { width: 22, alignItems: "center" },
    originText: { flex: 1, fontSize: 13, color: c.textSecondary, lineHeight: 18 },
    originStrong: { color: c.text, fontWeight: "700" },
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 16,
      overflow: "hidden",
    },
    divider: { height: 1, backgroundColor: c.border, marginLeft: 56 },
    // handle picker
    pickRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
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
    // target handle
    targetRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
    },
    targetName: { fontSize: 18, fontWeight: "700", color: c.text },
    // diff rows
    diffRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    diffIcon: {
      width: 32,
      height: 32,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    diffMid: { flex: 1, gap: 2 },
    diffLabel: { fontSize: 15, fontWeight: "600", color: c.text },
    diffValue: { fontSize: 13, color: c.textSecondary, fontFamily: "monospace" },
    emptyNote: { padding: 16, fontSize: 14, color: c.textSecondary },
    // psbt
    psbtRow: { paddingHorizontal: 14, paddingVertical: 12 },
    psbtLine: { flexDirection: "row", alignItems: "center", gap: 12 },
    // done
    doneWrap: { alignItems: "center", marginTop: 12, marginBottom: 28, gap: 10 },
    doneIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: c.statusGreenBg,
      alignItems: "center",
      justifyContent: "center",
    },
    doneTitle: { fontSize: 20, fontWeight: "700", color: c.text },
    doneSub: {
      fontSize: 14,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      paddingHorizontal: 12,
    },
    // buttons
    primaryBtn: {
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 20,
    },
    primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
    btnDisabled: { opacity: 0.5 },
    secondaryBtn: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
    secondaryBtnText: { color: c.textSecondary, fontSize: 15, fontWeight: "500" },
  });
