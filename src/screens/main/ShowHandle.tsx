import React, { useState, useEffect, useMemo } from "react";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  Redirect,
  Stack,
} from "expo-router";
import type {
  NativeStackHeaderItem,
  NativeStackHeaderItemMenuAction,
} from "@react-navigation/native-stack";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useStore } from "@/Store";
import { pubkeyForHandle, p2trScriptFromPub } from "@/keys";
import { extractCertData } from "@/cert";
import { saveBinary } from "@/file";
import * as Clipboard from "expo-clipboard";
import { saveCert, loadCert, deleteCert } from "@/certStore";
import { useRecordsDraft } from "@/RecordsDraft";
import { editableFromZone } from "@/fabricResolver";
import { handlePill } from "@/handleTile";
import { Avatar } from "@/ui/Avatar";
import { Layout } from "@/ui/Layout";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";
import { Colors, useTheme } from "@/theme";
import {
  resolveHandle,
  resolveHandleFresh,
  exportCert,
  publishRecords,
  refreshSemiTrust,
} from "@/fabric";
import { recordsGet, recordsSet } from "@/db";
import {
  AtSign,
  Copy,
  Pencil,
  Lock,
  Check,
  Anchor,
  ShieldCheck,
  Clock,
  Infinity as InfinityIcon,
} from "@/ui/icons";
import {
  fetchHandleStatus,
  reserveHandle,
  claimHandleIAP,
  checkPurchaseInfo,
  PurchaseSupport,
  formatPrice,
  HandleStatus,
} from "@/api";

type IAPHook = (typeof import("expo-iap"))["useIAP"];
const iap = (() => {
  switch (Platform.OS) {
    case "android":
    case "ios":
      try {
        const hook = require("expo-iap").useIAP as IAPHook;
        return {
          platform:
            Platform.OS === "android"
              ? ("google_iap" as const)
              : ("apple_iap" as const),
          hook,
        };
      } catch (error) {
        console.error("expo-iap not available");
        return null;
      }
    default:
      return null;
  }
})();

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// "just now" / "4s ago" / "3m ago" / "2h ago" for the purchase "Checked …" line.
function agoText(ts: number | null, now: number): string {
  if (!ts) return "just now";
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// The published seq is unix seconds — render it as a date. Legacy small counters
// fall back to a plain version number.
function formatSeq(seq: number): string {
  if (seq > 1_000_000_000) {
    const d = new Date(seq * 1000);
    return `Updated ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }
  return `Version ${seq}`;
}

// Don't re-resolve a handle on focus if we resolved it within this window.
const RESOLVE_THROTTLE_MS = 2 * 60 * 1000;

export default function ShowHandle() {
  const router = useRouter();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const {
    xpub,
    handles,
    createHandle,
    nextHandleData,
    removeHandle,
    setHandleCertData,
    setHandleResolution,
    setCertRef,
    setHandleOnboarded,
    setHandlePurchase,
    getSigningKey,
  } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const {
    ensureLoaded,
    applyResolved,
    getRecords,
    getSeq,
    setSeq,
    isDirty,
    markClean,
  } = useRecordsDraft();
  const [error, setError] = useState<string | null>(null);
  const [handleStatusString, setHandleStatusString] = useState<
    HandleStatus["status"] | null
  >(null);
  const [isScriptPubkeyValid, setIsScriptPubkeyValid] = useState<
    boolean | null
  >(null);
  const [purchaseSupport, setPurchaseSupport] =
    useState<PurchaseSupport>("unknown");
  const [price, setPrice] = useState<number | null>(null);
  const [resolving, setResolving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // In-flight purchase (drives the button spinner) — kept separate from the
  // handle's server status so tapping Buy doesn't flip the pill to "Pending
  // inclusion" before anything is actually reserved/paid.
  const [purchasing, setPurchasing] = useState(false);
  const [published, setPublished] = useState(false);
  const [numId, setNumId] = useState<string | null>(null);
  // Alias is published by the operator and read from fabric resolution — it is
  // not something the user edits here.
  const [alias, setAlias] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [now, setNow] = useState(Date.now());
  // Whether we've ever seen this handle resolve. Once true, a transient miss
  // (e.g. records still propagating right after publishing) won't revert the UI
  // to the "waiting for records" state.
  const foundRef = React.useRef<boolean>(
    !!handles?.[handle]?.resolution?.found,
  );
  // Always-latest refreshResolution, so the onboarding poll's setInterval doesn't
  // call a stale closure (which would write stale handle data and drop certRef,
  // flapping between "issuing" and "ready" every tick).
  const refreshRef = React.useRef<(fresh?: boolean) => void>(() => {});

  // A handle reached from Shop ("Buy") isn't in the keystore yet — we show it in
  // a prospective state using the next derivation we *would* use, and only
  // persist it once the purchase is actually reserved (see handleBuyHandle).
  const persisted = handles?.[handle];
  const handleData = persisted ?? nextHandleData();
  const isProspective = !persisted;

  if (!xpub || !handleData) {
    return <Redirect href="/(main)/(tabs)/handles" />;
  }

  const pubkey = pubkeyForHandle(xpub, handleData);
  const script_pubkey = p2trScriptFromPub(pubkey);
  const cert = handleData.cert;

  const { requestPurchase, finishTransaction } = iap
    ? iap.hook({
        onPurchaseSuccess: async (purchase) => {
          if (__DEV__) console.log("[nacho/iap] onPurchaseSuccess");
          if (!purchase.purchaseToken) {
            setError("No purchase token received");
            setPurchasing(false);
            return;
          }
          const result = await claimHandleIAP(
            handle,
            script_pubkey,
            purchase.purchaseToken,
            iap.platform,
          );
          if (result.error) {
            setError(result.error);
            fetchAndUpdateHandleStatus();
          } else {
            await applyHandleStatus(result.handle_status);
            if (result.handle_status.status === "taken") {
              await finishTransaction({
                purchase,
                isConsumable: true,
              });
            }
            // The /claim status can be minimal (no script_pubkey), which leaves
            // the handle looking "Not registered". finalizePurchase re-fetches
            // the full status, pins the anchor, records the purchase, and resets
            // Back → Your handles.
            await finalizePurchase();
          }
          setPurchasing(false);
        },
        onPurchaseError: (error) => {
          if (__DEV__)
            console.log("[nacho/iap] onPurchaseError:", error.code, error.message);
          if (error.code !== "user-cancelled") {
            setError("Purchase failed: " + error.message);
          }
          setPurchasing(false);
        },
      })
    : ({
        requestPurchase: async () => {
          const result = await claimHandleIAP(
            handle,
            script_pubkey,
            `test_valid_purchase_${Date.now().toString()}${Math.random().toString(36).slice(1)}`,
            "test",
          );
          if (result.error) {
            setError(result.error);
            fetchAndUpdateHandleStatus();
          } else {
            await applyHandleStatus(result.handle_status);
            await finalizePurchase();
          }
          return null;
        },
        finishTransaction: async () => {},
      } as Pick<
        ReturnType<IAPHook>,
        "requestPurchase" | "finishTransaction"
      >);

  useFocusEffect(
    React.useCallback(() => {
      // The nacho purchase API only matters until the handle has its certificate.
      // Once we hold the cert, its job is done — the handle lives on the
      // decentralized network, so we only resolve (below) and never poll the
      // server again. This also means a server outage can't mislabel an
      // established handle as "not available to buy".
      const hasCertYet = !!handleData.certRef || !!handleData.cert;
      if (!hasCertYet) {
        fetchAndUpdateHandleStatus();
        checkPurchaseInfo(handle).then((info) => {
          setPurchaseSupport(info.support);
          setPrice(info.price ?? null);
        });
      }
      // Throttle the (decentralized) re-resolve on focus: skip if we resolved
      // this handle recently, so navigating back and forth doesn't re-hit the
      // network every time. Onboarding has its own fast poll (below), unaffected.
      const lastResolved = handleData.resolution?.updatedAt ?? 0;
      if (Date.now() - lastResolved > RESOLVE_THROTTLE_MS) {
        refreshResolution();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handle, handleData.certRef, handleData.cert]),
  );

  useEffect(() => {
    if (
      handleStatusString === "reserved" ||
      handleStatusString === "processing_payment"
    ) {
      const interval = setInterval(() => {
        fetchAndUpdateHandleStatus();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [handleStatusString]);

  // Keep the "Checked … ago" line fresh on the purchase view.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  // Seed records from the local cache the moment the screen opens, so they show
  // instantly (before the network resolve returns and calls applyResolved).
  useEffect(() => {
    let active = true;
    recordsGet(handle).then((json) => {
      if (!active || !json) return;
      try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed.records)) {
          ensureLoaded(handle, parsed.records, parsed.seq ?? 0);
        }
      } catch {
        // ignore malformed cache
      }
    });
    return () => {
      active = false;
    };
  }, [handle, ensureLoaded]);

  const fetchAndUpdateHandleStatus = async () => {
    const status = await fetchHandleStatus(handle);
    await applyHandleStatus(status);
    setCheckedAt(Date.now());
    setNow(Date.now());
  };

  // Runs once a nacho purchase succeeds: record the purchase (so we show the
  // reassuring "Purchase complete" state, not the plain "waiting for cert"),
  // pin the latest anchor, then reset the stack so Back lands on Your handles
  // rather than the Shop/search screen this was pushed from.
  const finalizePurchase = async () => {
    await fetchAndUpdateHandleStatus();
    // The purchase advanced the chain, so pin the latest anchor before resolving
    // — otherwise the just-bought handle is newer than the pinned anchor.
    await refreshSemiTrust();
    await setHandlePurchase(handle, price !== null ? { amountCents: price } : {});
    // Rebuild the stack as [handles tab, this handle] so Back lands on Your
    // handles (not the Shop/Redeem screen this was pushed from). Expo Router has
    // no `reset`; dismiss the detail stack, switch to the handles tab, re-push.
    if (router.canDismiss()) router.dismissAll();
    router.navigate("/(main)/(tabs)/handles");
    router.push({ pathname: "/(main)/show-handle", params: { handle } });
  };

  // `fresh` uses a throwaway Fabric client so the SDK's zone cache can't return
  // stale data — used by the onboarding poll to catch the cert / sovereignty.
  const refreshResolution = async (fresh = false) => {
    setResolving(true);
    try {
      const resolved = fresh
        ? await resolveHandleFresh(handle)
        : await resolveHandle(handle);
      if (!resolved) {
        // Don't downgrade a handle we've already seen resolve — the records are
        // likely just still propagating (e.g. right after publishing). Keep the
        // last-known good state instead of flashing "waiting for records".
        if (!foundRef.current) {
          await setHandleResolution(handle, {
            found: false,
            updatedAt: Date.now(),
          });
          setAlias(null);
        }
        return;
      }
      foundRef.current = true;
      const sovereignty = resolved.zone.sovereignty ?? "unknown";
      await setHandleResolution(handle, {
        found: true,
        sovereignty,
        scriptPubkey: resolved.zone.script_pubkey,
        updatedAt: Date.now(),
      });
      setNumId(resolved.zone.num_id ?? null);
      setAlias(resolved.zone.alias ?? null);

      // Capture/refresh the certificate when it's ours. Re-export only when the
      // sovereignty advances (e.g. dependent → sovereign) or we don't have it.
      const mine = resolved.zone.script_pubkey === script_pubkey;
      if (mine) {
        const { records, seq } = editableFromZone(resolved.zone);
        if (__DEV__)
          console.log(
            "[nacho/records] resolved seq=" + seq + " count=" + records.length,
          );
        // Fresh network data wins over the cache-seeded draft, but applyResolved
        // ignores it if the user has unsaved edits or it's older than our local
        // seq (stale/empty resolve right after publishing).
        applyResolved(handle, records, seq);
        // Only cache when the relay actually has records, so an empty/stale zone
        // doesn't overwrite the cache of what we just published.
        if (seq > 0) {
          recordsSet(handle, JSON.stringify({ records, seq }), Date.now());
        }
      }
      const ref = handleData.certRef;
      if (mine && (!ref || ref.sovereignty !== sovereignty)) {
        try {
          const bytes = await exportCert(handle);
          await saveCert(handle, bytes);
          await setCertRef(handle, { savedAt: Date.now(), sovereignty });
        } catch (e) {
          // certrelay/export failure — keep any previously stored cert
        }
      }
    } catch (e) {
      // leave the previous resolution in place on failure
    } finally {
      setResolving(false);
    }
  };
  refreshRef.current = refreshResolution;

  const handleImportCertificate = () => {
    router.push({ pathname: "/(main)/import-certificate", params: { handle } });
  };

  const handleExportCertificate = async () => {
    const bytes = await loadCert(handle);
    if (bytes) {
      // saveBinary opens the native share sheet on iOS/Android (save to Files,
      // send via an app, …) and downloads the file on web.
      await saveBinary(`${handle}.spacecert`, bytes);
    }
  };

  const applyHandleStatus = async (status: HandleStatus) => {
    setHandleStatusString(status.status);
    if ("script_pubkey" in status) {
      if (status.script_pubkey === script_pubkey) {
        setIsScriptPubkeyValid(true);
        if ("certificate" in status) {
          const certData = extractCertData(status.certificate);
          await setHandleCertData(handle, certData);
        }
      } else {
        setIsScriptPubkeyValid(false);
      }
    } else {
      setIsScriptPubkeyValid(null);
    }
  };

  const handleRemoveHandle = async () => {
    await deleteCert(handle);
    await removeHandle(handle);
    router.replace("/(main)/(tabs)/handles");
  };

  // Native confirm (Alert) for the destructive remove — replaces the old
  // in-sheet two-step confirm.
  const confirmRemoveHandle = () => {
    Alert.alert(
      "Remove handle?",
      `This only removes ${handle} from this keystore. Your seed phrase can re-derive it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove handle",
          style: "destructive",
          onPress: handleRemoveHandle,
        },
      ],
    );
  };

  const handleCopyRequest = async () => {
    await Clipboard.setStringAsync(
      JSON.stringify({ handle, script_pubkey }, null, 2),
    );
    setNotice("Request copied to clipboard.");
    setTimeout(() => setNotice(null), 2000);
  };

  const signAndPublish = async () => {
    setError(null);
    setPublished(false);
    setPublishing(true);
    try {
      const secretKey = await getSigningKey(handle);
      if (!secretKey) {
        throw new Error("No private key available for this handle.");
      }
      let cert = await loadCert(handle);
      if (!cert) {
        cert = await exportCert(handle);
        await saveCert(handle, cert);
      }
      // Use unix seconds as the sequence: always increases, no need to read the
      // previous value.
      const seq = Math.floor(Date.now() / 1000);
      const publishedRecords = getRecords(handle);
      if (__DEV__)
        console.log(
          "[nacho/records] publishing seq=" +
            seq +
            " count=" +
            publishedRecords.length,
        );
      await publishRecords(cert, publishedRecords, seq, secretKey);
      if (__DEV__) console.log("[nacho/records] publish() resolved (no throw)");
      // Keep the just-published records on screen and bump the version — don't
      // clear the draft (which would flash empty/"waiting" until it re-resolves).
      setSeq(handle, seq);
      markClean(handle);
      // Update the cache with what we just published so it's current on reopen
      // even before the network reflects it.
      recordsSet(handle, JSON.stringify({ records: publishedRecords, seq }), Date.now());
      foundRef.current = true;
      setPublished(true);
      refreshResolution();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish records.");
    } finally {
      setPublishing(false);
    }
  };

  const copy = (text: string) => {
    Clipboard.setStringAsync(text);
  };

  const handleBuyHandle = async () => {
    setError(null);
    setPurchasing(true);
    const result = await reserveHandle(handle, script_pubkey);
    if ("error" in result) {
      setError(result.error);
      setPurchasing(false);
      if (!isProspective) fetchAndUpdateHandleStatus();
      return;
    }

    // The reservation succeeded under our next-derived key, so commit the handle
    // to the keystore now (not on mere navigation from Shop).
    if (isProspective) {
      await createHandle(handle);
    }

    // The purchase outcome arrives via the useIAP onPurchaseSuccess/onPurchaseError
    // callbacks; this try only catches a failure to *start* the flow. A user
    // cancel isn't an error worth surfacing.
    try {
      await requestPurchase({
        request: {
          apple: { sku: result.product_id },
          google: { skus: [result.product_id] },
        },
        type: "in-app",
      });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const msg = err instanceof Error ? err.message : String(err);
      if (__DEV__) console.log("[nacho/iap] requestPurchase threw:", code, msg);
      if (code !== "user-cancelled" && !/cancel/i.test(msg)) {
        setError("Failed purchase: " + msg);
      }
      setPurchasing(false);
    }
  };

  const isProcessingPurchase =
    isScriptPubkeyValid === true &&
    (handleStatusString === "reserved" ||
      handleStatusString === "processing_payment");

  const ownedByOther =
    isScriptPubkeyValid === false &&
    (handleStatusString === "taken" ||
      handleStatusString === "reserved" ||
      handleStatusString === "processing_payment");

  const renderActions = () => {
    if (keyMismatch) {
      return (
        <Button
          text="Import Private Key"
          onPress={replaceWithImport}
          type="main"
        />
      );
    }

    // Owned (live records, or awaiting the cert) — handled inline in the body.
    if (owned) {
      return null;
    }

    if (ownedByOther) {
      return null;
    }

    if (isProcessingPurchase) {
      return <Button text="Processing…" onPress={() => {}} type="main" disabled />;
    }

    // Not purchasable here — this handle goes to an operator. The request is the
    // primary action; its certificate will resolve from certrelay once issued.
    if (purchaseSupport === "unsupported") {
      return (
        <Button text="Copy request" onPress={handleCopyRequest} type="main" />
      );
    }

    if (handleStatusString === "available") {
      return (
        <>
          <Button
            text={
              price !== null
                ? `Buy Handle · ${formatPrice(price)}`
                : "Buy Handle"
            }
            onPress={handleBuyHandle}
            type="main"
          />
          <Button
            text="Copy request"
            onPress={handleCopyRequest}
            type="secondary"
          />
        </>
      );
    }

    // taken/registered by us (cert pending), or not-yet-registered. Importing a
    // certificate lives in the ⋮ menu now.
    return (
      <Button text="Copy request" onPress={handleCopyRequest} type="main" />
    );
  };

  const resolution = handleData.resolution;
  // The handle is live on certrelay under a key that isn't ours — we can't sign
  // for it, so the user must import that key's private key instead.
  const keyMismatch = !!(
    resolution?.found &&
    resolution.scriptPubkey &&
    resolution.scriptPubkey !== script_pubkey
  );
  // We hold the key for this handle when it's an imported keypair, when the
  // on-chain key matches ours, or when it resolves to us on certrelay. Owned
  // handles never go through the buy/request flow.
  const isImported = handleData.source === "imported";
  const resolvable = !!resolution?.found && !keyMismatch;
  const owned = resolvable || isImported || isScriptPubkeyValid === true;
  // We've already grabbed + stored this handle's certificate.
  const hasCert = !!handleData.certRef || !!cert;
  // Once we hold the cert we can show + manage records regardless of a flapping
  // live resolution (e.g. the semi-trusted anchor lagging the handle's block),
  // so the view doesn't bounce back to "waiting for certificate".
  const manageable = !keyMismatch && (resolvable || (owned && hasCert));
  // The handle is actually PAID for (not merely reserved) once it's taken on the
  // server, resolves on certrelay, we hold its cert, or it's an imported keypair.
  // A reservation the user never paid for (status "reserved"/"processing_payment")
  // does NOT count — so it never shows the issuing/waiting/onboarding states.
  const isPaid =
    resolvable ||
    hasCert ||
    isImported ||
    handleStatusString === "taken" ||
    // A recorded nacho purchase means it's paid even if the server is unreachable
    // or resolution is lagging — so it shows issuing/waiting, not buy/unsupported.
    !!handleData.purchase;
  // "Waiting for the certificate to appear" only applies to a PAID handle that
  // doesn't have its cert yet (never a reserved/unpaid one).
  const awaitingCert = isPaid && !keyMismatch && !hasCert;
  // The handle's current sovereignty — live resolution if we have it, else the
  // sovereignty captured when we stored the cert.
  const sovereignty =
    (resolution?.found ? resolution.sovereignty : undefined) ??
    handleData.certRef?.sovereignty ??
    null;
  const isSovereign = sovereignty === "sovereign";
  // Post-purchase onboarding: a freshly PAID handle (onboarded === false) walks
  // through issuing → ready-to-use → sovereign before dropping into the normal
  // editor. Reserved/unpaid handles and pre-existing ones skip it.
  const showOnboarding =
    isPaid && !keyMismatch && handleData.onboarded === false;
  const onboardStage: "issuing" | "ready" | "sovereign" = !hasCert
    ? "issuing"
    : isSovereign
      ? "sovereign"
      : "ready";

  // While the onboarding states show, poll resolution so the cert appearing
  // (then the sovereign upgrade) advances the state without user action.
  useEffect(() => {
    if (!showOnboarding) return;
    const id = setInterval(() => refreshRef.current(true), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOnboarding]);

  // Directly purchasable here → show the dedicated claim/purchase view.
  const buyable =
    !owned &&
    !keyMismatch &&
    !ownedByOther &&
    handleStatusString === "available";
  const pill = handlePill(colors, {
    resolution,
    keyMismatch,
    hasCert: !!handleData.certRef || !!cert,
    status: handleStatusString,
    scriptMatches: isScriptPubkeyValid,
  });

  const replaceWithImport = async () => {
    await removeHandle(handle);
    router.replace({ pathname: "/(main)/import-keypair", params: { handle } });
  };

  const records = getRecords(handle);
  const seq = getSeq(handle);

  const detailRow = (label: string, value: string, onCopy: () => void) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValueWrap}>
        <Text style={styles.rowValue}>{value}</Text>
        <TouchableOpacity onPress={onCopy} hitSlop={6}>
          <Copy size={16} color={colors.iconDefault} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const recordRow = (
    chip: string,
    title: string,
    opts?: { sub?: string; onPress?: () => void },
  ) => {
    const body = (
      <View style={styles.recRow}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{chip}</Text>
        </View>
        <View style={styles.recMid}>
          <Text style={styles.recTitle}>{title}</Text>
          {opts?.sub ? (
            <Text style={styles.recSub} numberOfLines={1}>
              {opts.sub}
            </Text>
          ) : null}
        </View>
        {opts?.onPress ? (
          <Pencil size={16} color={colors.iconDefault} />
        ) : (
          <Lock size={16} color={colors.iconDefault} />
        )}
      </View>
    );
    return opts?.onPress ? (
      <TouchableOpacity onPress={opts.onPress}>{body}</TouchableOpacity>
    ) : (
      body
    );
  };


  const dismissOnboarding = () => setHandleOnboarded(handle, true);

  // Bought through nacho's IAP → show the reassuring "Purchase complete /
  // issuing certificate" state; handles registered elsewhere fall back to the
  // plain "Waiting for certificate" note.
  const boughtViaNacho = !!handleData.purchase;

  // Post-purchase status card: issuing → ready-to-use → sovereign (see img_10).
  const renderOnboarding = () => (
    <View style={styles.onboard}>
      {onboardStage === "issuing" ? (
        boughtViaNacho ? (
          <View
            style={[styles.onboardIcon, { backgroundColor: colors.statusGreenBg }]}
          >
            <Check size={34} color={colors.statusGreenFg} />
          </View>
        ) : (
          <View
            style={[styles.onboardIcon, { backgroundColor: colors.statusGreyBg }]}
          >
            <Clock size={30} color={colors.statusGreyFg} strokeWidth={2} />
          </View>
        )
      ) : onboardStage === "ready" ? (
        <View style={[styles.onboardIcon, { backgroundColor: colors.statusGreenBg }]}>
          <Check size={34} color={colors.statusGreenFg} />
        </View>
      ) : (
        <View style={[styles.onboardIcon, { backgroundColor: colors.statusBlueBg }]}>
          <ShieldCheck size={30} color={colors.statusBlueFg} />
        </View>
      )}

      <Text style={styles.onboardName} numberOfLines={1}>
        {handle}
      </Text>

      {onboardStage === "issuing" ? (
        boughtViaNacho ? (
          <>
            <Text style={[styles.onboardStatus, { color: colors.statusGreenFg }]}>
              is yours
            </Text>
            <View style={styles.onboardCard}>
              <ActivityIndicator size="small" color={colors.accent} />
              <View style={styles.onboardCardText}>
                <Text style={styles.onboardCardTitle}>
                  Issuing your certificate
                </Text>
                <Text style={styles.onboardCardBody}>
                  Usually a few minutes. You'll be able to publish records as soon
                  as it lands.
                </Text>
              </View>
            </View>
            <View style={styles.onboardDetails}>
              {handleData.purchase?.amountCents != null && (
                <View style={styles.onboardDetailRow}>
                  <Text style={styles.onboardDetailLabel}>Paid</Text>
                  <Text style={styles.onboardDetailValue}>
                    {formatPrice(handleData.purchase.amountCents)}
                  </Text>
                </View>
              )}
              <View style={styles.onboardDetailRow}>
                <Text style={styles.onboardDetailLabel}>Bound to</Text>
                <Text style={styles.onboardDetailValue}>
                  {`${pubkey.slice(0, 8)}…${pubkey.slice(-8)}`}
                </Text>
              </View>
              {handleData.purchase?.orderId ? (
                <View style={styles.onboardDetailRow}>
                  <Text style={styles.onboardDetailLabel}>Order</Text>
                  <Text style={styles.onboardDetailValue}>
                    {handleData.purchase.orderId}
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.onboardStatus, { color: colors.textMuted }]}>
              Waiting for certificate
            </Text>
            <View style={styles.onboardCard}>
              <View style={styles.onboardCardText}>
                <Text style={styles.onboardCardBody}>
                  The handle is registered to your key. We'll pull the
                  certificate as soon as a relay has it.
                </Text>
              </View>
            </View>
            <View style={styles.checkedRow}>
              <Text style={styles.checkedText}>
                Last checked {agoText(checkedAt, now)} ·{" "}
              </Text>
              <TouchableOpacity
                onPress={() => refreshResolution()}
                disabled={resolving}
                hitSlop={6}
              >
                <Text style={styles.refreshText}>
                  {resolving ? "…" : "Check now"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )
      ) : onboardStage === "ready" ? (
        <>
          <Text style={[styles.onboardStatus, { color: colors.statusGreenFg }]}>
            Yours — ready to use
          </Text>
          <View style={styles.onboardCard}>
            <Anchor size={18} color={colors.text} />
            <View style={styles.onboardCardText}>
              <Text style={styles.onboardCardTitle}>Anchoring to Bitcoin</Text>
              <Text style={styles.onboardCardBody}>
                Usually within a day. Nothing to do — you can use the handle now.
              </Text>
            </View>
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.onboardStatus, { color: colors.statusBlueFg }]}>
            Sovereign
          </Text>
          <View style={styles.onboardCard}>
            <View style={styles.onboardCardText}>
              <Text style={styles.onboardCardBody}>
                Ownership is proven on-chain and can't be revoked. Back up your
                certificate.
              </Text>
              <TouchableOpacity onPress={handleExportCertificate} hitSlop={6}>
                <Text style={styles.viewProof}>View proof</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </View>
  );

  const renderPurchase = () => (
    <View style={styles.purchase}>
      <Avatar handle={handle} size={64} />
      <Text style={styles.buyName} numberOfLines={1}>
        {handle}
      </Text>
      <View style={styles.availPill}>
        <Check size={14} color={colors.statusGreenFg} />
        <Text style={styles.availText}>Available</Text>
      </View>
      <View style={styles.checkedRow}>
        <Text style={styles.checkedText}>Checked {agoText(checkedAt, now)} · </Text>
        <TouchableOpacity
          onPress={() => {
            refreshResolution();
            fetchAndUpdateHandleStatus();
          }}
          hitSlop={6}
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.featureCard}>
        <View style={styles.featureRow}>
          <InfinityIcon size={20} color={colors.text} />
          <Text style={styles.featureText}>Yours permanently, no renewal</Text>
        </View>
        <View style={styles.featureRow}>
          <Lock size={18} color={colors.text} />
          <Text style={styles.featureText}>Self-custodial, no accounts</Text>
        </View>
      </View>

      <View style={styles.bindsCard}>
        <Text style={styles.bindsLabel}>Binds to</Text>
        <View style={styles.bindsRow}>
          <View style={styles.bindsCol}>
            <Text style={styles.bindsKeystore}>This keystore</Text>
            <Text style={styles.bindsKey}>
              {`${pubkey.slice(0, 8)}…${pubkey.slice(-8)}`}
            </Text>
          </View>
          <TouchableOpacity onPress={() => copy(pubkey)} hitSlop={6}>
            <Copy size={16} color={colors.iconDefault} />
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />
        <Text style={styles.bindsNote}>
          No one can take the handle from you, and no one can restore it for
          you. Remember to back up your certificate once issued and keystore seed.
        </Text>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>One-time price</Text>
        <Text style={styles.priceValue}>
          {price !== null ? formatPrice(price) : "—"}
        </Text>
      </View>
    </View>
  );

  const headerTitle = buyable
    ? "Buy handle"
    : showOnboarding && onboardStage === "issuing" && boughtViaNacho
      ? "Issuing certificate"
      : handle;

  // The ⋯ options as a NATIVE header menu (UIMenu). Only when the handle is
  // owned (not while buying).
  const menuActions: NativeStackHeaderItemMenuAction[] = [
    {
      type: "action",
      label: "Import certificate",
      icon: { type: "sfSymbol", name: "square.and.arrow.down" },
      onPress: handleImportCertificate,
    },
  ];
  if (handleData.certRef) {
    menuActions.push({
      type: "action",
      label: "Export certificate",
      icon: { type: "sfSymbol", name: "square.and.arrow.up" },
      onPress: handleExportCertificate,
    });
  }
  // Handle transactions (user-initiated). Each collects the current outpoint via
  // the manual-entry form (we have no chain view); Cancel uses saved offers.
  menuActions.push({
    type: "action",
    label: "Sell handle",
    icon: { type: "sfSymbol", name: "tag" },
    onPress: () =>
      router.push({ pathname: "/(main)/handle-action", params: { handle, action: "sale" } }),
  });
  menuActions.push({
    type: "action",
    label: "Transfer handle",
    icon: { type: "sfSymbol", name: "arrow.right" },
    onPress: () =>
      router.push({ pathname: "/(main)/handle-action", params: { handle, action: "transfer" } }),
  });
  menuActions.push({
    type: "action",
    label: "Rotate key",
    icon: { type: "sfSymbol", name: "arrow.triangle.2.circlepath" },
    onPress: () =>
      router.push({ pathname: "/(main)/handle-action", params: { handle, action: "rotate" } }),
  });
  menuActions.push({
    type: "action",
    label: "Cancel offers",
    icon: { type: "sfSymbol", name: "xmark.circle" },
    onPress: () =>
      router.push({ pathname: "/(main)/cancel-offers", params: { handle } }),
  });
  menuActions.push({
    type: "action",
    label: "Remove handle",
    icon: { type: "sfSymbol", name: "trash" },
    destructive: true,
    onPress: confirmRemoveHandle,
  });
  const headerItems: NativeStackHeaderItem[] = buyable
    ? []
    : [
        {
          type: "menu",
          label: "Options",
          icon: { type: "sfSymbol", name: "ellipsis" },
          menu: { items: menuActions },
        },
      ];

  return (
    <Layout
      underHeader
      footer={
        buyable ? (
          <>
            <Button
              text={
                purchasing
                  ? "Processing…"
                  : price !== null
                    ? `Buy handle · ${formatPrice(price)}`
                    : "Buy handle"
              }
              onPress={handleBuyHandle}
              type="main"
              disabled={purchasing}
            />
            <TouchableOpacity
              onPress={() => setShowAdvanced((v) => !v)}
              style={styles.advLink}
            >
              <Text style={styles.advText}>Advanced options</Text>
            </TouchableOpacity>
            {showAdvanced && (
              <Button
                text="Copy request"
                onPress={handleCopyRequest}
                type="secondary"
              />
            )}
          </>
        ) : showOnboarding ? (
          // "issuing" has no action — it advances on its own once the cert lands.
          onboardStage === "issuing" ? undefined : (
            <Button
              text={onboardStage === "sovereign" ? "Continue" : "Set up records"}
              onPress={dismissOnboarding}
              type="main"
            />
          )
        ) : manageable ? (
          // Only offer to publish when there are unsaved record edits.
          isDirty(handle) ? (
            <Button
              text={publishing ? "Publishing…" : "Sign and publish"}
              onPress={signAndPublish}
              type="main"
              disabled={publishing}
            />
          ) : undefined
        ) : (
          renderActions()
        )
      }
    >
      <Stack.Screen
        options={{
          title: headerTitle,
          unstable_headerRightItems: () => headerItems,
        }}
      />

      {error && <Message message={error} type="error" />}
      {notice && !error && <Message message={notice} type="success" />}

      {buyable ? (
        renderPurchase()
      ) : showOnboarding ? (
        renderOnboarding()
      ) : (
        <>
      <View style={styles.identity}>
        <Avatar handle={handle} size={48} />
        <View style={styles.idcol}>
          <Text style={styles.name} numberOfLines={1}>
            {handle}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: pill.fg }]} />
            <Text style={styles.statusText}>{pill.label}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => refreshResolution()} disabled={resolving} hitSlop={8}>
          <Text style={styles.refreshText}>{resolving ? "…" : "Refresh"}</Text>
        </TouchableOpacity>
      </View>

      {published && !error && (
        <Message message="Records published to certrelay." type="success" />
      )}

      {keyMismatch && !error && (
        <Message
          message="This handle is registered to a different public key. Import its private key to manage it."
          type="error"
        />
      )}

      {ownedByOther && !error && (
        <Message
          message={
            handleStatusString === "taken"
              ? "This handle is taken by a different public key."
              : "This handle is currently reserved by another user."
          }
          type="error"
        />
      )}

      {!owned &&
        !ownedByOther &&
        !keyMismatch &&
        !error &&
        purchaseSupport === "unsupported" && (
          <Text style={styles.note}>
            This space isn't available to buy here. Copy the request and send it
            to an operator — the certificate will appear once it's issued.
          </Text>
        )}

      <View style={styles.card}>
        {detailRow(
          "Public key",
          `${pubkey.slice(0, 8)}…${pubkey.slice(-8)}`,
          () => copy(pubkey),
        )}
        {numId && (
          <>
            <View style={styles.divider} />
            {detailRow("Num ID", `${numId.slice(0, 8)}…${numId.slice(-6)}`, () =>
              copy(numId),
            )}
          </>
        )}
        {resolvable && (
          <>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Alias</Text>
              <Text
                style={[styles.rowValue, !alias && { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {alias || "Not set"}
              </Text>
            </View>
          </>
        )}
      </View>

      {manageable && (
        <>
          <View style={styles.recordsHead}>
            <Text style={styles.recordsTitle}>Records</Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(main)/edit-record",
                  params: { handle },
                })
              }
            >
              <Text style={styles.addText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            {recordRow("SEQ", formatSeq(seq))}
            {records.map((r, i) => (
              <React.Fragment key={i}>
                <View style={styles.divider} />
                {recordRow(r.type.toUpperCase(), r.key, {
                  sub: r.value.join(", "),
                  onPress: () =>
                    router.push({
                      pathname: "/(main)/edit-record",
                      params: { handle, index: String(i) },
                    }),
                })}
              </React.Fragment>
            ))}
            <View style={styles.divider} />
            {recordRow("SIG", `Signed · ${handle}`)}
          </View>
        </>
      )}

      {awaitingCert && (
        <View style={styles.card}>
          <Text style={styles.waiting}>
            Waiting for your certificate to appear on certrelay. You can add
            records once it's live.
          </Text>
        </View>
      )}
        </>
      )}

    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    topbar: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      marginBottom: 24,
    },
    // ── Post-purchase onboarding states (issuing / ready / sovereign) ──
    onboard: {
      alignItems: "center",
      paddingTop: 24,
    },
    onboardIcon: {
      width: 72,
      height: 72,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
    },
    onboardName: {
      fontSize: 22,
      fontWeight: "700",
      color: c.text,
      marginBottom: 6,
    },
    onboardStatus: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 18,
    },
    onboardText: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 21,
      paddingHorizontal: 20,
      marginTop: 4,
    },
    onboardCard: {
      alignSelf: "stretch",
      flexDirection: "row",
      gap: 12,
      backgroundColor: c.field,
      borderRadius: 14,
      padding: 16,
    },
    onboardCardText: {
      flex: 1,
      gap: 3,
    },
    onboardCardTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: c.text,
    },
    onboardCardBody: {
      fontSize: 14,
      color: c.textSecondary,
      lineHeight: 19,
    },
    viewProof: {
      fontSize: 14,
      fontWeight: "600",
      color: c.accent,
      marginTop: 10,
    },
    onboardDetails: {
      alignSelf: "stretch",
      marginTop: 20,
    },
    onboardDetailRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: c.borderWarm,
    },
    onboardDetailLabel: {
      fontSize: 15,
      color: c.textSecondary,
    },
    onboardDetailValue: {
      fontSize: 15,
      fontWeight: "600",
      color: c.text,
    },
    // ── Purchase / claim view ──
    purchase: {
      alignItems: "center",
    },
    buyAvatar: {
      width: 64,
      height: 64,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
      marginBottom: 16,
    },
    buyName: {
      fontSize: 24,
      fontWeight: "700",
      color: c.text,
      marginBottom: 10,
    },
    availPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: c.statusGreenBg,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    availText: {
      fontSize: 13,
      fontWeight: "600",
      color: c.statusGreenFg,
    },
    checkedRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
      marginBottom: 24,
    },
    checkedText: {
      fontSize: 13,
      color: c.textMuted,
    },
    featureCard: {
      alignSelf: "stretch",
      backgroundColor: c.field,
      borderRadius: 16,
      padding: 16,
      gap: 14,
      marginBottom: 12,
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    featureText: {
      fontSize: 15,
      fontWeight: "500",
      color: c.text,
    },
    bindsCard: {
      alignSelf: "stretch",
      backgroundColor: c.field,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
    },
    bindsLabel: {
      fontSize: 13,
      color: c.textMuted,
      marginBottom: 10,
    },
    bindsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    bindsCol: {
      flex: 1,
      gap: 2,
    },
    bindsKeystore: {
      fontSize: 15,
      color: c.text,
    },
    bindsKey: {
      fontSize: 13,
      color: c.textSecondary,
      fontFamily: "monospace",
    },
    bindsNote: {
      fontSize: 13,
      lineHeight: 19,
      color: c.textSecondary,
      marginTop: 14,
    },
    priceRow: {
      alignSelf: "stretch",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    priceLabel: {
      fontSize: 15,
      color: c.text,
    },
    priceValue: {
      fontSize: 17,
      fontWeight: "700",
      color: c.text,
    },
    advLink: {
      alignItems: "center",
      paddingVertical: 6,
    },
    advText: {
      fontSize: 14,
      color: c.textMuted,
      fontWeight: "500",
    },
    topTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 17,
      fontWeight: "600",
      color: c.text,
      marginHorizontal: 12,
    },
    sheetTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: c.text,
      marginBottom: 8,
    },
    sheetText: {
      fontSize: 14,
      lineHeight: 20,
      color: c.textSecondary,
      marginBottom: 20,
    },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 10,
    },
    menuIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    menuRowText: {
      fontSize: 16,
      fontWeight: "600",
      color: c.text,
    },
    identity: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 4,
      marginBottom: 20,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    at: {
      fontSize: 22,
      fontWeight: "600",
      color: c.text,
    },
    idcol: {
      flex: 1,
      gap: 3,
    },
    name: {
      fontSize: 18,
      fontWeight: "500",
      color: c.text,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 999,
    },
    statusText: {
      fontSize: 12,
      color: c.textMuted,
    },
    refreshText: {
      color: c.accent,
      fontSize: 14,
      fontWeight: "500",
    },
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 12,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    rowLabel: {
      fontSize: 13,
      color: c.textMuted,
    },
    rowValueWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    rowValue: {
      fontSize: 14,
      color: c.text,
      fontFamily: "monospace",
    },
    divider: {
      height: 1,
      backgroundColor: c.border,
    },
    recordsHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    recordsTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: c.text,
    },
    addText: {
      fontSize: 13,
      fontWeight: "500",
      color: c.text,
    },
    recRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    chip: {
      backgroundColor: c.chip,
      borderRadius: 5,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    chipText: {
      fontSize: 10,
      fontWeight: "600",
      color: c.textMuted,
    },
    recMid: {
      flex: 1,
      gap: 2,
    },
    recTitle: {
      fontSize: 13,
      fontWeight: "500",
      color: c.text,
    },
    recSub: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: "monospace",
    },
    waiting: {
      fontSize: 14,
      color: c.textMuted,
      lineHeight: 20,
      padding: 14,
    },
    note: {
      fontSize: 14,
      color: c.textMuted,
      lineHeight: 20,
      marginBottom: 20,
    },
  });
