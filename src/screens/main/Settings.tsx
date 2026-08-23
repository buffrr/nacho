import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useFocusEffect, Stack } from "expo-router";
import type { NativeStackHeaderItem } from "@react-navigation/native-stack";
import {
  Host,
  FieldGroup,
  ListItem,
  Icon,
  Text,
  TextInput,
  Picker,
  Switch,
  useNativeState,
} from "@expo/ui";
import { useTheme } from "@/theme";
import {
  ensureSemiTrust,
  refreshSemiTrust,
  getTrustState,
  getTrustAnchor,
  getTrustedAnchor,
  getTipHeight,
  getSemiTrustPool,
  applySemiTrustPool,
  fetchRelayPubkey,
  quorumRequired,
  isFallbackEnabled,
  setFallbackEnabled,
  DEFAULT_SEMI_TRUSTED,
} from "@/fabric";
import { verifyErrorDetail } from "@/fabricResolver";
import {
  formatAnchor,
  TrustAnchor,
  TrustState,
  SemiTrustResult,
  Quorum,
} from "@/trust";

// Quorum policy exposed in the UI: All / Majority / At least N (dynamic).
type Policy = "all" | "majority" | "atLeast";

function toQuorum(policy: Policy, n: number, size: number): Quorum {
  if (policy === "all") return "all";
  if (policy === "majority") return "majority";
  return { atLeast: Math.min(Math.max(1, n), Math.max(1, size)) };
}

const shortKey = (pk: string) =>
  pk.length > 12 ? `${pk.slice(0, 6)}…${pk.slice(-6)}` : pk;
const shortHost = (url: string) =>
  url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

// How stale a trusted (Trust ID) anchor is relative to the current tip — the
// semi-trusted anchor tracks the tip, so the block gap tells you how far the
// trusted snapshot has fallen behind. ~10 min/block for the rough time.
function stalenessText(trustedHeight: number | null, tip: number | null): string | null {
  if (trustedHeight == null || tip == null) return null;
  const gap = tip - trustedHeight;
  if (gap <= 0) return "Current with tip";
  const mins = gap * 10;
  const rough =
    mins < 60
      ? `${mins}m`
      : mins < 1440
        ? `${Math.round(mins / 60)}h`
        : `${Math.round(mins / 1440)}d`;
  return `${gap.toLocaleString()} blocks behind tip · ~${rough} old`;
}

// One relay row: an editable URL plus the pinned key it was verified with. A key
// belongs to a specific URL, so editing the URL clears it (must re-fetch). A
// hook can't run in a loop, so each row owns its native text state.
function RelayRow({
  initialUrl,
  pubkey,
  onChangeUrl,
  onRemove,
  colors,
}: {
  initialUrl: string;
  pubkey: string;
  onChangeUrl: (t: string) => void;
  onRemove?: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const text = useNativeState(initialUrl);
  return (
    <ListItem
      leading={
        <Icon
          name={pubkey ? "key.fill" : "key"}
          size={18}
          color={pubkey ? colors.textSecondary : colors.textMuted}
        />
      }
      supportingText={pubkey ? shortKey(pubkey) : "Key fetched when you save"}
      trailing={
        onRemove ? (
          <Icon name="minus.circle" size={20} color={colors.textMuted} onPress={onRemove} />
        ) : undefined
      }
    >
      <TextInput
        value={text}
        placeholder="https://relay…"
        onChangeText={onChangeUrl}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </ListItem>
  );
}

export default function Settings() {
  const router = useRouter();
  const { scheme, colors } = useTheme();

  const [anchor, setAnchor] = useState<TrustAnchor | null>(getTrustAnchor());
  const [trust, setTrust] = useState<TrustState>(getTrustState());
  const [trustedAnchor, setTrustedAnchor] = useState<TrustAnchor | null>(
    getTrustedAnchor(),
  );
  const [tip, setTip] = useState<number | null>(getTipHeight());
  const [refreshing, setRefreshing] = useState(false);
  const [vote, setVote] = useState<SemiTrustResult | null>(null);

  // ── Semi-trusted relay pool (signed loader). Local editable mirror of the
  // Fabric pool: each row is { url, pubkey }; the key is fetched TOFU on demand.
  const rows = useRef<Map<string, { url: string; pubkey: string }>>(new Map());
  const idc = useRef(0);
  const mk = () => `r${idc.current++}`;
  const [relayIds, setRelayIds] = useState<string[]>([]);
  const [policy, setPolicy] = useState<Policy>("majority");
  const [atLeastN, setAtLeastN] = useState(1);
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackOn, setFallbackOn] = useState(true);

  useEffect(() => {
    isFallbackEnabled().then(setFallbackOn);
  }, []);

  const onToggleFallback = async (on: boolean) => {
    setFallbackOn(on);
    setError(null);
    setVote(null);
    setBusy(true);
    try {
      await setFallbackEnabled(on);
      setAnchor(getTrustAnchor());
      syncTrust();
    } finally {
      setBusy(false);
    }
  };

  // Load the current pool into local editor state (also used after reset).
  const loadPool = useCallback(() => {
    const pool = getSemiTrustPool();
    rows.current = new Map();
    const ids = pool.relays.map((r) => {
      const id = mk();
      rows.current.set(id, { url: r.url, pubkey: r.pubkey });
      return id;
    });
    setRelayIds(ids);
    if (pool.quorum === "all") setPolicy("all");
    else if (pool.quorum === "majority") setPolicy("majority");
    else {
      setPolicy("atLeast");
      setAtLeastN(Math.max(1, pool.quorum.atLeast));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPool();
  }, [loadPool]);

  const setUrl = (id: string) => (t: string) => {
    const v = rows.current.get(id);
    if (!v || v.url === t) return;
    // A key is tied to its URL — editing the URL invalidates it.
    const hadKey = !!v.pubkey;
    rows.current.set(id, { url: t, pubkey: "" });
    if (hadKey) setTick((x) => x + 1);
  };
  const addRelay = () => {
    const id = mk();
    rows.current.set(id, { url: "", pubkey: "" });
    setRelayIds((ids) => [...ids, id]);
  };
  const removeRelay = (id: string) => {
    rows.current.delete(id);
    setRelayIds((ids) => ids.filter((x) => x !== id));
  };

  // Relays the user has typed a URL for (the intended pool — keys may not be
  // fetched yet). Drives the quorum sizing so "At least N" isn't capped by how
  // many keys happen to be fetched.
  const urlRelays = relayIds.filter((id) => !!rows.current.get(id)?.url.trim());

  const apply = async (relays: { url: string; pubkey: string }[], q: Quorum) => {
    const result = await applySemiTrustPool(relays, q);
    setVote(result);
    setAnchor(getTrustAnchor());
    syncTrust();
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1600);
  };

  // One tap: fetch any missing keys (TOFU), then pin. If a relay can't be
  // reached we surface the error and DON'T save — nothing is pinned half-done.
  const onSave = async () => {
    setError(null);
    setBusy(true);
    try {
      const relays: { url: string; pubkey: string }[] = [];
      for (const id of relayIds) {
        const v = rows.current.get(id);
        const url = v?.url.trim();
        if (!v || !url) continue;
        let pubkey = v.pubkey;
        if (!pubkey) {
          const pk = await fetchRelayPubkey(url);
          if (!pk) {
            setError(`Couldn’t verify ${shortHost(url)} — check the URL is a reachable relay.`);
            return;
          }
          pubkey = pk;
          rows.current.set(id, { url: v.url, pubkey });
        }
        relays.push({ url: url.replace(/\/anchors\/?$/, ""), pubkey });
      }
      if (relays.length === 0) {
        setError("Add at least one relay.");
        return;
      }
      setTick((x) => x + 1); // reflect any freshly fetched keys
      await apply(relays, toQuorum(policy, atLeastN, relays.length));
    } catch (e) {
      // Surface the underlying verification/signature error, unwrapped.
      setError(verifyErrorDetail(e));
    } finally {
      setBusy(false);
    }
  };

  // Picker value encodes policy + N ("all" | "majority" | "atLeast:3").
  const onQuorumChange = (v: string) => {
    if (v === "all" || v === "majority") {
      setPolicy(v);
    } else {
      const n = parseInt(v.split(":")[1] ?? "1", 10);
      setPolicy("atLeast");
      setAtLeastN(Number.isFinite(n) && n > 0 ? n : 1);
    }
  };

  const onReset = async () => {
    setError(null);
    setBusy(true);
    try {
      await apply(DEFAULT_SEMI_TRUSTED.map((r) => ({ ...r })), "majority");
      loadPool();
    } finally {
      setBusy(false);
    }
  };

  // Re-read the trusted anchor whenever the tab regains focus, so a Trust ID
  // just scanned in VerifyAnchor shows up on return.
  const syncTrust = useCallback(() => {
    setTrust(getTrustState());
    setTrustedAnchor(getTrustedAnchor());
    setTip(getTipHeight());
  }, []);

  useFocusEffect(syncTrust);

  useEffect(() => {
    let active = true;
    ensureSemiTrust().then((a) => {
      if (!active) return;
      setAnchor(a);
      syncTrust();
    });
    return () => {
      active = false;
    };
  }, [syncTrust]);

  const onRefreshAnchor = async () => {
    setRefreshing(true);
    try {
      const result = await refreshSemiTrust();
      setVote(result);
      setAnchor(getTrustAnchor());
      syncTrust();
    } finally {
      setRefreshing(false);
    }
  };

  const safetyIdSet = !!trust.trusted;
  const trustedHeight = trustedAnchor?.height ?? null;
  const gap = trustedHeight != null && tip != null ? tip - trustedHeight : null;
  const staleness = stalenessText(trustedHeight, tip);
  const expiryColor =
    gap != null && gap > 0 ? colors.statusAmberFg : colors.statusGreenFg;

  const anchorLine = refreshing
    ? "Refreshing…"
    : anchor
      ? formatAnchor(anchor)
      : "Not set — tap to fetch";

  const poolSize = urlRelays.length;
  const required = quorumRequired(toQuorum(policy, atLeastN, poolSize), poolSize);
  const quorumValue =
    policy === "atLeast" ? `atLeast:${Math.min(atLeastN, Math.max(1, poolSize))}` : policy;
  const voteLine = vote
    ? vote.quorumMet
      ? `${vote.agreed}/${vote.total} sources agreed`
      : `Quorum not met — ${vote.agreed}/${vote.total} sources agreed, kept previous anchor`
    : null;

  // Nothing to save when the fallback is off.
  const headerItems: NativeStackHeaderItem[] = fallbackOn
    ? [
        {
          type: "button",
          label: busy ? "…" : savedTick ? "Saved ✓" : "Save",
          tintColor: colors.text,
          onPress: onSave,
        },
      ]
    : [];

  return (
    <>
      <Stack.Screen options={{ unstable_headerRightItems: () => headerItems }} />
      <Host style={{ flex: 1 }} colorScheme={scheme}>
        <FieldGroup>
          {/* YOUR TRUST ID — strongest guarantee; first on the page. */}
          <FieldGroup.Section title="Your Trust ID">
            {safetyIdSet ? (
              <>
                <ListItem
                  leading={
                    <Icon name="checkmark.shield.fill" size={22} color={colors.statusGreenFg} />
                  }
                  supportingText={
                    trustedAnchor ? formatAnchor(trustedAnchor) : "Pinned"
                  }
                  trailing={
                    <Icon name="checkmark.circle.fill" size={18} color={colors.statusGreenFg} />
                  }
                >
                  <Text>Trust ID</Text>
                </ListItem>
                {staleness ? (
                  <ListItem
                    trailing={
                      <Text textStyle={{ fontSize: 13, color: expiryColor }}>
                        {staleness}
                      </Text>
                    }
                  >
                    <Text textStyle={{ color: colors.textSecondary }}>Freshness</Text>
                  </ListItem>
                ) : null}
                <ListItem
                  leading={<Icon name="qrcode.viewfinder" size={22} color={colors.textSecondary} />}
                  trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
                  onPress={() => router.push("/(main)/verify-anchor")}
                >
                  <Text>Rescan Trust ID</Text>
                </ListItem>
              </>
            ) : (
              <ListItem
                leading={<Icon name="qrcode.viewfinder" size={22} color={colors.textSecondary} />}
                trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
                onPress={() => router.push("/(main)/verify-anchor")}
              >
                <Text>Scan a Trust ID</Text>
              </ListItem>
            )}
            <FieldGroup.SectionFooter>
              <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                Scanned from a local Veritas client, your Trust ID verifies
                sovereign handles against your own anchor — the strongest
                guarantee, with nothing trusted in between.
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>

          {/* TRUST FALLBACK SOURCES — one group: an on/off toggle, then (when on)
              the signed source pool + policy. Reads as a single bootstrap
              mechanism, never as part of Trust-ID verification. */}
          <FieldGroup.Section title="Trust fallback sources">
            <ListItem
              trailing={
                <Switch value={fallbackOn} onValueChange={onToggleFallback} />
              }
            >
              <Text>Use fallback sources</Text>
            </ListItem>

            {fallbackOn ? (
              <>
                <ListItem
                  leading={<Icon name="shield.lefthalf.filled" size={22} color={colors.textSecondary} />}
                  supportingText={anchorLine}
                  trailing={<Icon name="arrow.clockwise" size={16} color={colors.chevron} />}
                  onPress={onRefreshAnchor}
                >
                  <Text>Default anchor</Text>
                </ListItem>
                {voteLine ? (
                  <ListItem
                    leading={
                      <Icon
                        name={vote?.quorumMet ? "checkmark.seal.fill" : "exclamationmark.triangle.fill"}
                        size={20}
                        color={vote?.quorumMet ? colors.statusGreenFg : colors.statusAmberFg}
                      />
                    }
                  >
                    <Text textStyle={{ fontSize: 13, color: colors.textSecondary }}>{voteLine}</Text>
                  </ListItem>
                ) : null}

                {/* Editable source pool — each source pinned to its signing key. */}
                {relayIds.map((id) => {
                  const v = rows.current.get(id);
                  return (
                    <RelayRow
                      key={id}
                      initialUrl={v?.url ?? ""}
                      pubkey={v?.pubkey ?? ""}
                      onChangeUrl={setUrl(id)}
                      onRemove={relayIds.length > 1 ? () => removeRelay(id) : undefined}
                      colors={colors}
                    />
                  );
                })}
                <ListItem
                  leading={<Icon name="plus.circle.fill" size={20} color={colors.textSecondary} />}
                  onPress={addRelay}
                >
                  <Text textStyle={{ color: colors.text }}>Add source</Text>
                </ListItem>

                {/* Policy — Any / Majority / All / At least K. "Majority" and
                    "All" adapt to the pool size; "At least K" is a fixed count;
                    "Any" (K=1) means a single source suffices. */}
                <ListItem
                  supportingText={
                    poolSize > 0 ? `Needs ${required} of ${poolSize} to agree` : undefined
                  }
                  trailing={
                    <Picker
                      selectedValue={quorumValue}
                      onValueChange={(v) => onQuorumChange(String(v))}
                    >
                      <Picker.Item label="All" value="all" />
                      <Picker.Item label="Majority" value="majority" />
                      {Array.from({ length: poolSize }, (_, i) => i + 1).map((k) => (
                        <Picker.Item
                          key={k}
                          label={k === 1 ? "Any" : `At least ${k}`}
                          value={`atLeast:${k}`}
                        />
                      ))}
                    </Picker>
                  }
                >
                  <Text>Policy</Text>
                </ListItem>

                {error ? (
                  <ListItem
                    leading={
                      <Icon name="exclamationmark.triangle.fill" size={20} color={colors.statusAmberFg} />
                    }
                  >
                    <Text textStyle={{ fontSize: 13, color: colors.statusAmberFg }}>{error}</Text>
                  </ListItem>
                ) : null}
              </>
            ) : null}

            <FieldGroup.SectionFooter>
              <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                Fallback sources are used only when no Trust ID is set or it’s
                stale. Nacho shows which Trust ID it used to verify each response.
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>

          {/* Reset sits UNDER the group — a rare, separate action. */}
          {fallbackOn ? (
            <FieldGroup.Section>
              <ListItem
                leading={<Icon name="arrow.counterclockwise" size={20} color={colors.textSecondary} />}
                onPress={onReset}
              >
                <Text textStyle={{ color: colors.textSecondary }}>Reset to defaults</Text>
              </ListItem>
            </FieldGroup.Section>
          ) : null}
        </FieldGroup>
      </Host>
    </>
  );
}
