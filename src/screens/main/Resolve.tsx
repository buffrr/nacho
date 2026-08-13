import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Stack,
  useLocalSearchParams,
  useRouter,
  useFocusEffect,
} from "expo-router";
import { useTheme } from "@/theme";
import { resolveHandle } from "@/fabric";
import { ResolvedHandle } from "@/fabricResolver";
import { recordResolve } from "@/resolveHistory";
import { ResolvedProfileNative, recordCountOf } from "@/ui/handleProfileNative";
import { NativeEmpty } from "@/ui/nativeEmpty";
import { ShopResults } from "@/ui/shopResults";

export default function Resolve() {
  const { colors } = useTheme();
  const router = useRouter();

  const [handle, setHandle] = useState("");
  const [pending, setPending] = useState<string | null>(null); // name being resolved
  const [result, setResult] = useState<ResolvedHandle | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [error, setError] = useState<"network" | "verify" | null>(null);

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
    setPending(name);
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
        // The relays answered and there was nothing to return. We do NOT auto-
        // check the shop — that would leak every lookup to the central server.
        setNotFound(name);
      }
    } catch (e) {
      // Distinguish "no relay answered" from "answered but failed to verify" by
      // the error text; a non-existent space stays in the verify bucket rather
      // than being mislabelled not-found (which would hide real tampering).
      const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
      const network =
        /no peers|http error|relay error|network|timed out|fetch|econn/.test(msg);
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

  useFocusEffect(
    useCallback(() => {
      setError(null);
      setNotFound(null);
      const t = setTimeout(() => searchRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }, []),
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

  // A query without an "@" isn't a handle — treat it as a name to shop for, and
  // show buyable results inline (mirrors the Shop tab). Handles (with "@") go
  // through the resolve phases below.
  const q = handle.trim();
  const shopMode = q.length > 0 && !q.includes("@");
  if (shopMode) {
    return (
      <>
        {searchScreen}
        <ShopResults
          query={q}
          onBuy={(h) => router.push({ pathname: "/(main)/(tabs)/resolve/show-handle", params: { handle: h } })}
        />
      </>
    );
  }

  // Result → the native @expo/ui profile (its own scroll container).
  if (phase === "result" && result) {
    return (
      <>
        {searchScreen}
        <ResolvedProfileNative result={result} />
      </>
    );
  }

  return (
    <>
      {searchScreen}

      {phase === "idle" && (
        <NativeEmpty
          sf="at"
          title="Resolve a handle"
          message="Try satoshi@bitcoin, or a name to buy."
        />
      )}

      {phase === "loading" && (
        <NativeEmpty sf="magnifyingglass" title="Resolving…" />
      )}

      {phase === "notfound" && notFound && (
        <NativeEmpty
          sf="questionmark.circle"
          title={notFound}
          message="Not registered, or no records published yet."
          primary={{
            label: "Buy this handle",
            onPress: () =>
              router.push({ pathname: "/(main)/(tabs)/handles/shop", params: { prefill: notFound } }),
          }}
        />
      )}

      {phase === "error" && error === "network" && (
        <NativeEmpty
          sf="wifi.slash"
          title="Couldn’t reach any relay"
          message="We can’t tell if it exists — not the same as “not found”."
          primary={{ label: "Try again", onPress: () => onResolve(handle) }}
          secondary={{ label: "Relay settings", onPress: () => router.push("/(main)/trust") }}
        />
      )}

      {phase === "error" && error === "verify" && (
        <NativeEmpty
          sf="exclamationmark.shield.fill"
          iconColor={colors.accent}
          title={handle || "This handle"}
          message="Couldn’t verify against a trust anchor, so records are hidden."
          primary={{ label: "Try again", onPress: () => onResolve(handle) }}
          secondary={{ label: "Trust settings", onPress: () => router.push("/(main)/trust") }}
        />
      )}
    </>
  );
}