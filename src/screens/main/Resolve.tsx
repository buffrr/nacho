import React, { useState, useEffect, useCallback, useRef } from "react";
import { Keyboard } from "react-native";
import {
  Stack,
  useLocalSearchParams,
  useRouter,
  useFocusEffect,
} from "expo-router";
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
import { ShopResults } from "@/ui/shopResults";
import { isExample, resolveExampleFromCache } from "@/exampleResolve";

export default function Resolve() {
  const { colors } = useTheme();
  const router = useRouter();

  const [handle, setHandle] = useState("");
  const [pending, setPending] = useState<string | null>(null); // name being resolved
  const [result, setResult] = useState<ResolvedHandle | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [error, setError] = useState<"network" | "verify" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [staleAnchor, setStaleAnchor] = useState(false);
  // Shop results are only shown after the user submits a non-"@" query (not live
  // while typing). Cleared on every keystroke; set on the search-button press.
  const [shopQuery, setShopQuery] = useState<string | null>(null);

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
    // Drop the keyboard on submit. Blurring the native search bar (not just
    // Keyboard.dismiss, which doesn't reliably resign the search field's focus)
    // returns it to the header, so the terminal-state ActionFooter isn't hidden
    // behind the floating search field.
    searchRef.current?.blur();
    Keyboard.dismiss();
    setError(null);
    setNotFound(null);
    setResult(null);
    setPending(name);
    try {
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
        // The relays answered and there was nothing to return. We do NOT auto-
        // check the shop — that would leak every lookup to the central server.
        setNotFound(name);
      }
    } catch (e) {
      // Distinguish "no relay answered" from "answered but failed to verify" by
      // the error text; a non-existent space stays in the verify bucket rather
      // than being mislabelled not-found (which would hide real tampering).
      const raw = e instanceof Error ? e.message : String(e);
      const network =
        /no peers|http error|relay error|network|timed out|fetch|econn/.test(raw.toLowerCase());
      setError(network ? "network" : "verify");
      setErrorMsg(verifyErrorMessage(e));
      setStaleAnchor(isStaleAnchorError(e));
    } finally {
      setPending(null);
    }
  };

  // Pull-to-refresh on the result profile: re-resolve WITHOUT clearing the
  // current result first, so the profile stays visible under the native refresh
  // spinner and only swaps on completion. A failed refresh is surfaced (flips to
  // the error/not-found state) rather than swallowed.
  const refreshResult = async () => {
    const name = result?.handle;
    if (!name) return;
    try {
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
        setResult(null);
        setNotFound(name);
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const network =
        /no peers|http error|relay error|network|timed out|fetch|econn/.test(raw.toLowerCase());
      setResult(null);
      setError(network ? "network" : "verify");
      setErrorMsg(verifyErrorMessage(e));
      setStaleAnchor(isStaleAnchorError(e));
    }
  };

  // Search submitted (Search/Done key). A handle ("@") resolves; anything else is
  // a name to shop for — only THEN do we show shop results (never live-as-typed).
  const onSubmit = (text: string) => {
    const name = text.trim().toLowerCase();
    if (name.includes("@")) {
      setShopQuery(null);
      onResolve(name);
    } else if (name.length > 0) {
      setResult(null);
      setNotFound(null);
      setError(null);
      searchRef.current?.blur();
      Keyboard.dismiss();
      setShopQuery(name);
    }
  };

  // Stale-anchor recovery: re-pin the semi-trusted anchor to the current tip,
  // then resolve again.
  const refreshAndRetry = async () => {
    await refreshSemiTrust().catch(() => {});
    onResolve(handle);
  };

  // Arriving via a scan (prefill) shows a result, not a text field — suppress the
  // focus effect's auto-focus so the keyboard never opens on that path.
  const suppressFocus = useRef(false);
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  useEffect(() => {
    if (prefill) {
      suppressFocus.current = true;
      setHandle(prefill);
      onResolve(prefill);
      // Consume the param. Expo Router dedupes identical param values, so if we
      // leave prefill set, scanning the SAME handle again is a no-op (the effect
      // won't re-fire) and the page is left empty. Resetting it makes every scan
      // a fresh undefined→value transition that re-triggers resolution.
      router.setParams({ prefill: undefined });
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
      // The prefill effect runs synchronously on focus/mount, so by the time this
      // timeout fires suppressFocus is already set for the scan path → skip focus.
      const t = setTimeout(() => {
        if (!suppressFocus.current) searchRef.current?.focus();
        suppressFocus.current = false;
      }, 60);
      return () => clearTimeout(t);
    }, []),
  );

  // Any non-idle phase means a resolve is underway or done (typed-and-submitted
  // OR arrived via a scan prefill, where the focus effect opened the keyboard) —
  // drop it. Only the idle/typing state keeps the keyboard up.
  useEffect(() => {
    if (phase !== "idle") {
      searchRef.current?.blur();
      Keyboard.dismiss();
    }
  }, [phase]);

  const searchScreen = (
    <Stack.Screen
      options={{
        headerSearchBarOptions: {
          ref: searchRef,
          // No autoFocus: it re-fires on every re-render (e.g. entering the
          // not-found/result state) and re-opens the keyboard right after we
          // dismiss it. The focus effect below handles the initial focus instead.
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
            // Hide shop results as soon as the query is edited — they only show
            // after an explicit submit.
            setShopQuery(null);
            if (!t) setResult(null);
          },
          onSearchButtonPress: (e) => onSubmit(e.nativeEvent.text),
          onCancelButtonPress: () => {
            // Just clear the search — don't auto-navigate to Handles (it felt
            // laggy). The user can tab back if they want.
            setHandle("");
            setError(null);
            setNotFound(null);
            setResult(null);
            setShopQuery(null);
          },
        },
      }}
    />
  );

  // Shop results show only after an explicit submit of a non-"@" query (never
  // live as the user types). Handles (with "@") go through the resolve phases.
  if (shopQuery) {
    return (
      <>
        {searchScreen}
        <ShopResults
          query={shopQuery}
          onBuy={(h) => router.push({ pathname: "/(main)/(tabs)/resolve/show-handle", params: { handle: h } })}
          onOpen={(h) => router.push({ pathname: "/(main)/(tabs)/resolve/view-handle", params: { handle: h } })}
        />
      </>
    );
  }

  // Result → the native @expo/ui profile (its own scroll container).
  if (phase === "result" && result) {
    return (
      <>
        {searchScreen}
        <ResolvedProfileNative result={result} onRefresh={refreshResult} />
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
          message="Try grace@key, or a name to buy."
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
          message={errorMsg ?? "Couldn’t verify against a trust anchor, so records are hidden."}
          primary={
            staleAnchor
              ? { label: "Refresh & try again", onPress: refreshAndRetry }
              : { label: "Try again", onPress: () => onResolve(handle) }
          }
          secondary={{ label: "Trust settings", onPress: () => router.push("/(main)/trust") }}
        />
      )}
    </>
  );
}