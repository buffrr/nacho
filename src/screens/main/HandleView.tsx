import React, { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Layout } from "@/ui/Layout";
import { resolveHandle } from "@/fabric";
import { ResolvedHandle } from "@/fabricResolver";
import { recordResolve } from "@/resolveHistory";
import {
  ProfileShell,
  NotFoundState,
  NetworkErrorState,
  VerifyErrorState,
  recordCountOf,
} from "@/ui/handleProfile";
import { ResolvedProfileNative } from "@/ui/handleProfileNative";

// A standalone, read-only view of a resolved handle — opened from Recents by
// tapping a row. Unlike the Search tab it auto-resolves on entry and shows no
// search field or keyboard: just the profile (or a loading / not-found / error
// state), under a plain back header.
export default function HandleView() {
  const router = useRouter();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const name = (handle ?? "").trim().toLowerCase();

  const [pending, setPending] = useState(true);
  const [result, setResult] = useState<ResolvedHandle | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<"network" | "verify" | null>(null);

  const run = useCallback(async () => {
    if (!name) return;
    setError(null);
    setNotFound(false);
    setResult(null);
    setPending(true);
    try {
      const resolved = await resolveHandle(name);
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
      const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
      const network =
        /no peers|http error|relay error|network|timed out|fetch|econn/.test(msg);
      setError(network ? "network" : "verify");
    } finally {
      setPending(false);
    }
  }, [name]);

  useEffect(() => {
    void run();
  }, [run]);

  // Handle shown big under the avatar, so the bar carries no title.
  const screen = <Stack.Screen options={{ title: "" }} />;

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

  // Loading / not-found / error stay on the RN states inside Layout.
  return (
    <Layout underHeader>
      {screen}
      {pending && <ProfileShell handle={name} />}
      {!pending && notFound && (
        <NotFoundState
          name={name}
          onBuy={() =>
            router.push({ pathname: "/(main)/shop", params: { prefill: name } })
          }
        />
      )}
      {!pending && error === "network" && (
        <NetworkErrorState
          handle={name}
          onRetry={run}
          onRelaySettings={() => router.push("/(main)/trust")}
        />
      )}
      {!pending && error === "verify" && (
        <VerifyErrorState
          handle={name}
          onRetry={run}
          onTrustSettings={() => router.push("/(main)/trust")}
        />
      )}
    </Layout>
  );
}
