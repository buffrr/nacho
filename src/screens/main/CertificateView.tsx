import React, { useCallback, useEffect, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Host,
  FieldGroup,
  ListItem,
  Icon,
  Text,
  Column,
  Row,
  Spacer,
} from "@expo/ui";
import { refreshable } from "@/ui/rowModifiers";
import { useTheme } from "@/theme";
import { useStore } from "@/Store";
import { NativeEmpty } from "@/ui/nativeEmpty";
import { loadCert } from "@/certStore";
import { saveBinary } from "@/file";
import { resolveHandleWithCerts, getTipHeight } from "@/fabric";
import {
  certStateOf,
  certStateFromSovereignty,
  anchoringCommitment,
  committedAtFromHeight,
  getCachedCerts,
  setCachedCerts,
  isFinalCached,
  CertState,
} from "@/certState";
import type { ResolvedWithCerts } from "@/fabricResolver";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function agoText(ms: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  const h = Math.round(s / 3600);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// A commitment is irreversible once it has 144 confirmations (final on the
// 145th block). Bitcoin blocks are ~10 min, so the remaining blocks give a rough
// time-to-finality — nicer than a bare "confirming".
const FINALITY_BLOCKS = 144;
function etaText(blocksRemaining: number | null): string | null {
  if (blocksRemaining == null || blocksRemaining <= 0) return null;
  const mins = blocksRemaining * 10;
  if (mins < 90) return `~${mins} minutes`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `~${hours} hours`;
  return `~${Math.round(hours / 24)} days`;
}

// The certificate screen (certs_mockup.html §02–03): one hero line for the
// current state, Export/Chain actions, and a muted Replace. Provisional differs
// by origin — a stage (bought in-app) vs possibly permanent (issued elsewhere).
// Resolution + cert chain come from resolveWithCerts; we don't re-fetch once
// final (immutable), and pull-to-refresh re-runs it otherwise.
export default function CertificateView() {
  const router = useRouter();
  const { scheme, colors } = useTheme();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { handles } = useStore();
  const handleData = handles?.[handle];
  const boughtViaNacho = !!handleData?.purchase;
  // Known sovereignty from the cached resolution — the fallback state when the
  // full cert fetch hasn't landed (or failed with "no peers").
  const knownSovereignty =
    (handleData?.resolution?.found ? handleData.resolution.sovereignty : undefined) ??
    handleData?.certRef?.sovereignty ??
    null;

  const [resolved, setResolved] = useState<ResolvedWithCerts | null>(() =>
    getCachedCerts(handle),
  );
  const [loading, setLoading] = useState(!resolved);
  const [unverified, setUnverified] = useState(false);
  const now = Date.now();

  const fetch = useCallback(
    async (fresh: boolean) => {
      // Final chains are immutable — serve cache, never re-query.
      if (!fresh && isFinalCached(handle)) {
        setResolved(getCachedCerts(handle));
        setLoading(false);
        return;
      }
      try {
        const r = await resolveHandleWithCerts(handle, fresh);
        if (r) {
          // A cert chain we couldn't verify against an anchor may be forged —
          // never cache or trust it silently.
          if (r.badge === "unverified") {
            setUnverified(true);
          } else {
            setUnverified(false);
            setCachedCerts(handle, r);
            setResolved(r);
          }
        }
      } catch {
        // keep whatever we have
      } finally {
        setLoading(false);
      }
    },
    [handle],
  );

  useEffect(() => {
    void fetch(false);
  }, [fetch]);

  const onRefresh = useCallback(async () => {
    await fetch(true);
  }, [fetch]);

  const onExport = useCallback(async () => {
    const bytes = (await loadCert(handle)) ?? resolved?.certs ?? null;
    if (bytes) await saveBinary(`${handle}.spacecert`, bytes);
  }, [handle, resolved]);

  const state: CertState = resolved
    ? certStateOf(resolved.zone)
    : certStateFromSovereignty(knownSovereignty);
  const parentCount = resolved?.parents.length ?? 0;
  // Commitment that anchors this handle (its own, else the parent's).
  const anchor = resolved ? anchoringCommitment(resolved) : null;
  const committedAt = anchor
    ? committedAtFromHeight(anchor.commitment.blockHeight, getTipHeight(), now)
    : null;
  const remainingBlocks =
    anchor?.commitment.confirmations != null
      ? Math.max(0, FINALITY_BLOCKS - anchor.commitment.confirmations)
      : null;

  if (loading && !resolved) {
    return (
      <>
        <Stack.Screen options={{ title: "Certificate" }} />
        <NativeEmpty sf="clock" title="Loading certificate…" />
      </>
    );
  }

  // Couldn't verify the chain and have nothing verified to fall back on — warn
  // rather than render an untrusted certificate.
  if (unverified && !resolved) {
    return (
      <>
        <Stack.Screen options={{ title: "Certificate" }} />
        <NativeEmpty
          sf="exclamationmark.shield.fill"
          iconColor={colors.dangerText}
          title="Couldn’t verify"
          message="No configured anchor could verify this certificate — it may be forged."
          primary={{ label: "Try again", onPress: () => fetch(true) }}
        />
      </>
    );
  }

  // Hero content per state.
  let heroIcon: import("sf-symbols-typescript").SFSymbol = "clock";
  let heroColor = colors.textSecondary;
  let heroTitle = "Provisional";
  let heroDesc =
    "This certificate isn’t committed on-chain. Whoever issued it can still revoke or replace it.";
  let note: string | null = "Most operators anchor within a few days.";
  if (state === "provisional" && boughtViaNacho) {
    heroTitle = "Provisional · anchoring to Bitcoin";
    heroDesc =
      "Usually within a day. Nothing to do — your handle works and records publish normally.";
    note = null;
  } else if (state === "confirming") {
    heroTitle = "Anchored, confirming";
    const eta = etaText(remainingBlocks);
    const committedPart = committedAt ? `Committed on-chain ${agoText(committedAt, now)}. ` : "";
    heroDesc = eta
      ? `${committedPart}Becomes irrevocable in ${eta}.`
      : `${committedPart}Becomes irrevocable shortly.`;
    note =
      "Until then the operator can still replace this commitment. If they do, the app fetches the new certificate.";
  } else if (state === "final") {
    heroIcon = "checkmark.seal.fill";
    heroColor = colors.statusGreenFg;
    heroTitle = committedAt ? `Final · anchored ${fmtDate(committedAt)}` : "Final";
    heroDesc =
      "Ownership is proven on-chain and can’t be revoked. Nothing further gets issued.";
    note = null;
  }
  const isFinal = state === "final";

  return (
    <>
      <Stack.Screen options={{ title: "Certificate" }} />
      <Host style={{ flex: 1 }} colorScheme={scheme}>
        <FieldGroup modifiers={[refreshable(onRefresh)]}>
          {/* Status hero — its detail line lives with it; any extra note sits
              OUTSIDE the card as a footer. Confirming keeps the default color. */}
          <FieldGroup.Section>
            <ListItem leading={<Icon name={heroIcon} size={22} color={heroColor} />}>
              <Column spacing={3}>
                <Text textStyle={{ fontSize: 15, color: colors.text }}>{heroTitle}</Text>
                <Text textStyle={{ fontSize: 13, color: colors.textSecondary }}>
                  {heroDesc}
                </Text>
              </Column>
            </ListItem>
            {/* Chain lives with the anchoring status — it explains how this state
                comes to be. */}
            {parentCount > 0 ? (
              <ListItem
                leading={<Icon name="link" size={22} color={colors.textSecondary} />}
                trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
                onPress={() =>
                  router.push({
                    pathname: "/(main)/(tabs)/handles/certificate-chain",
                    params: { handle },
                  })
                }
              >
                <Text>Certificate chain</Text>
              </ListItem>
            ) : null}
            {note ? (
              <FieldGroup.SectionFooter>
                <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>{note}</Text>
              </FieldGroup.SectionFooter>
            ) : null}
          </FieldGroup.Section>

          {/* Export — single-line row; the explanation is the footer. */}
          <FieldGroup.Section>
            <ListItem
              leading={
                <Icon
                  name="square.and.arrow.up"
                  size={22}
                  color={isFinal ? colors.accent : colors.textSecondary}
                />
              }
              trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
              onPress={onExport}
            >
              <Text>Export certificate</Text>
            </ListItem>
            <FieldGroup.SectionFooter>
              <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                {isFinal
                  ? "This certificate proves the handle is yours. Keep a copy somewhere safe."
                  : "Worth waiting — the final certificate supersedes this one, and that’s the copy to keep."}
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>

          {/* Replace — repair, not a peer of export; single-line + footer. */}
          <FieldGroup.Section>
            <ListItem
              leading={<Icon name="square.and.arrow.down" size={22} color={colors.textMuted} />}
              trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
              onPress={() =>
                router.push({
                  pathname: "/(main)/(tabs)/handles/import-certificate",
                  params: { handle },
                })
              }
            >
              <Text textStyle={{ color: colors.textSecondary }}>Replace certificate</Text>
            </ListItem>
            <FieldGroup.SectionFooter>
              <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                If you were sent one directly — only needed if the certificate didn’t
                arrive on its own.
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
    </>
  );
}
