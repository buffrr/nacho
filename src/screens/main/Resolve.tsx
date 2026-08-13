import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  Stack,
  useLocalSearchParams,
  useRouter,
  useFocusEffect,
} from "expo-router";
import { Colors, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { AtSign } from "@/ui/icons";
import { resolveHandle } from "@/fabric";
import { ResolvedHandle } from "@/fabricResolver";
import { recordResolve } from "@/resolveHistory";
import {
  ProfileShell,
  ResolvedProfile,
  NotFoundState,
  NetworkErrorState,
  VerifyErrorState,
  recordCountOf,
} from "@/ui/handleProfile";

export default function Resolve() {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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

  return (
    <Layout tabBarInset underHeader keyboardAware={false}>
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

      {phase === "loading" && pending && <ProfileShell handle={pending} />}

      {phase === "notfound" && notFound && (
        <NotFoundState
          name={notFound}
          onBuy={() =>
            router.push({ pathname: "/(main)/shop", params: { prefill: notFound } })
          }
        />
      )}

      {phase === "error" && error === "network" && (
        <NetworkErrorState
          handle={handle}
          onRetry={() => onResolve(handle)}
          onRelaySettings={() => router.push("/(main)/trust")}
        />
      )}

      {phase === "error" && error === "verify" && (
        <VerifyErrorState
          handle={handle}
          onRetry={() => onResolve(handle)}
          onTrustSettings={() => router.push("/(main)/trust")}
        />
      )}

      {phase === "result" && result && <ResolvedProfile result={result} />}
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    centerState: { alignItems: "center", paddingTop: 48, paddingHorizontal: 8 },
    bigIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      borderCurve: "continuous",
      backgroundColor: c.surfaceSunken,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    centerTitle: { fontSize: 19, fontWeight: "600", color: c.text },
    centerSub: {
      fontSize: 14,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      marginTop: 8,
      maxWidth: 300,
    },
    mono: { fontFamily: "monospace", color: c.textSecondary },
  });
