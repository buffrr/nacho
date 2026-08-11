import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
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
import { Message } from "@/ui/Message";
import {
  Copy,
  Check,
  ShoppingBag,
  Bitcoin,
  Zap,
  EyeOff,
  Droplet,
  Anchor,
  Lock,
  Key,
  Hash,
  FileText,
  Binary,
  IconProps,
} from "@/ui/icons";
import { resolveHandle } from "@/fabric";
import { ResolvedHandle } from "@/fabricResolver";


type ResRow = {
  key: string;
  label: string;
  value: string; // canonical (copy / payment URI)
  display: string; // shown, possibly truncated
  sub?: string;
  Icon: (p: IconProps) => React.JSX.Element;
  color: string;
  uri?: string; // payment URI, if payable
};

function shorten(value: string): string {
  if (value.length <= 22) return value;
  return `${value.slice(0, 9)}…${value.slice(-6)}`;
}

function btcNetwork(addr: string): string {
  const a = addr.toLowerCase();
  if (a.startsWith("bcrt")) return "Regtest";
  if (a.startsWith("tb1") || /^[mn2]/.test(addr)) return "Testnet";
  return "Mainnet";
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Classify one `addr` record. Recognized types (Bitcoin, Lightning, Silent
// Payments, Liquid, Ark, age, nostr…) get a distinctive icon/colour and, where
// applicable, a payment URI; anything else is still shown (any addr could be a
// payment rail we don't recognise yet) with a generic icon.
function classifyAddr(rawKey: string, value: string): ResRow {
  const key = rawKey.toLowerCase();
  const base = { key, value, display: shorten(value) };

  if (/^btc$|bitcoin|onchain/.test(key) || /^(bc1|tb1|bcrt|[13])/.test(value)) {
    const net = btcNetwork(value);
    return {
      ...base, label: "Bitcoin", Icon: Bitcoin, color: "#F7931A",
      uri: `bitcoin:${value}`,
      // Only surface the network when it's NOT mainnet, as a safety flag.
      sub: net === "Mainnet" ? undefined : net,
    };
  }
  if (/^ln$|lightning|lnurl|bolt11/.test(key) || /^lnbc/i.test(value)) {
    return {
      ...base, label: "Lightning",
      display: value.length > 28 ? shorten(value) : value,
      Icon: Zap, color: "#EAB308", uri: `lightning:${value}`,
    };
  }
  if (/^sp$|silent/.test(key) || /^sp1/i.test(value)) {
    return { ...base, label: "Silent Payment", Icon: EyeOff, color: "#8B5CF6", uri: `bitcoin:${value}` };
  }
  if (/liquid|^lq$/.test(key) || /^(lq1|ex1|vjl)/i.test(value)) {
    return { ...base, label: "Liquid", Icon: Droplet, color: "#2563EB", uri: `liquidnetwork:${value}` };
  }
  if (/^ark$/.test(key) || /^ark1/i.test(value)) {
    return { ...base, label: "Ark", Icon: Anchor, color: "#0D9488", uri: `ark:${value}` };
  }
  if (/^age$/.test(key) || /^age1/.test(value)) {
    return { ...base, label: "Age", Icon: Lock, color: "#64748B" };
  }
  if (/nostr|^npub$/.test(key) || /^npub1/.test(value)) {
    return { ...base, label: "Nostr", Icon: Key, color: "#7C3AED" };
  }
  return { ...base, label: titleCase(rawKey), Icon: Hash, color: "#64748B" };
}

// Split the zone's records into addresses (all `addr` records, in published
// order — payment vs non-payment isn't separated since any addr may be a
// payment rail) and plain records (txt / blob). seq/sig are protocol internals.
function classify(resolved: ResolvedHandle): {
  addresses: ResRow[];
  records: ResRow[];
} {
  const addresses: ResRow[] = [];
  const records: ResRow[] = [];

  for (const rec of resolved.zone.records ?? []) {
    const key = typeof rec.key === "string" ? rec.key.toLowerCase() : "";
    const values = (rec.value ?? []).map(String);
    const value = values.find(Boolean) ?? "";

    if (rec.type === "addr" && typeof rec.key === "string" && value) {
      addresses.push(classifyAddr(rec.key, value));
    } else if (rec.type === "txt" && key) {
      const v = values.join(", ");
      records.push({
        key, label: String(rec.key), value: v,
        display: v.length > 40 ? shorten(v) : v,
        Icon: FileText, color: "#64748B",
      });
    } else if (rec.type === "blob") {
      const v = values.join("");
      records.push({
        key: key || "blob", label: rec.key ? String(rec.key) : "Blob",
        value: v, display: v ? shorten(v) : "binary data",
        Icon: Binary, color: "#64748B",
      });
    }
  }

  return { addresses, records };
}

function copyText(text: string) {
  Clipboard.setStringAsync(text);
}

export default function Resolve() {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [handle, setHandle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ResolvedHandle | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onResolve = async (nameArg?: string) => {
    const name = (nameArg ?? handle).trim().toLowerCase();
    if (!name.includes("@") || isLoading) return;
    setIsLoading(true);
    setError(null);
    setNotFound(null);
    setResult(null);
    try {
      const resolved = await resolveHandle(name);
      if (resolved) {
        setResult(resolved);
      } else {
        // Not on the decentralized network. We do NOT auto-check the shop here —
        // that would leak every lookup to the central server. Offer an explicit
        // "check availability" (see the notFound render).
        setNotFound(name);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resolve handle");
    } finally {
      setIsLoading(false);
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

  // Transient outcomes shouldn't greet the user on arrival — clear a stale
  // error / not-found each time the tab regains focus (keeps a valid result).
  useFocusEffect(
    useCallback(() => {
      setError(null);
      setNotFound(null);
    }, []),
  );

  const { addresses, records } = result
    ? classify(result)
    : { addresses: [], records: [] };
  // Fabric's three-tier badge: "orange" = verified against a trusted (Safety ID)
  // anchor → green Verified; "unverified" = observed only / no anchor → grey
  // Unverified; "none" = matched a semi-trusted anchor → show no badge at all
  // (per the design, a pinned semi-trusted anchor is trustworthy enough to not
  // flag). Only "unverified" warrants a warning.
  const verified = result?.badge === "orange";
  const showBadge = result?.badge === "orange" || result?.badge === "unverified";
  const isEmpty = addresses.length === 0 && records.length === 0;

  const renderSection = (title: string, rows: ResRow[]) =>
    rows.length === 0 ? null : (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{title}</Text>
        <View style={styles.card}>
          {rows.map((row, i) => (
            <React.Fragment key={row.key + i}>
              {i > 0 && <View style={styles.divider} />}
              <View style={styles.row}>
                <View style={[styles.iconTile, { backgroundColor: row.color + "22" }]}>
                  <row.Icon size={20} color={row.color} />
                </View>
                <View style={styles.rowMid}>
                  <Text style={styles.rowLabel}>
                    {row.label}
                    {row.sub ? ` · ${row.sub}` : ""}
                  </Text>
                  <Text style={styles.rowValue} numberOfLines={1}>
                    {row.display}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => copyText(row.value)} hitSlop={6}>
                  <Copy size={16} color={colors.iconDefault} />
                </TouchableOpacity>
              </View>
            </React.Fragment>
          ))}
        </View>
      </View>
    );

  return (
    <Layout tabBarInset underHeader keyboardAware={false}>
      {/* Native UISearchController field in the nav bar — no in-content input,
          so no keyboard/scroll conflict. Typing updates the handle; the keyboard
          "Search" key resolves. */}
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: "satoshi@bitcoin",
            autoCapitalize: "none",
            hideWhenScrolling: false,
            textColor: colors.text,
            tintColor: colors.accent,
            onChangeText: (e) => {
              const t = e.nativeEvent.text.trim().toLowerCase();
              setHandle(t);
              // A new/edited query invalidates any previous outcome — clear the
              // last error/not-found so a stale one doesn't linger on the tab.
              setError(null);
              setNotFound(null);
              if (!t) setResult(null);
            },
            onSearchButtonPress: (e) => onResolve(e.nativeEvent.text),
            onCancelButtonPress: () => {
              setHandle("");
              setError(null);
              setNotFound(null);
              setResult(null);
            },
          },
        }}
      />

      {!result && !isLoading && !error && !notFound && (
        <Text style={styles.subtitle}>Look up a handle to pay or verify.</Text>
      )}

      {isLoading && (
        <ActivityIndicator color={colors.accent} style={styles.loader} size="large" />
      )}
      {error && <Message message={error} type="error" />}
      {notFound && (
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>Not registered</Text>
          <Text style={styles.notFoundSub}>
            <Text style={styles.notFoundName}>{notFound}</Text> isn't on the network
            yet.
          </Text>
          <TouchableOpacity
            style={styles.checkBtn}
            onPress={() =>
              router.push({ pathname: "/(main)/shop", params: { prefill: notFound } })
            }
          >
            <ShoppingBag size={18} color={colors.accent} />
            <Text style={styles.checkBtnText}>Check if it's available to buy</Text>
          </TouchableOpacity>
        </View>
      )}

      {result && (
        <>
          <View style={styles.identity}>
            <Avatar handle={result.handle} size={40} />
            <Text style={styles.idName} numberOfLines={1}>
              {result.handle}
            </Text>
            {showBadge && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: verified
                      ? colors.statusGreenBg
                      : colors.statusGreyBg,
                  },
                ]}
              >
                {verified && <Check size={14} color={colors.statusGreenFg} />}
                <Text
                  style={[
                    styles.badgeText,
                    { color: verified ? colors.statusGreenFg : colors.statusGreyFg },
                  ]}
                >
                  {verified ? "Verified" : "Unverified"}
                </Text>
              </View>
            )}
          </View>

          {renderSection("ADDRESSES", addresses)}
          {renderSection("RECORDS", records)}

          {isEmpty && (
            <Text style={styles.emptyNote}>
              This handle has no published records.
            </Text>
          )}
        </>
      )}
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    title: {
      fontSize: 26,
      fontWeight: "700",
      color: c.text,
      marginTop: 4,
    },
    subtitle: {
      fontSize: 14,
      color: c.textSecondary,
      marginTop: 6,
      marginBottom: 20,
    },
    loader: {
      marginTop: 28,
    },
    notFound: {
      marginTop: 20,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 16,
      padding: 18,
      gap: 6,
    },
    notFoundTitle: { fontSize: 17, fontWeight: "700", color: c.text },
    notFoundSub: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
    notFoundName: { color: c.text, fontFamily: "monospace" },
    checkBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 10,
      backgroundColor: c.accent + "1A",
      borderRadius: 12,
      paddingVertical: 13,
    },
    checkBtnText: { fontSize: 15, fontWeight: "600", color: c.accent },
    identity: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 22,
      marginBottom: 4,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    idName: {
      flex: 1,
      fontSize: 18,
      fontWeight: "700",
      color: c.text,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: "500",
    },
    section: {
      marginTop: 18,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "500",
      letterSpacing: 0.6,
      color: c.textMuted,
      marginBottom: 10,
    },
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 16,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    iconTile: {
      width: 40,
      height: 40,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    rowMid: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: c.text,
    },
    rowValue: {
      fontSize: 13,
      color: c.textSecondary,
      fontFamily: "monospace",
    },
    divider: {
      height: 1,
      backgroundColor: c.border,
      marginLeft: 66,
    },
    emptyNote: {
      fontSize: 14,
      color: c.textSecondary,
      marginTop: 20,
    },
  });
