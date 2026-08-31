import React, { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTheme } from "@/theme";
import { resolveHandle, refreshSemiTrust } from "@/fabric";
import {
  ResolvedHandle,
  verifyErrorMessage,
  isStaleAnchorError,
} from "@/fabricResolver";
import { recordResolve } from "@/resolveHistory";
import { ResolvedProfileNative, recordCountOf } from "@/ui/handleProfileNative";
import { NativeEmpty } from "@/ui/nativeEmpty";
import { isExample, resolveExampleFromCache } from "@/exampleResolve";
import { shareHeaderItem } from "@/ui/shareHandle";

// A standalone, read-only view of a resolved handle — opened from Recents by
// tapping a row. Unlike the Search tab it auto-resolves on entry and shows no
// search field or keyboard: just the profile (or a loading / not-found / error
// state), under a plain back header.
export default function HandleView() {
  const router = useRouter();
  const { colors } = useTheme();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const name = (handle ?? "").trim().toLowerCase();

  const [pending, setPending] = useState(true);
  const [result, setResult] = useState<ResolvedHandle | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<"network" | "verify" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [staleAnchor, setStaleAnchor] = useState(false);

  const run = useCallback(async () => {
    if (!name) return;
    setError(null);
    setNotFound(false);
    setResult(null);
    setPending(true);
    try {
      // Demo (@example) handles are local-only — resolve them from the cache, not
      // the network (the real relays have no @example space, which would read as
      // "not registered" here, e.g. when reopened from Recents).
      const resolved = isExample(name)
        ? await resolveExampleFromCache(name)
        : await resolveHandle(name);
      if (resolved) {
        setResult(resolved);
        void recordResolve({
          handle: resolved.handle,
          badge: resolved.badge,
          sovereignty: resolved.zone.sovereignty ?? "unknown",
          recordCount: recordCountOf(resolved),
        });
      } else {
        setNotFound(true);
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const network =
        /no peers|http error|relay error|network|timed out|fetch|econn/.test(raw.toLowerCase());
      setError(network ? "network" : "verify");
      setErrorMsg(verifyErrorMessage(e));
      setStaleAnchor(isStaleAnchorError(e));
    } finally {
      setPending(false);
    }
  }, [name]);

  useEffect(() => {
    void run();
  }, [run]);

  // Stale-anchor recovery: re-pin the semi-trusted anchor to the tip, then retry.
  const refreshAndRetry = async () => {
    await refreshSemiTrust().catch(() => {});
    void run();
  };

  // Handle shown big under the avatar, so the bar carries no title. Once a handle
  // resolves, offer a Share button (its universal link) in the top-right.
  const screen = (
    <Stack.Screen
      options={{
        title: "",
        unstable_headerRightItems: () =>
          result ? [shareHeaderItem(result.handle)] : [],
      }}
    />
  );

  // Result → the native @expo/ui view, which is its own scroll container (fills
  // the screen directly, not inside the RN Layout ScrollView). Header + native
  // Form now share the theme background (see theme.ts — dark bg matches iOS's
  // grouped background), so no seam and no per-screen override needed.
  if (!pending && result) {
    return (
      <>
        {screen}
        <ResolvedProfileNative result={result} />
      </>
    );
  }

  // Loading / not-found / error → native centered states.
  return (
    <>
      {screen}
      {pending && <NativeEmpty sf="magnifyingglass" title="Resolving…" />}
      {!pending && notFound && (
        <NativeEmpty
          sf="questionmark.circle"
          title={name}
          message="Not registered, or no records published yet."
          primary={{
            label: "Buy this handle",
            onPress: () =>
              router.push({ pathname: "/(main)/(tabs)/handles/shop", params: { prefill: name } }),
          }}
        />
      )}
      {!pending && error === "network" && (
        <NativeEmpty
          sf="wifi.slash"
          title="Couldn’t reach any relay"
          message="We can’t tell if it exists — not the same as “not found”."
          primary={{ label: "Try again", onPress: run }}
          secondary={{ label: "Relay settings", onPress: () => router.push("/(main)/trust") }}
        />
      )}
      {!pending && error === "verify" && (
        <NativeEmpty
          sf="exclamationmark.shield.fill"
          iconColor={colors.accent}
          title={name || "This handle"}
          message={errorMsg ?? "Couldn’t verify against a trust anchor, so records are hidden."}
          primary={
            staleAnchor
              ? { label: "Refresh & try again", onPress: refreshAndRetry }
              : { label: "Try again", onPress: run }
          }
          secondary={{ label: "Trust settings", onPress: () => router.push("/(main)/trust") }}
        />
      )}
    </>
  );
}
