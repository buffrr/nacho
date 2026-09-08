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
  Alert,
} from "react-native";
import { useStore } from "@/Store";
import { pubkeyForHandle, p2trScriptFromPub } from "@/keys";
import { extractCertData } from "@/cert";
import { saveBinary } from "@/file";
import * as Clipboard from "expo-clipboard";
import { saveCert, loadCert, deleteCert } from "@/certStore";
import { useRecordsDraft } from "@/RecordsDraft";
import { editableFromZone, verifyErrorMessage } from "@/fabricResolver";
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
  Lock,
  Check,
  ChevronRight,
  Plus,
  Infinity as InfinityIcon,
} from "@/ui/icons";
import { lookupRecord } from "@/recordRegistry";
import type { EditableRecord } from "@/fabricResolver";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OwnerProfileNative } from "@/ui/ownerProfileNative";
import { liveOffers, Offer } from "@/offers";
import { resolveHandleWithCerts } from "@/fabric";
import {
  certStateOf,
  certStateFromSovereignty,
  getCachedCerts,
  setCachedCerts,
  isFinalCached,
  CertState,
} from "@/certState";
import { HandleStatusNative, StatusDetail } from "@/ui/handleStatusNative";
import { PurchaseNative } from "@/ui/purchaseNative";
import { headerRightItemsOption, headerLeftItemsOption } from "@/ui/androidHeaderItems";
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
  const insets = useSafeAreaInsets();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const {
    ensureLoaded,
    applyResolved,
    getRecords,
    getSeq,
    setSeq,
    isDirty,
    changedFlags,
    changeCount,
    markClean,
    moveRecord,
    deleteRecord,
  } = useRecordsDraft();
  const [error, setError] = useState<string | null>(null);
  // Records reorder mode: rows show up/down arrows instead of editing on tap
  // (each @expo/ui row is one Button, so inline controls need edit-mode gating).
  const [reordering, setReordering] = useState(false);
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

  // True while a prospective handle has been committed to the keystore for an
  // in-flight purchase that hasn't completed. If the user cancels the IAP sheet
  // (or it errors), we roll the handle back out of the list — it was never paid
  // for, so it shouldn't linger as a "pending" entry the user can't remove.
  const purchaseRollbackRef = React.useRef(false);

  // Live sale/transfer listings the user has signed for this handle (shown in the
  // manage view; reloaded on focus so a just-signed sale appears).
  const [liveListings, setLiveListings] = useState<Offer[]>([]);
  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      liveOffers(handle).then((o) => {
        if (active) setLiveListings(o);
      });
      return () => {
        active = false;
      };
    }, [handle]),
  );

  // A handle reached from Shop ("Buy") isn't in the keystore yet — we show it in
  // a prospective state using the next derivation we *would* use, and only
  // persist it once the purchase is actually reserved (see handleBuyHandle).
  const persisted = handles?.[handle];
  const handleData = persisted ?? nextHandleData();
  const isProspective = !persisted;

  // App Review demo handles. The "@example" space is never a real registerable
  // space, so this can never match a production handle — it lets a purchased
  // example handle skip cert issuance / certrelay publishing and just edit dummy
  // records locally, so reviewers can exercise the record UI. Gated ONLY on the
  // handle string, so it adds no behavior to any real handle.
  const demo = /@example$/i.test(handle);
  // A demo handle counts as OWNED only once it's actually acquired — seeded, or a
  // completed sandbox purchase (both set a purchase record) — NOT merely present
  // in the keystore. During an in-flight purchase, handleBuyHandle calls
  // createHandle BEFORE payment (to reserve), which persists the handle; gating
  // on the purchase record (not `!isProspective`) keeps the Buy view up with the
  // IAP sheet over it instead of flipping to the manage view mid-purchase. A
  // prospective demo (from Shop) stays buyable so reviewers can sandbox-purchase.
  const demoOwned = demo && !!handleData?.purchase;

  if (!xpub || !handleData) {
    return <Redirect href="/(main)/(tabs)/handles" />;
  }

  const pubkey = pubkeyForHandle(xpub, handleData);
  const script_pubkey = p2trScriptFromPub(pubkey);
  const cert = handleData.cert;

  const iapApi = iap
    ? iap.hook({
        onPurchaseSuccess: async (purchase) => {
          if (__DEV__) console.log("[nacho/iap] onPurchaseSuccess");
          if (!purchase.purchaseToken) {
            setError("No purchase token received");
            // Nothing to send the server, but StoreKit still holds this
            // transaction — finish it so it doesn't replay on the next attempt.
            try {
              await finishTransaction({ purchase, isConsumable: true });
            } catch (e) {
              if (__DEV__) console.warn("[nacho/iap] finishTransaction failed", e);
            }
            setPurchasing(false);
            return;
          }
          const result = await claimHandleIAP(
            handle,
            script_pubkey,
            purchase.purchaseToken,
            iap.platform,
          );
          // Finish (consume — isConsumable) FIRST, before any navigation.
          // finalizePurchase() navigates to Your handles + pushes the handle,
          // which unmounts THIS screen; on Android that tears down the billing
          // connection, so a finishTransaction running after it is dropped and
          // the (reused) SKU stays "owned" — blocking the next purchase and
          // hanging it. Finish whenever the server DURABLY saw the receipt
          // (success OR terminal server error). Only a transport failure
          // (errorKind "network") leaves it queued so a genuine retry can
          // replay it next launch.
          if (result.errorKind !== "network") {
            try {
              await finishTransaction({ purchase, isConsumable: true });
            } catch (e) {
              if (__DEV__) console.warn("[nacho/iap] finishTransaction failed", e);
            }
          }
          if (result.error) {
            setError(result.error);
            fetchAndUpdateHandleStatus();
          } else {
            // Paid and claimed — the handle stays, no rollback.
            purchaseRollbackRef.current = false;
            await applyHandleStatus(result.handle_status);
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
          // No payment happened — undo the speculative createHandle so a
          // cancelled buy doesn't leave an un-removable "pending" handle.
          if (purchaseRollbackRef.current) {
            purchaseRollbackRef.current = false;
            removeHandle(handle);
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
  const { requestPurchase, finishTransaction } = iapApi;

  // Android BillingClient readiness. useIAP binds the Play billing service on
  // mount and calls endConnection on unmount, so navigating between handles
  // churns the (app-wide) client; requestPurchase on a still-(re)connecting
  // client hangs in BillingClient's reconnect loop instead of opening the sheet.
  // Gate the buy flow on this. The web/fallback path has no `connected` → treat
  // as ready so non-native paths are unchanged.
  const billingConnected =
    iap && "connected" in iapApi ? (iapApi as ReturnType<IAPHook>).connected : true;
  const billingConnectedRef = React.useRef(billingConnected);
  React.useEffect(() => {
    billingConnectedRef.current = billingConnected;
  }, [billingConnected]);

  // NOTE: deliberately NO proactive getAvailablePurchases() sweep here. It shares
  // the single app-wide BillingClient with the purchase, and on the (slow)
  // emulator its query can run ~10s and collide with a concurrent
  // requestPurchase, making the buy flaky. Consume-before-navigate in
  // onPurchaseSuccess is what prevents unconsumed/stuck purchases; that's the fix.

  useFocusEffect(
    React.useCallback(() => {
      // The nacho purchase API only matters until the handle has its certificate.
      // Once we hold the cert, its job is done — the handle lives on the
      // decentralized network, so we only resolve (below) and never poll the
      // server again. This also means a server outage can't mislabel an
      // established handle as "not available to buy".
      const hasCertYet = !!handleData.certRef || !!handleData.cert;
      // An OWNED demo (@example) is always "available" on the server (it's the
      // sandbox-purchasable review handle), so probing its status would flip a
      // seeded, locally-manageable handle into the Buy view. Skip it for owned
      // demos only — a PROSPECTIVE demo still needs the status + price so its Buy
      // page works (reviewers purchase it via sandbox).
      if (!hasCertYet && !demoOwned) {
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
  // reassuring "Purchase complete" state, not the plain "waiting for cert") and
  // pin the latest anchor. The onboarding (issuing → ready → sovereign) then
  // plays out IN PLACE on this screen — we deliberately do NOT rebuild the nav
  // stack here, because doing so mid-onboarding slid the screen out and back,
  // flashing the "handle is yours" state twice. The Back → Your handles reset
  // happens once the user finishes onboarding (see dismissOnboarding).
  const finalizePurchase = async () => {
    purchaseRollbackRef.current = false; // committed for good now
    await fetchAndUpdateHandleStatus();
    // The purchase advanced the chain, so pin the latest anchor before resolving
    // — otherwise the just-bought handle is newer than the pinned anchor.
    await refreshSemiTrust();
    await setHandlePurchase(handle, price !== null ? { amountCents: price } : {});
  };

  // `fresh` uses a throwaway Fabric client so the SDK's zone cache can't return
  // stale data — used by the onboarding poll to catch the cert / sovereignty.
  const refreshResolution = async (fresh = false, loud = false) => {
    // Demo (@example) never resolves on the network — skip so it doesn't flap to
    // "unverified"/not-found or waste a request.
    if (demo) return;
    setResolving(true);
    if (loud) setError(null);
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
      // A response that couldn't be verified against any anchor may be forged —
      // record that it's unverified and DON'T act on it (no record cache, no
      // cert re-export). We keep our last verified state instead.
      const verified = resolved.badge !== "unverified";
      const sovereignty = resolved.zone.sovereignty ?? "unknown";
      await setHandleResolution(handle, {
        found: true,
        sovereignty,
        scriptPubkey: resolved.zone.script_pubkey,
        unverified: !verified,
        updatedAt: Date.now(),
      });
      if (verified) {
        setNumId(resolved.zone.num_id ?? null);
        setAlias(resolved.zone.alias ?? null);
      }

      // Capture/refresh the certificate when it's ours AND verified. Re-export
      // only when the sovereignty advances (e.g. dependent → sovereign) or we
      // don't have it.
      const mine = resolved.zone.script_pubkey === script_pubkey;
      if (mine && verified) {
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
      if (mine && verified && (!ref || ref.sovereignty !== sovereignty)) {
        try {
          const bytes = await exportCert(handle);
          await saveCert(handle, bytes);
          await setCertRef(handle, { savedAt: Date.now(), sovereignty });
        } catch (e) {
          // certrelay/export failure — keep any previously stored cert
        }
      }
    } catch (e) {
      // Leave the previous resolution in place on failure. Background polls stay
      // silent; a user-initiated (loud) refresh surfaces the real error so
      // pull-to-refresh doesn't fail invisibly.
      if (loud) setError(verifyErrorMessage(e));
    } finally {
      setResolving(false);
    }
  };
  refreshRef.current = refreshResolution;

  const handleImportCertificate = () => {
    router.push({ pathname: "/(main)/(tabs)/handles/import-certificate", params: { handle } });
  };

  const handleExportCertificate = async () => {
    const bytes = await loadCert(handle);
    if (bytes) {
      // saveBinary opens the native share sheet on iOS/Android (save to Files,
      // send via an app, …) and downloads the file on web.
      await saveBinary(`${handle}.spacecert`, bytes);
    }
  };

  // Pull-to-refresh for the manage view: re-resolve + reload signed listings, and
  // refresh the cert chain unless it's already final (immutable).
  const onManageRefresh = async () => {
    if (demo) return; // nothing to refresh for a local-only example handle
    // loud = surface any resolve failure in the banner (this is user-initiated).
    await refreshResolution(true, true);
    setLiveListings(await liveOffers(handle));
    if (!isFinalCached(handle)) {
      try {
        const r = await resolveHandleWithCerts(handle, true);
        // Never cache a cert chain we couldn't verify against an anchor.
        if (r && r.badge !== "unverified") {
          setCachedCerts(handle, r);
          setCertNonce((n) => n + 1);
        }
      } catch (e) {
        // Only report the cert-chain error if the resolve above didn't already
        // set one, so we don't clobber the more relevant message.
        setError((prev) => prev ?? verifyErrorMessage(e));
      }
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
    // Demo (@example): no cert, no certrelay — just accept the edits locally so
    // reviewers see a working publish without any network dependency.
    if (demo) {
      const seq = Math.floor(Date.now() / 1000);
      const records = getRecords(handle);
      setSeq(handle, seq);
      markClean(handle);
      recordsSet(handle, JSON.stringify({ records, seq }), Date.now());
      foundRef.current = true;
      setPublished(true);
      setPublishing(false);
      return;
    }
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
  // Copy with row feedback (for the native owner view — flashes "Copied ✓").
  const copyWithFeedback = (id: string, text: string) => {
    Clipboard.setStringAsync(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1400);
  };

  const handleBuyHandle = async () => {
    setError(null);
    setPurchasing(true);

    // Android: wait for the Play billing service to be bound before doing
    // anything. Calling requestPurchase while the BillingClient is still
    // (re)connecting hangs on an internal reconnect loop ("Async task is taking
    // too long / Max retries") and the sheet never opens. iOS connects reliably,
    // so this guard is Android-only to keep iOS behaviour identical.
    if (iap && Platform.OS === "android" && !billingConnectedRef.current) {
      const start = Date.now();
      while (!billingConnectedRef.current && Date.now() - start < 6000) {
        await new Promise((r) => setTimeout(r, 150));
      }
      if (!billingConnectedRef.current) {
        setError("Store isn’t ready yet — try again in a moment.");
        setPurchasing(false);
        return;
      }
    }

    const result = await reserveHandle(handle, script_pubkey);
    if ("error" in result) {
      setError(result.error);
      setPurchasing(false);
      if (!isProspective) fetchAndUpdateHandleStatus();
      return;
    }

    // The reservation succeeded under our next-derived key, so commit the handle
    // to the keystore now (not on mere navigation from Shop). Arm the rollback so
    // a cancelled/failed IAP flow removes it again.
    if (isProspective) {
      await createHandle(handle);
      purchaseRollbackRef.current = true;
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
      // Failed to even start the IAP flow — roll the speculative handle back out.
      if (purchaseRollbackRef.current) {
        purchaseRollbackRef.current = false;
        await removeHandle(handle);
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
  // A persisted demo counts as owned (it's local-only, no resolution/cert) so it
  // manages instead of showing Buy.
  const owned = resolvable || isImported || isScriptPubkeyValid === true || demoOwned;
  // We've already grabbed + stored this handle's certificate.
  const hasCert = !!handleData.certRef || !!cert;
  // Once we hold the cert we can show + manage records regardless of a flapping
  // live resolution (e.g. the semi-trusted anchor lagging the handle's block),
  // so the view doesn't bounce back to "waiting for certificate".
  // An OWNED demo (@example) is always manageable (local records, no cert
  // needed). A prospective demo is NOT manageable — it shows the Buy view.
  const manageable = demoOwned || (!keyMismatch && (resolvable || (owned && hasCert)));
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
  // Post-purchase onboarding: issuing (no cert yet) → ready (cert landed, prompt
  // to set up records) → sovereign (final, back-up nudge). We dropped the old
  // "anchoring to Bitcoin — usually within a day" copy from the ready step (the
  // Certificate view now carries Provisional/Confirming), but keep the step
  // itself for its "Set up records" hand-off into the manage view.
  // Reserved/unpaid handles and pre-existing ones skip onboarding entirely.
  // Demo (@example) skips the issuing/ready/sovereign onboarding entirely — it
  // has no cert to wait for; it lands straight in the manage view.
  const showOnboarding =
    !demo && isPaid && !keyMismatch && handleData.onboarded === false;
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

  // Precise certificate state for the Details "Certificate" row: final from the
  // sovereignty flag, else the cached resolveWithCerts result. Fetch once (one
  // round trip, giving us the chain for the cert screen too) when not final —
  // never re-fetch a final handle (its chain is immutable, the call is expensive).
  // Precise state from the cached cert chain when we have it; otherwise the coarse
  // state from the handle's known sovereignty — so a failed/offline fetch keeps
  // the right word instead of flipping to Provisional.
  const cachedCert = getCachedCerts(handle);
  const certState: CertState = cachedCert
    ? certStateOf(cachedCert.zone)
    : certStateFromSovereignty(isSovereign ? "sovereign" : sovereignty);
  const [, setCertNonce] = useState(0);
  useEffect(() => {
    if (demo || !manageable || isSovereign || isFinalCached(handle)) return;
    let active = true;
    resolveHandleWithCerts(handle)
      .then((r) => {
        // Never cache a cert chain we couldn't verify against an anchor.
        if (r && r.badge !== "unverified" && active) {
          setCachedCerts(handle, r);
          setCertNonce((n) => n + 1);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manageable, isSovereign, handle]);

  // Directly purchasable here → show the dedicated claim/purchase view. An OWNED
  // demo is `owned` (above), so it's excluded; a PROSPECTIVE demo still reaches
  // Buy via the server's "available" status, so reviewers can buy it via sandbox.
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
    router.replace({ pathname: "/(main)/(tabs)/handles/import-keypair", params: { handle } });
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

  // One record row rendered through the shared registry (mocks2 §04): known keys
  // get a labelled icon, unknown keys show their key verbatim in monospace. Tap
  // opens the editor — full values live on the detail screen, one tap away.
  const registryRow = (r: EditableRecord, i: number) => {
    const { def, known } = lookupRecord(r.type, r.key);
    const value = r.value.join(", ");
    return (
      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: "/(main)/(tabs)/handles/edit-record",
            params: { handle, index: String(i) },
          })
        }
        activeOpacity={0.7}
      >
        <View style={styles.recRow}>
          <View style={[styles.recIco, { backgroundColor: def.color + "22" }]}>
            <def.Icon size={18} color={def.color} />
          </View>
          <View style={styles.recMid}>
            <Text style={[styles.recTitle, !known && styles.recTitleMono]}>
              {def.label}
              {def.note ? <Text style={styles.recNote}> {def.note}</Text> : null}
            </Text>
            <Text style={styles.recSub} numberOfLines={1}>
              {value}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.chevron} />
        </View>
      </TouchableOpacity>
    );
  };


  // Finishing onboarding ("Set up records" / "Continue"): mark it done, then
  // rebuild the stack as [handles tab, this handle] so Back lands on Your handles
  // (not the Shop/Redeem screen this was pushed from). We await the onboarded
  // flag first so the re-pushed screen reads it as true and opens straight into
  // the normal editor — no onboarding flash. Doing the reset here, on an explicit
  // tap, means the only stack transition is one the user asked for.
  // Finishing onboarding flips the flag AND re-roots to the Handles tab, so this
  // handle's manage view sits directly on the Handles list — Back now goes to the
  // Handles page, not back to the Shop/Search results this was bought from. The
  // onboarding itself played in place (finalizePurchase doesn't navigate), so this
  // is the only stack transition and it's one the user asked for (no double-slide).
  const dismissOnboarding = () => {
    setHandleOnboarded(handle, true);
    if (router.canDismiss()) router.dismissAll();
    router.navigate({
      pathname: "/(main)/(tabs)/handles/show-handle",
      params: { handle },
    });
  };

  // Back from the post-purchase onboarding goes to the Handles list — the handle
  // is now theirs, so returning to the Shop/Search results it was bought from
  // would be confusing. Used for the onboarding screen's back affordance.
  const goToHandlesList = () => {
    if (router.canDismiss()) router.dismissAll();
    router.navigate("/(main)/(tabs)/handles");
  };

  // Bought through nacho's IAP → show the reassuring "Purchase complete /
  // issuing certificate" state; handles registered elsewhere fall back to the
  // plain "Waiting for certificate" note.
  const boughtViaNacho = !!handleData.purchase;

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
      : // Manage view uses the iOS-Contacts layout — the handle is shown big
        // under the avatar, so the nav bar carries no title (no duplication).
        "";

  // The ⋯ options as a NATIVE header menu (UIMenu). Only when the handle is
  // owned (not while buying).
  // Transactions are user-initiated and collect the current outpoint via the
  // manual-entry form (we have no chain view). Transfer with no recipient = a key
  // rotation. Certificate + signed listings live in the manage view now; refresh
  // is pull-to-refresh; so the menu stays tight: Sell, Transfer, Remove.
  // Unsaved record edits → the header shows a Publish CTA instead of the "+",
  // so Add record moves into the ⋯ menu while publishing is pending.
  const dirty = manageable && isDirty(handle);
  const addRecordAction: NativeStackHeaderItemMenuAction = {
    type: "action",
    label: "Add record",
    icon: { type: "sfSymbol", name: "plus" },
    onPress: () =>
      router.push({ pathname: "/(main)/(tabs)/handles/add-record", params: { handle } }),
  };
  const menuActions: NativeStackHeaderItemMenuAction[] = [
    // While dirty the "+" lives here (the header slot is taken by Publish).
    ...(dirty ? [addRecordAction] : []),
    {
      type: "action",
      label: "Sell",
      icon: { type: "sfSymbol", name: "tag" },
      onPress: () =>
        router.push({ pathname: "/(main)/(tabs)/handles/handle-action", params: { handle, action: "sale" } }),
    },
    {
      type: "action",
      label: "Transfer",
      icon: { type: "sfSymbol", name: "arrow.right" },
      onPress: () =>
        router.push({ pathname: "/(main)/(tabs)/handles/handle-action", params: { handle, action: "transfer" } }),
    },
    // Reorder mode (up/down chevrons) is the web/Android path; iOS reorders via
    // native drag in the SwiftUI list, so the menu item is redundant there.
    ...(Platform.OS !== "ios" && getRecords(handle).length > 1
      ? ([
          {
            type: "action",
            label: "Reorder",
            icon: { type: "sfSymbol", name: "arrow.up.arrow.down" },
            onPress: () => setReordering(true),
          },
        ] as NativeStackHeaderItemMenuAction[])
      : []),
    {
      type: "action",
      label: "Remove",
      icon: { type: "sfSymbol", name: "trash" },
      destructive: true,
      onPress: confirmRemoveHandle,
    },
  ];
  // While reordering, the header is just a Done button.
  const headerItems: NativeStackHeaderItem[] = reordering
    ? [
        {
          type: "button",
          label: "Done",
          tintColor: colors.text,
          onPress: () => setReordering(false),
        },
      ]
    : buyable
    ? []
    : [
        // Unsaved edits → a prominent "Publish" CTA (send-arrow) takes the slot;
        // otherwise the persistent "Add record" action (mocks2 §04), which picks
        // up the native iOS 26 bar-button look.
        ...(dirty
          ? ([
              {
                // Spell out "Publish" (no icon — a native bar button renders the
                // icon OR the title, not both, and the word is clearer here).
                // Accent-tinted text, not a filled pill (prominent looked heavy).
                type: "button",
                label: publishing ? "Publishing…" : "Publish",
                tintColor: colors.accent,
                disabled: publishing,
                onPress: signAndPublish,
              },
            ] as NativeStackHeaderItem[])
          : manageable
          ? ([
              {
                type: "button",
                label: "Add record",
                icon: { type: "sfSymbol", name: "plus" },
                onPress: () =>
                  router.push({
                    pathname: "/(main)/(tabs)/handles/add-record",
                    params: { handle },
                  }),
              },
            ] as NativeStackHeaderItem[])
          : []),
        {
          type: "menu",
          label: "Options",
          icon: { type: "sfSymbol", name: "ellipsis" },
          menu: { items: menuActions },
        },
      ];

  // Minimal ⋯ menu (just Remove) for terminal states that aren't manageable —
  // e.g. "Different key": the handle is in the keystore but we can't manage it,
  // so the only useful action is removing it from this device.
  const removeHeaderItems: NativeStackHeaderItem[] = [
    {
      type: "menu",
      label: "Options",
      icon: { type: "sfSymbol", name: "ellipsis" },
      menu: {
        items: [
          {
            type: "action",
            label: "Remove handle",
            icon: { type: "sfSymbol", name: "trash" },
            destructive: true,
            onPress: confirmRemoveHandle,
          },
        ],
      },
    },
  ];

  // For the request / unsupported state: import a certificate the operator issued,
  // or remove the handle from this device.
  const requestHeaderItems: NativeStackHeaderItem[] = [
    {
      type: "menu",
      label: "Options",
      icon: { type: "sfSymbol", name: "ellipsis" },
      menu: {
        items: [
          {
            type: "action",
            label: "Import certificate",
            icon: { type: "sfSymbol", name: "square.and.arrow.down" },
            onPress: handleImportCertificate,
          },
          {
            type: "action",
            label: "Remove handle",
            icon: { type: "sfSymbol", name: "trash" },
            destructive: true,
            onPress: confirmRemoveHandle,
          },
        ],
      },
    },
  ];

  // Some terminal states can be reached via a replace / cross-stack navigate with
  // nothing beneath them, so the native back button can't appear. Fall back to an
  // explicit "Handles" left item whenever we can't pop, so there's always a way out.
  const backFallbackLeft: NativeStackHeaderItem[] | undefined = router.canGoBack()
    ? undefined
    : [
        {
          type: "button",
          label: "Handles",
          icon: { type: "sfSymbol", name: "chevron.backward" },
          tintColor: colors.text,
          onPress: goToHandlesList,
        },
      ];
  const leftFallbackOption = backFallbackLeft
    ? headerLeftItemsOption(backFallbackLeft, colors.text)
    : {};

  const shortPk = `${pubkey.slice(0, 8)}…${pubkey.slice(-8)}`;

  // ── Native onboarding (issuing → sovereign) ─────────────────────────────────
  if (showOnboarding) {
    let sIcon: Parameters<typeof HandleStatusNative>[0]["icon"] = "clock";
    let iconColor = colors.textMuted;
    let statusLabel = "Waiting for certificate";
    let statusColor = colors.textMuted;
    let message = "";
    let messageIcon: Parameters<typeof HandleStatusNative>[0]["messageIcon"];
    let messageIconColor: string | undefined;
    let details: StatusDetail[] | undefined;
    let primary: { label: string; onPress: () => void } | undefined;
    let secondary: { label: string; onPress: () => void } | undefined;

    if (onboardStage === "issuing" && boughtViaNacho) {
      // The handle is theirs (paid, bound to their key) — no status glyph, just
      // green "is yours" text. The seal/shield is reserved for actual
      // sovereignty; the clock belongs to the "Issuing your certificate…"
      // message, where the waiting is.
      sIcon = undefined;
      statusLabel = "is yours";
      statusColor = colors.statusGreenFg;
      message =
        "Issuing your certificate — usually a few minutes. You’ll be able to publish records as soon as it lands.";
      messageIcon = "clock";
      messageIconColor = colors.textMuted;
      details = [
        ...(handleData.purchase?.amountCents != null
          ? [{ label: "Paid", value: formatPrice(handleData.purchase.amountCents) }]
          : []),
        { label: "Bound to", value: shortPk },
        ...(handleData.purchase?.orderId
          ? [{ label: "Order", value: handleData.purchase.orderId }]
          : []),
      ];
    } else if (onboardStage === "issuing") {
      message =
        "The handle is registered to your key. We’ll pull the certificate as soon as a relay has it.";
      secondary = {
        label: resolving ? "Checking…" : "Check now",
        onPress: () => refreshResolution(),
      };
    } else if (onboardStage === "ready") {
      // Cert landed — hand off into the handle. No status glyph (the seal is for
      // sovereignty). No "anchoring…" copy: the Certificate view now carries
      // Provisional/Confirming.
      sIcon = undefined;
      statusLabel = "is yours";
      statusColor = colors.statusGreenFg;
      message =
        "Your certificate is ready. You can now use your handle!";
      messageIcon = "checkmark.circle.fill";
      messageIconColor = colors.statusGreenFg;
      primary = { label: "Set up records", onPress: dismissOnboarding };
    } else {
      sIcon = "checkmark.shield.fill";
      iconColor = colors.statusBlueFg;
      statusLabel = "Sovereign";
      statusColor = colors.statusBlueFg;
      message =
        "Ownership is proven on-chain and can’t be revoked. Back up your certificate.";
      primary = { label: "Continue", onPress: dismissOnboarding };
      secondary = { label: "View proof", onPress: handleExportCertificate };
    }

    return (
      <>
        <Stack.Screen
          options={{
            title: headerTitle,
            // The handle is now theirs — Back (and the swipe) go to the Handles
            // list, not back to the Shop/Search results it was bought from.
            headerBackVisible: false,
            gestureEnabled: false,
            ...headerLeftItemsOption(
              [
                {
                  type: "button",
                  label: "Handles",
                  icon: { type: "sfSymbol", name: "chevron.backward" },
                  tintColor: colors.text,
                  onPress: goToHandlesList,
                },
              ],
              colors.text,
            ),
          }}
        />
        <HandleStatusNative
          handle={handle}
          icon={sIcon}
          iconColor={iconColor}
          statusLabel={statusLabel}
          statusColor={statusColor}
          message={message}
          messageIcon={messageIcon}
          messageIconColor={messageIconColor}
          details={details}
          primary={primary}
          secondary={secondary}
        />
      </>
    );
  }

  // ── Native waiting-for-certificate (paid, no cert, not manageable yet) ──────
  if (awaitingCert && !manageable && !buyable) {
    return (
      <>
        <Stack.Screen
          options={{ title: "", ...headerRightItemsOption(headerItems, colors.text) }}
        />
        <HandleStatusNative
          handle={handle}
          icon="clock"
          iconColor={colors.textMuted}
          statusLabel={pill.label}
          statusColor={pill.fg}
          message="Waiting for your certificate to appear on certrelay. You can add records once it’s live."
          details={[{ label: "Bound to", value: shortPk }]}
          secondary={{
            label: resolving ? "Checking…" : "Check now",
            onPress: () => refreshResolution(),
          }}
        />
      </>
    );
  }

  // ── Native manage view (@expo/ui) ──────────────────────────────────────────
  // The common owner case renders with native grouped sections, matching the
  // resolve/handle view. Buy / edge states stay on the RN Layout below. The
  // "Sign and publish" action sits in a pinned RN footer over the native content
  // (only when there are unsaved edits).
  if (!buyable && manageable) {
    const unverifiedResolution = !!(resolution?.found && resolution.unverified);
    const banner: { text: string; tone: "error" | "success" | "muted" } | null =
      unverifiedResolution
        ? {
            text: "No configured anchor could verify the latest response — it may be forged. Showing your last verified data.",
            tone: "error",
          }
        : error
          ? { text: error, tone: "error" }
          : published && !dirty
            ? { text: "Records published to certrelay.", tone: "success" }
            : notice
              ? { text: notice, tone: "muted" }
              : null;
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen
          options={{ title: "", ...headerRightItemsOption(headerItems, colors.text) }}
        />
        <OwnerProfileNative
          handle={handle}
          records={records}
          pubkey={pubkey}
          numId={numId}
          alias={alias}
          seq={seq}
          pill={pill}
          sovereign={isSovereign}
          unverified={unverifiedResolution}
          dirty={dirty}
          changed={changedFlags(handle)}
          changeCount={changeCount(handle)}
          reordering={reordering}
          onMoveUp={(i) => moveRecord(handle, i, i - 1)}
          onMoveDown={(i) => moveRecord(handle, i, i + 1)}
          onMoveRecord={(from, to) => moveRecord(handle, from, to)}
          onDeleteRecord={(i) => deleteRecord(handle, i)}
          banner={banner}
          copied={copiedId}
          certState={certState}
          listings={liveListings.map((o) => ({ id: o.id, kind: o.kind, price: o.price }))}
          onEditRecord={(i) =>
            router.push({
              pathname: "/(main)/(tabs)/handles/edit-record",
              params: { handle, index: String(i) },
            })
          }
          onAddRecord={() =>
            router.push({ pathname: "/(main)/(tabs)/handles/add-record", params: { handle } })
          }
          onCopy={copyWithFeedback}
          onOpenCert={() =>
            router.push({ pathname: "/(main)/(tabs)/handles/certificate", params: { handle } })
          }
          onCancelListings={() =>
            router.push({ pathname: "/(main)/(tabs)/handles/cancel-offers", params: { handle } })
          }
          onRefresh={onManageRefresh}
        />
      </View>
    );
  }

  // ── Native purchase / buy view ──────────────────────────────────────────────
  if (buyable) {
    return (
      <>
        <Stack.Screen options={{ title: headerTitle }} />
        <PurchaseNative
          handle={handle}
          pubkey={pubkey}
          price={price}
          purchasing={purchasing}
          onBuy={handleBuyHandle}
          onCopyKey={() => copy(pubkey)}
        />
      </>
    );
  }

  // ── Native key-mismatch / owned-by-other / request states ──────────────────
  if (keyMismatch) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "",
            headerBackVisible: true,
            ...headerRightItemsOption(removeHeaderItems, colors.text),
            ...leftFallbackOption,
          }}
        />
        <HandleStatusNative
          handle={handle}
          icon="exclamationmark.triangle.fill"
          iconColor={colors.dangerText}
          statusLabel="Different key"
          statusColor={colors.dangerText}
          message="This handle is registered to a different public key. Import its private key to manage it."
          primary={{ label: "Import private key", onPress: replaceWithImport }}
        />
      </>
    );
  }

  if (ownedByOther) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "",
            headerBackVisible: true,
            ...headerRightItemsOption(removeHeaderItems, colors.text),
            ...leftFallbackOption,
          }}
        />
        <HandleStatusNative
          handle={handle}
          icon="exclamationmark.triangle.fill"
          iconColor={colors.statusAmberFg}
          statusLabel={pill.label}
          statusColor={pill.fg}
          message={
            handleStatusString === "taken"
              ? "This handle is taken by a different public key."
              : "This handle is currently reserved by another user."
          }
        />
      </>
    );
  }

  // Not owned and not purchasable here → request / unsupported / processing.
  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerBackVisible: true,
          ...headerRightItemsOption(requestHeaderItems, colors.text),
          ...leftFallbackOption,
        }}
      />
      <HandleStatusNative
        handle={handle}
        icon={isProcessingPurchase ? "clock" : "paperplane"}
        iconColor={colors.textMuted}
        statusLabel={pill.label}
        statusColor={pill.fg}
        message={
          isProcessingPurchase
            ? "Your reservation is being processed. This can take a little while."
            : "This space isn’t available to buy here. Copy the request and send it to an operator — the certificate will appear once it’s issued."
        }
        primary={
          isProcessingPurchase
            ? undefined
            : { label: "Copy request", onPress: handleCopyRequest }
        }
      />
    </>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    // ── Post-purchase onboarding states (issuing / ready / sovereign) ──
    onboard: {
      alignItems: "center",
      paddingTop: 24,
    },
    onboardIcon: {
      width: 72,
      height: 72,
      borderRadius: 999,
      borderCurve: "continuous",
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
      borderCurve: "continuous",
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
      borderCurve: "continuous",
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
      borderCurve: "continuous",
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
      borderCurve: "continuous",
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
      borderCurve: "continuous",
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
      borderCurve: "continuous",
      alignItems: "center",
      justifyContent: "center",
    },
    menuRowText: {
      fontSize: 16,
      fontWeight: "600",
      color: c.text,
    },
    // Centered iOS-Contacts profile header (matches the Resolve screen).
    profile: { alignItems: "center", paddingTop: 8, paddingBottom: 18 },
    profileName: {
      fontSize: 23,
      fontWeight: "700",
      color: c.text,
      marginTop: 14,
      letterSpacing: -0.3,
      textAlign: "center",
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 10,
    },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderCurve: "continuous",
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 999,
      borderCurve: "continuous",
    },
    statusText: {
      fontSize: 12,
      fontWeight: "500",
    },
    refreshText: {
      color: c.accent,
      fontSize: 13,
      fontWeight: "500",
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderCurve: "continuous",
      marginBottom: 22,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
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
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginLeft: 16,
    },
    recDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginLeft: 56,
    },
    recordsHead: {
      marginBottom: 7,
      marginLeft: 4,
    },
    recordsTitle: {
      fontFamily: "monospace",
      fontSize: 10.5,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: c.textMuted,
    },
    recRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    recIco: {
      width: 30,
      height: 30,
      borderRadius: 8,
      borderCurve: "continuous",
      alignItems: "center",
      justifyContent: "center",
    },
    recMid: {
      flex: 1,
      gap: 2,
    },
    recTitle: {
      fontSize: 14.5,
      fontWeight: "500",
      color: c.text,
    },
    recTitleMono: {
      fontFamily: "monospace",
      fontSize: 13,
      fontWeight: "400",
    },
    recNote: {
      fontSize: 11.5,
      color: c.textMuted,
      fontWeight: "400",
    },
    recSub: {
      fontSize: 12.5,
      color: c.textSecondary,
      fontFamily: "monospace",
    },
    emptyRecords: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    emptyRecordsIco: {
      width: 30,
      height: 30,
      borderRadius: 8,
      borderCurve: "continuous",
      backgroundColor: c.surfaceSunken,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyRecordsTitle: {
      fontSize: 14.5,
      fontWeight: "500",
      color: c.text,
    },
    emptyRecordsSub: {
      fontSize: 12.5,
      color: c.textMuted,
      marginTop: 1,
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
