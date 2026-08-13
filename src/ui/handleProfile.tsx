import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Animated,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Colors, useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import {
  Copy,
  Check,
  ShoppingBag,
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
import { ResolvedHandle } from "@/fabricResolver";
import { lookupRecord, paymentUri, RecordDef } from "@/recordRegistry";

// Shared rendering for a resolved handle — the profile, records, details, the
// loading shell, and the not-found / network / verification states. Used by the
// Search tab (src/screens/main/Resolve) and the standalone handle view opened
// from Recents (src/screens/main/HandleView), so the two stay identical.

type ResRow = {
  id: string;
  def: RecordDef;
  known: boolean;
  values: string[];
  primary: string;
};

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
  if (alias) out.push({ label: "Alias", value: alias, display: alias, copyable: false });
  return out;
}

function toRows(resolved: ResolvedHandle): ResRow[] {
  const rows: ResRow[] = [];
  let i = 0;
  for (const rec of resolved.zone.records ?? []) {
    if (rec.type !== "addr" && rec.type !== "txt") continue;
    if (typeof rec.key !== "string") continue;
    const values = (rec.value ?? []).map(String).filter(Boolean);
    if (values.length === 0) continue;
    const { def, known } = lookupRecord(rec.type, rec.key);
    rows.push({ id: `${rec.key}:${i++}`, def, known, values, primary: values[0] });
  }
  return rows;
}

// Count of renderable records (addr/txt) — for the Recents snapshot.
export function recordCountOf(resolved: ResolvedHandle): number {
  return toRows(resolved).length;
}

// ── Trust banner ─────────────────────────────────────────────────────────────
function TrustBanner({
  badge,
  styles,
  colors,
}: {
  badge: ResolvedHandle["badge"];
  styles: ReturnType<typeof makeStyles>;
  colors: Colors;
}) {
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

// ── The resolved profile (avatar, handle, chip, trust, pay, records, details) ──
export function ResolvedProfile({ result }: { result: ResolvedHandle }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = useCallback((id: string, text: string) => {
    Clipboard.setStringAsync(text);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1400);
  }, []);
  const openUri = useCallback(
    (uri: string, copyFallback: string, id: string) => {
      Linking.openURL(uri).catch(() => copy(id, copyFallback));
    },
    [copy],
  );

  const rows = useMemo(() => toRows(result), [result]);
  const details = useMemo(() => toDetails(result.zone), [result.zone]);
  const payUri = useMemo(
    () =>
      paymentUri(
        rows.map((r) => ({ rtype: r.def.rtype, key: r.def.key, value: r.primary })),
      ),
    [rows],
  );
  const payCopy = useMemo(
    () => rows.find((r) => r.def.tier === "destination")?.primary ?? "",
    [rows],
  );
  const sovereign = result.zone.sovereignty === "sovereign";

  return (
    <View>
      <View style={styles.profile}>
        <Avatar handle={result.handle} size={76} />
        <Text style={styles.profileName}>{result.handle}</Text>
        <View
          style={[
            styles.chip,
            { backgroundColor: sovereign ? colors.statusGreenBg : colors.surfaceSunken },
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
                onToggle={() => setExpanded(expanded === row.id ? null : row.id)}
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
                <TouchableOpacity style={styles.cpy} onPress={() => copy(id, v)} hitSlop={8}>
                  {copied === id ? (
                    <Check size={14} color={colors.accent} />
                  ) : (
                    <Copy size={14} color={colors.accent} />
                  )}
                  <Text style={styles.cpyText}>
                    {copied === id
                      ? "Copied"
                      : `Copy ${slot?.label?.toLowerCase() ?? "value"}`}
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

// ── Loading shell (avatar + handle need no network) ──────────────────────────
export function ProfileShell({ handle }: { handle: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
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

// ── Answer / failure states ──────────────────────────────────────────────────
export function NotFoundState({ name, onBuy }: { name: string; onBuy: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.centerState}>
      <View style={styles.bigIcon}>
        <SearchX size={28} color={colors.textMuted} />
      </View>
      <Text style={styles.centerName}>{name}</Text>
      <Text style={styles.centerSub}>
        Nothing published for this handle. It may not be registered, or the owner
        hasn’t published records yet.
      </Text>
      <TouchableOpacity style={styles.buyRow} activeOpacity={0.7} onPress={onBuy}>
        <View style={styles.buyIco}>
          <ShoppingBag size={18} color={colors.textSecondary} />
        </View>
        <Text style={styles.buyText}>Buy this handle</Text>
        <ChevronRight size={18} color={colors.chevron} />
      </TouchableOpacity>
    </View>
  );
}

export function NetworkErrorState({
  handle,
  onRetry,
  onRelaySettings,
}: {
  handle: string;
  onRetry: () => void;
  onRelaySettings: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.centerState}>
      <View style={styles.bigIcon}>
        <WifiOff size={26} color={colors.textMuted} />
      </View>
      <Text style={styles.centerName}>Couldn’t reach any relay</Text>
      <Text style={styles.centerSub}>
        We don’t know whether {handle || "this handle"} exists — no relay
        responded. This isn’t a “not found”.
      </Text>
      <TouchableOpacity style={styles.retryBtn} activeOpacity={0.8} onPress={onRetry}>
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onRelaySettings}>
        <Text style={styles.subtleLink}>Relay settings</Text>
      </TouchableOpacity>
    </View>
  );
}

export function VerifyErrorState({
  handle,
  onRetry,
  onTrustSettings,
}: {
  handle: string;
  onRetry: () => void;
  onTrustSettings: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
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
          Records aren’t shown, because we can’t confirm they’re genuine. This is
          usually a stale anchor or a relay serving old data.
        </Text>
      </View>
      <TouchableOpacity style={styles.retryBtn} activeOpacity={0.8} onPress={onRetry}>
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onTrustSettings}>
        <Text style={styles.subtleLink}>Trust settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
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
    centerName: { fontSize: 19, fontWeight: "600", color: c.text, textAlign: "center" },
    centerSub: {
      fontSize: 14,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      marginTop: 8,
      maxWidth: 300,
    },
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
    card: { backgroundColor: c.card, borderRadius: 16, overflow: "hidden" },
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
    expFull: { fontFamily: "monospace", fontSize: 13, color: c.text, lineHeight: 22 },
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
    detailValWrap: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
    detailValue: { fontSize: 13.5, color: c.text, fontFamily: "monospace", flexShrink: 1 },
    detailDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginLeft: 16,
    },
  });
