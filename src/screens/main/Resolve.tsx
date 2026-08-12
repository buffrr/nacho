import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Animated,
} from "react-native";
import {
  Stack,
  useLocalSearchParams,
  useRouter,
  useFocusEffect,
} from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Colors, useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Layout } from "@/ui/Layout";
import {
  Copy,
  Check,
  ShoppingBag,
  AtSign,
  ShieldCheck,
  ShieldX,
  Clock,
  WifiOff,
  SearchX,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Bitcoin,
  ChevronRight,
} from "@/ui/icons";
import { resolveHandle } from "@/fabric";
import { ResolvedHandle } from "@/fabricResolver";
import { lookupRecord, paymentUri, RecordDef } from "@/recordRegistry";

// One rendered record: the registry entry plus the concrete values from the zone.
type ResRow = {
  id: string;
  def: RecordDef;
  known: boolean;
  values: string[];
  primary: string; // the value shown collapsed / copied
};

// Group a long opaque string into 4-char blocks so it can be eyeballed against a
// source before it hits the clipboard (same treatment as the approval screens).
function chunk(v: string): string {
  if (v.length <= 16 || /\s/.test(v)) return v;
  return v.replace(/(.{4})(?=.)/g, "$1 ");
}

function shorten(value: string): string {
  if (value.length <= 24) return value;
  return `${value.slice(0, 10)}…${value.slice(-7)}`;
}

// The taproot output key (x-only) behind a handle: script_pubkey is `5120<key>`.
function pubkeyFromZone(zone: ResolvedHandle["zone"]): string | null {
  const spk = zone.script_pubkey;
  if (typeof spk !== "string") return null;
  const m = /^5120([0-9a-fA-F]{64})$/.exec(spk);
  return m ? m[1] : spk;
}

// The zone's identity facts (shown even when there are no records): public key,
// numeric id, alias. Value + whether tapping copies it.
type DetailRow = { label: string; value: string; display: string; copyable: boolean };
function toDetails(zone: ResolvedHandle["zone"]): DetailRow[] {
  const out: DetailRow[] = [];
  const pk = pubkeyFromZone(zone);
  if (pk) {
    out.push({
      label: "Public key",
      value: pk,
      display: pk.length > 20 ? `${pk.slice(0, 8)}…${pk.slice(-8)}` : pk,
      copyable: true,
    });
  }
  const numId = typeof zone.num_id === "string" ? zone.num_id : undefined;
  if (numId) {
    out.push({
      label: "Numeric ID",
      value: numId,
      display: numId.length > 18 ? `${numId.slice(0, 8)}…${numId.slice(-6)}` : numId,
      copyable: true,
    });
  }
  const alias = typeof zone.alias === "string" ? zone.alias : undefined;
  if (alias) {
    out.push({ label: "Alias", value: alias, display: alias, copyable: false });
  }
  return out;
}

// Turn the resolved zone into render rows via the shared registry. Records appear
// in published order; seq/sig are protocol internals and dropped.
function toRows(resolved: ResolvedHandle): ResRow[] {
  const rows: ResRow[] = [];
  let i = 0;
  for (const rec of resolved.zone.records ?? []) {
    if (rec.type !== "addr" && rec.type !== "txt") continue;
    if (typeof rec.key !== "string") continue;
    const values = (rec.value ?? []).map(String).filter(Boolean);
    if (values.length === 0) continue;
    const { def, known } = lookupRecord(rec.type, rec.key);
    rows.push({
      id: `${rec.key}:${i++}`,
      def,
      known,
      values,
      primary: values[0],
    });
  }
  return rows;
}

export default function Resolve() {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [handle, setHandle] = useState("");
  const [pending, setPending] = useState<string | null>(null); // name being resolved
  const [result, setResult] = useState<ResolvedHandle | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [error, setError] = useState<"network" | "verify" | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const phase: "idle" | "loading" | "result" | "notfound" | "error" = pending
    ? "loading"
    : result
      ? "result"
      : notFound
        ? "notfound"
        : error
          ? "error"
          : "idle";

  const onResolve = async (nameArg?: string) => {
    const name = (nameArg ?? handle).trim().toLowerCase();
    if (!name.includes("@") || pending) return;
    setError(null);
    setNotFound(null);
    setResult(null);
    setExpanded(null);
    setPending(name);
    try {
      const resolved = await resolveHandle(name);
      if (resolved) {
        setResult(resolved);
      } else {
        // The relays answered and there was nothing to return. We do NOT auto-
        // check the shop — that would leak every lookup to the central server.
        setNotFound(name);
      }
    } catch (e) {
      // Two honest failure modes we CAN tell apart from the error text: the
      // relays were unreachable (no answer) vs. an answer that failed to verify
      // (records exist but can't be trusted). A non-existent space also surfaces
      // as a verify error today — that stays in the verify bucket rather than
      // being mislabelled "not found", which would hide a real tampering signal.
      const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
      const network =
        /no peers|http error|relay error|network|timed out|fetch|econn/.test(
          msg,
        );
      setError(network ? "network" : "verify");
    } finally {
      setPending(null);
    }
  };

  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  useEffect(() => {
    if (prefill) {
      setHandle(prefill);
      onResolve(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  // Imperative handle to the native search bar (mirrors react-native-screens'
  // SearchBarCommands, which isn't exported from the package root).
  const searchRef = useRef<{
    focus: () => void;
    blur: () => void;
    clearText: () => void;
    toggleCancelButton: (show: boolean) => void;
    setText: (text: string) => void;
    cancelSearch: () => void;
  } | null>(null);

  // Transient outcomes shouldn't greet the user on arrival — clear a stale
  // error / not-found each time the tab regains focus (keeps a valid result).
  // Also focus the search field so tapping the Search tab shows the keyboard.
  useFocusEffect(
    useCallback(() => {
      setError(null);
      setNotFound(null);
      const t = setTimeout(() => searchRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }, []),
  );

  const copy = useCallback((id: string, text: string) => {
    Clipboard.setStringAsync(text);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1400);
  }, []);

  // Open a URI, but fall back to copying when nothing handles the scheme. iOS
  // rejects openURL for an unregistered scheme (e.g. no bitcoin: wallet); left
  // uncaught that's a silent no-op, so we copy the payable value instead and
  // flash "Copied" on the same row.
  const openUri = useCallback(
    (uri: string, copyFallback: string, id: string) => {
      Linking.openURL(uri).catch(() => copy(id, copyFallback));
    },
    [copy],
  );

  const rows = useMemo(() => (result ? toRows(result) : []), [result]);
  const payUri = useMemo(
    () =>
      result
        ? paymentUri(
            rows.map((r) => ({
              rtype: r.def.rtype,
              key: r.def.key,
              value: r.primary,
            })),
          )
        : null,
    [result, rows],
  );
  // Raw payable value to copy when no wallet handles the bitcoin: URI.
  const payCopy = useMemo(
    () => rows.find((r) => r.def.tier === "destination")?.primary ?? "",
    [rows],
  );

  const searchScreen = (
    <Stack.Screen
      options={{
        headerSearchBarOptions: {
          ref: searchRef,
          autoFocus: true,
          placeholder: "satoshi@bitcoin",
          autoCapitalize: "none",
          hideWhenScrolling: false,
          textColor: colors.text,
          tintColor: colors.accent,
          onChangeText: (e) => {
            const t = e.nativeEvent.text.trim().toLowerCase();
            setHandle(t);
            setError(null);
            setNotFound(null);
            if (!t) setResult(null);
          },
          onSearchButtonPress: (e) => onResolve(e.nativeEvent.text),
          onCancelButtonPress: () => {
            // If no search was actually performed, cancelling reads as "I didn't
            // mean to be here" → back to Handles. Otherwise just clear + stay.
            const noSearch = !result && !notFound && !error;
            setHandle("");
            setError(null);
            setNotFound(null);
            setResult(null);
            if (noSearch) router.navigate("/(main)/(tabs)/handles");
          },
        },
      }}
    />
  );

  return (
    <Layout tabBarInset underHeader keyboardAware={false}>
      {searchScreen}

      {phase === "idle" && (
        <View style={styles.centerState}>
          <View style={styles.bigIcon}>
            <AtSign size={30} color={colors.textMuted} />
          </View>
          <Text style={styles.centerTitle}>Resolve a handle</Text>
          <Text style={styles.centerSub}>
            Try <Text style={styles.mono}>satoshi@bitcoin</Text>
          </Text>
        </View>
      )}

      {phase === "loading" && pending && (
        <ResolveShell handle={pending} styles={styles} colors={colors} />
      )}

      {phase === "notfound" && notFound && (
        <View style={styles.centerState}>
          <View style={styles.bigIcon}>
            <SearchX size={28} color={colors.textMuted} />
          </View>
          <Text style={styles.centerName}>{notFound}</Text>
          <Text style={styles.centerSub}>
            Nothing published for this handle. It may not be registered, or the
            owner hasn’t published records yet.
          </Text>
          <TouchableOpacity
            style={styles.buyRow}
            activeOpacity={0.7}
            onPress={() =>
              router.push({
                pathname: "/(main)/shop",
                params: { prefill: notFound },
              })
            }
          >
            <View style={styles.buyIco}>
              <ShoppingBag size={18} color={colors.textSecondary} />
            </View>
            <Text style={styles.buyText}>Buy this handle</Text>
            <ChevronRight size={18} color={colors.chevron} />
          </TouchableOpacity>
        </View>
      )}

      {phase === "error" && error === "network" && (
        <View style={styles.centerState}>
          <View style={styles.bigIcon}>
            <WifiOff size={26} color={colors.textMuted} />
          </View>
          <Text style={styles.centerName}>Couldn’t reach any relay</Text>
          <Text style={styles.centerSub}>
            We don’t know whether {handle || "this handle"} exists — no relay
            responded. This isn’t a “not found”.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            activeOpacity={0.8}
            onPress={() => onResolve(handle)}
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(main)/trust")}>
            <Text style={styles.subtleLink}>Relay settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === "error" && error === "verify" && (
        <View style={styles.centerState}>
          <View style={[styles.bigIcon, { backgroundColor: colors.accent + "1F" }]}>
            <ShieldX size={28} color={colors.accent} />
          </View>
          <Text style={styles.centerName}>{handle || "This handle"}</Text>
          <Text style={styles.centerSub}>
            Couldn’t verify this handle against a trust anchor.
          </Text>
          <View style={styles.errNote}>
            <Text style={styles.errNoteText}>
              Records aren’t shown, because we can’t confirm they’re genuine. This
              is usually a stale anchor or a relay serving old data.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.retryBtn}
            activeOpacity={0.8}
            onPress={() => onResolve(handle)}
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(main)/trust")}>
            <Text style={styles.subtleLink}>Trust settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === "result" && result && (
        <ResultView
          result={result}
          rows={rows}
          payUri={payUri}
          payCopy={payCopy}
          expanded={expanded}
          setExpanded={setExpanded}
          copied={copied}
          copy={copy}
          openUri={openUri}
          styles={styles}
          colors={colors}
        />
      )}
    </Layout>
  );
}

// ── The resolved profile ─────────────────────────────────────────────────────

function TrustBanner({
  badge,
  styles,
  colors,
}: {
  badge: ResolvedHandle["badge"];
  styles: ReturnType<typeof makeStyles>;
  colors: Colors;
}) {
  // orange = verified against the user's own (Safety ID) anchor → green.
  // none    = matched Nacho's default semi-trusted anchor → neutral (normal case).
  // unverified = observed only, no anchor → amber caution.
  if (badge === "orange") {
    return (
      <View style={[styles.trust, { backgroundColor: colors.statusGreenBg }]}>
        <ShieldCheck size={15} color={colors.statusGreenFg} />
        <Text style={[styles.trustText, { color: colors.statusGreenFg }]}>
          Verified with your trust anchor
        </Text>
      </View>
    );
  }
  if (badge === "unverified") {
    return (
      <View style={[styles.trust, { backgroundColor: colors.accent + "1A" }]}>
        <ShieldX size={15} color={colors.accent} />
        <Text style={[styles.trustText, { color: colors.accent }]}>
          Not verified against any anchor
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.trust, { backgroundColor: colors.surfaceSunken }]}>
      <ShieldCheck size={15} color={colors.textSecondary} />
      <Text style={[styles.trustText, { color: colors.textSecondary }]}>
        Verified with Nacho’s default anchor
      </Text>
    </View>
  );
}

function ResultView({
  result,
  rows,
  payUri,
  payCopy,
  expanded,
  setExpanded,
  copied,
  copy,
  openUri,
  styles,
  colors,
}: {
  result: ResolvedHandle;
  rows: ResRow[];
  payUri: string | null;
  payCopy: string;
  expanded: string | null;
  setExpanded: (v: string | null) => void;
  copied: string | null;
  copy: (id: string, text: string) => void;
  openUri: (uri: string, copyFallback: string, id: string) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: Colors;
}) {
  const sovereign = result.zone.sovereignty === "sovereign";
  const details = useMemo(() => toDetails(result.zone), [result.zone]);
  return (
    <View>
      <View style={styles.profile}>
        <Avatar handle={result.handle} size={76} />
        <Text style={styles.profileName}>{result.handle}</Text>
        <View
          style={[
            styles.chip,
            {
              backgroundColor: sovereign ? colors.statusGreenBg : colors.surfaceSunken,
            },
          ]}
        >
          {sovereign ? (
            <ShieldCheck size={12} color={colors.statusGreenFg} />
          ) : (
            <Clock size={12} color={colors.textMuted} />
          )}
          <Text
            style={[
              styles.chipText,
              { color: sovereign ? colors.statusGreenFg : colors.textMuted },
            ]}
          >
            {sovereign ? "Sovereign" : "Registered"}
          </Text>
        </View>
      </View>

      <TrustBanner badge={result.badge} styles={styles} colors={colors} />

      {payUri && (
        <TouchableOpacity
          style={[styles.card, styles.payRow]}
          activeOpacity={0.7}
          onPress={() => openUri(payUri, payCopy || payUri, "pay")}
        >
          <View style={[styles.rowIco, { backgroundColor: "#E08A2E22" }]}>
            <Bitcoin size={18} color="#E08A2E" />
          </View>
          <View style={styles.rowMid}>
            <Text style={styles.rowLabel}>Pay with Bitcoin</Text>
            <Text style={styles.rowHint}>
              {copied === "pay" ? "Copied — no wallet app found" : "Opens your wallet"}
            </Text>
          </View>
          {copied === "pay" ? (
            <Check size={17} color={colors.accent} />
          ) : (
            <ExternalLink size={17} color={colors.chevron} />
          )}
        </TouchableOpacity>
      )}

      {rows.length > 0 ? (
        <>
          <Text style={[styles.groupLabel, { marginTop: payUri ? 14 : 4 }]}>
            Records
          </Text>
          <View style={styles.card}>
            {rows.map((row, i) => (
              <RecordRow
                key={row.id}
                row={row}
                first={i === 0}
                open={expanded === row.id}
                onToggle={() =>
                  setExpanded(expanded === row.id ? null : row.id)
                }
                copied={copied}
                copy={copy}
                openUri={openUri}
                styles={styles}
                colors={colors}
              />
            ))}
          </View>
        </>
      ) : (
        <Text style={styles.emptyNote}>No records published yet.</Text>
      )}

      {details.length > 0 && (
        <>
          <Text style={styles.groupLabel}>Details</Text>
          <View style={styles.card}>
            {details.map((d, i) => (
              <View key={d.label}>
                {i > 0 && <View style={styles.detailDivider} />}
                <TouchableOpacity
                  activeOpacity={d.copyable ? 0.6 : 1}
                  disabled={!d.copyable}
                  onPress={() => d.copyable && copy(`detail:${d.label}`, d.value)}
                  style={styles.detailRow}
                >
                  <Text style={styles.detailLabel}>{d.label}</Text>
                  <View style={styles.detailValWrap}>
                    <Text style={styles.detailValue} numberOfLines={1}>
                      {d.display}
                    </Text>
                    {d.copyable &&
                      (copied === `detail:${d.label}` ? (
                        <Check size={15} color={colors.accent} />
                      ) : (
                        <Copy size={15} color={colors.chevron} />
                      ))}
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function RecordRow({
  row,
  first,
  open,
  onToggle,
  copied,
  copy,
  openUri,
  styles,
  colors,
}: {
  row: ResRow;
  first: boolean;
  open: boolean;
  onToggle: () => void;
  copied: string | null;
  copy: (id: string, text: string) => void;
  openUri: (uri: string, copyFallback: string, id: string) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: Colors;
}) {
  const { def, known, values, primary } = row;
  const canOpen = def.action === "open" && known;
  return (
    <View>
      {!first && <View style={styles.divider} />}
      <TouchableOpacity
        style={[styles.row, open && { backgroundColor: colors.surfaceSunken }]}
        activeOpacity={0.7}
        onPress={onToggle}
        onLongPress={() => copy(row.id, primary)}
      >
        <View style={[styles.rowIco, { backgroundColor: def.color + "22" }]}>
          <def.Icon size={18} color={def.color} />
        </View>
        <View style={styles.rowMid}>
          <Text style={[styles.rowLabel, !known && styles.rowLabelMono]}>
            {def.label}
            {def.note ? <Text style={styles.rowNote}> {def.note}</Text> : null}
          </Text>
          {!open && (
            <Text style={styles.rowValue} numberOfLines={1}>
              {shorten(primary)}
            </Text>
          )}
        </View>
        {open ? (
          <ChevronUp size={17} color={colors.chevron} />
        ) : (
          <ChevronDown size={17} color={colors.chevron} />
        )}
      </TouchableOpacity>

      {open && (
        <View style={styles.exp}>
          {values.map((v, vi) => {
            const slot = def.slots[Math.min(vi, def.slots.length - 1)];
            const id = `${row.id}:${vi}`;
            return (
              <View key={id} style={vi > 0 ? styles.expSlot : undefined}>
                {values.length > 1 && slot?.label && (
                  <Text style={styles.expSub}>{slot.label}</Text>
                )}
                <Text style={styles.expFull} selectable>
                  {chunk(v)}
                </Text>
                <TouchableOpacity
                  style={styles.cpy}
                  onPress={() => copy(id, v)}
                  hitSlop={8}
                >
                  {copied === id ? (
                    <Check size={14} color={colors.accent} />
                  ) : (
                    <Copy size={14} color={colors.accent} />
                  )}
                  <Text style={styles.cpyText}>
                    {copied === id ? "Copied" : `Copy ${slot?.label?.toLowerCase() ?? "value"}`}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
          {canOpen && (
            <TouchableOpacity
              style={[styles.cpy, { marginTop: 4 }]}
              onPress={() => openUri(primary, primary, `${row.id}:open`)}
              hitSlop={8}
            >
              <ExternalLink size={14} color={colors.accent} />
              <Text style={styles.cpyText}>Open</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ── Instant shell while resolving (avatar + handle need no network) ──────────

function ResolveShell({
  handle,
  styles,
  colors,
}: {
  handle: string;
  styles: ReturnType<typeof makeStyles>;
  colors: Colors;
}) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.8,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const Bar = ({ w, h = 11, mb = 0 }: { w: string | number; h?: number; mb?: number }) => (
    <Animated.View
      style={{
        width: w as never,
        height: h,
        borderRadius: 5,
        backgroundColor: colors.surfaceSunken,
        opacity: pulse,
        marginBottom: mb,
      }}
    />
  );

  return (
    <View>
      <View style={styles.profile}>
        <Avatar handle={handle} size={76} />
        <Text style={styles.profileName}>{handle}</Text>
        <Text style={styles.resolving}>Resolving…</Text>
      </View>
      <View style={[styles.card, { marginTop: 6 }]}>
        {[0, 1].map((i) => (
          <View key={i}>
            {i > 0 && <View style={styles.divider} />}
            <View style={styles.row}>
              <Animated.View
                style={[styles.rowIco, { backgroundColor: colors.surfaceSunken, opacity: pulse }]}
              />
              <View style={styles.rowMid}>
                <Bar w={i === 0 ? "52%" : "38%"} mb={7} />
                <Bar w={i === 0 ? "72%" : "60%"} h={9} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    mono: { fontFamily: "monospace", color: c.textSecondary },

    // centered idle / not-found / error states
    centerState: { alignItems: "center", paddingTop: 48, paddingHorizontal: 8 },
    bigIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: c.surfaceSunken,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    centerTitle: { fontSize: 19, fontWeight: "600", color: c.text },
    centerName: {
      fontSize: 19,
      fontWeight: "600",
      color: c.text,
      textAlign: "center",
    },
    centerSub: {
      fontSize: 14,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      marginTop: 8,
      maxWidth: 300,
    },

    // not-found buy row
    buyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.card,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      marginTop: 22,
      alignSelf: "stretch",
    },
    buyIco: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: c.surfaceSunken,
      alignItems: "center",
      justifyContent: "center",
    },
    buyText: { flex: 1, fontSize: 15, color: c.text },

    // error card
    errNote: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 14,
      marginTop: 18,
      alignSelf: "stretch",
    },
    errNoteText: { fontSize: 13, color: c.textSecondary, lineHeight: 19 },
    retryBtn: {
      backgroundColor: c.accentMuted,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: "center",
      alignSelf: "stretch",
      marginTop: 14,
    },
    retryText: { fontSize: 15, fontWeight: "600", color: c.accentText },
    subtleLink: { fontSize: 14, color: c.textSecondary, marginTop: 14 },

    // profile header
    profile: { alignItems: "center", paddingTop: 14, paddingBottom: 18 },
    profileName: {
      fontSize: 23,
      fontWeight: "700",
      color: c.text,
      marginTop: 14,
      letterSpacing: -0.3,
      textAlign: "center",
    },
    resolving: { fontSize: 12.5, color: c.textMuted, marginTop: 9 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      marginTop: 9,
    },
    chipText: { fontSize: 12, fontWeight: "500" },

    // trust banner
    trust: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 10,
      marginBottom: 14,
    },
    trustText: { fontSize: 12.5, flex: 1, lineHeight: 17 },

    // record group + rows
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      overflow: "hidden",
    },
    payRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    rowIco: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    rowMid: { flex: 1, gap: 2 },
    rowLabel: { fontSize: 14.5, color: c.text, fontWeight: "500" },
    rowLabelMono: { fontFamily: "monospace", fontSize: 13, fontWeight: "400" },
    rowNote: { fontSize: 11.5, color: c.textMuted, fontWeight: "400" },
    rowHint: { fontSize: 12.5, color: c.textMuted },
    rowValue: { fontSize: 12.5, color: c.textSecondary, fontFamily: "monospace" },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 56 },

    // expanded detail
    exp: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 2, backgroundColor: c.surfaceSunken },
    expSlot: { marginTop: 12 },
    expSub: {
      fontFamily: "monospace",
      fontSize: 10,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: c.textMuted,
      marginBottom: 5,
    },
    expFull: {
      fontFamily: "monospace",
      fontSize: 13,
      color: c.text,
      lineHeight: 22,
    },
    cpy: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 9 },
    cpyText: { fontSize: 13, color: c.accent, fontWeight: "500" },

    emptyNote: {
      fontSize: 14,
      color: c.textSecondary,
      marginTop: 8,
      marginBottom: 4,
      textAlign: "center",
    },
    groupLabel: {
      fontFamily: "monospace",
      fontSize: 10.5,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: c.textMuted,
      marginTop: 20,
      marginBottom: 7,
      marginLeft: 4,
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    detailLabel: { fontSize: 13, color: c.textMuted },
    detailValWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexShrink: 1,
    },
    detailValue: {
      fontSize: 13.5,
      color: c.text,
      fontFamily: "monospace",
      flexShrink: 1,
    },
    detailDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginLeft: 16,
    },
  });