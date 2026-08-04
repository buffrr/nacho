import React, { useState, useEffect, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { useStore } from "@/Store";
import { pubkeyForHandle, p2trScriptFromPub } from "@/keys";
import { extractCertData } from "@/cert";
import { saveBinary } from "@/file";
import * as Clipboard from "expo-clipboard";
import { saveCert, loadCert, deleteCert } from "@/certStore";
import { useRecordsDraft } from "@/RecordsDraft";
import { editableFromZone } from "@/fabricResolver";
import { avatarColors, handlePill } from "@/handleTile";
import { Layout } from "@/ui/Layout";
import { BottomSheet } from "@/ui/BottomSheet";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";
import { Colors, useTheme } from "@/theme";
import { resolveHandle, exportCert, publishRecords } from "@/fabric";
import {
  AtSign,
  MoreVertical,
  Copy,
  Pencil,
  Lock,
  ArrowLeft,
  Download,
  Upload,
  Trash,
  Check,
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

type ShowHandleRouteProp = RouteProp<HandlesStackParamList, "ShowHandle">;
type ShowHandleNavigationProp = NativeStackNavigationProp<
  HandlesStackParamList,
  "ShowHandle"
>;

interface Props {
  route: ShowHandleRouteProp;
  navigation: ShowHandleNavigationProp;
}

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

export default function ShowHandle({ route, navigation }: Props) {
  const { handle } = route.params;
  const {
    xpub,
    handles,
    createHandle,
    nextHandleData,
    removeHandle,
    setHandleCertData,
    setHandleResolution,
    setCertRef,
    getSigningKey,
  } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { ensureLoaded, getRecords, getSeq, setSeq, isDirty, markClean } =
    useRecordsDraft();
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
  const [published, setPublished] = useState(false);
  const [numId, setNumId] = useState<string | null>(null);
  // Alias is published by the operator and read from fabric resolution — it is
  // not something the user edits here.
  const [alias, setAlias] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
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

  // A handle reached from Shop ("Buy") isn't in the keystore yet — we show it in
  // a prospective state using the next derivation we *would* use, and only
  // persist it once the purchase is actually reserved (see handleBuyHandle).
  const persisted = handles?.[handle];
  const handleData = persisted ?? nextHandleData();
  const isProspective = !persisted;

  if (!xpub || !handleData) {
    navigation.replace("ListHandles");
    return null;
  }

  const pubkey = pubkeyForHandle(xpub, handleData);
  const script_pubkey = p2trScriptFromPub(pubkey);
  const cert = handleData.cert;

  const { requestPurchase, finishTransaction } = iap
    ? iap.hook({
        onPurchaseSuccess: async (purchase) => {
          if (!purchase.purchaseToken) {
            setError("No purchase token received");
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
          }
        },
        onPurchaseError: (error) => {
          if (error.code !== "user-cancelled") {
            setError("Purchase failed: " + error.message);
          }
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
      fetchAndUpdateHandleStatus();
      checkPurchaseInfo(handle).then((info) => {
        setPurchaseSupport(info.support);
        setPrice(info.price ?? null);
      });
      refreshResolution();
    }, []),
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

  const fetchAndUpdateHandleStatus = async () => {
    const status = await fetchHandleStatus(handle);
    await applyHandleStatus(status);
    setCheckedAt(Date.now());
    setNow(Date.now());
  };

  const refreshResolution = async () => {
    setResolving(true);
    try {
      const resolved = await resolveHandle(handle);
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
        ensureLoaded(handle, records, seq);
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

  const handleImportCertificate = () => {
    setMenuOpen(false);
    navigation.navigate("ImportCertificate", { handle });
  };

  const handleExportCertificate = async () => {
    setMenuOpen(false);
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
    navigation.replace("ListHandles");
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
      await publishRecords(cert, getRecords(handle), seq, secretKey);
      // Keep the just-published records on screen and bump the version — don't
      // clear the draft (which would flash empty/"waiting" until it re-resolves).
      setSeq(handle, seq);
      markClean(handle);
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
    setHandleStatusString("reserved");
    const result = await reserveHandle(handle, script_pubkey);
    if ("error" in result) {
      setError(result.error);
      if (!isProspective) fetchAndUpdateHandleStatus();
      else setHandleStatusString(null);
      return;
    }

    // The reservation succeeded under our next-derived key, so commit the handle
    // to the keystore now (not on mere navigation from Shop).
    if (isProspective) {
      await createHandle(handle);
    }

    try {
      await requestPurchase({
        request: {
          ios: { sku: result.product_id },
          android: { skus: [result.product_id] },
        },
        type: "in-app",
      });
    } catch (error) {
      setError(
        "Failed purchase: " +
          (error instanceof Error ? error.message : String(error)),
      );
      fetchAndUpdateHandleStatus();
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
  // Owned but not yet on certrelay → waiting for the certificate to appear.
  const awaitingCert = owned && !resolvable && !keyMismatch;
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
    navigation.replace("ImportKeypair", { handle });
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

  const avatar = avatarColors(colors, handle);

  const renderPurchase = () => (
    <View style={styles.purchase}>
      <View style={[styles.buyAvatar, { backgroundColor: avatar.bg }]}>
        <AtSign size={30} color={avatar.fg} />
      </View>
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

  return (
    <View style={{ flex: 1 }}>
    <Layout
      padTop
      footer={
        buyable ? (
          <>
            <Button
              text={
                price !== null
                  ? `Buy handle · ${formatPrice(price)}`
                  : "Buy handle"
              }
              onPress={handleBuyHandle}
              type="main"
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
        ) : resolvable ? (
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
      <View style={styles.topbar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={8}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>
          {buyable ? "Buy handle" : handle}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setConfirmingRemove(false);
            setMenuOpen(true);
          }}
          hitSlop={8}
          accessibilityLabel="Options"
        >
          <MoreVertical size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {error && <Message message={error} type="error" />}
      {notice && !error && <Message message={notice} type="success" />}

      {buyable ? (
        renderPurchase()
      ) : (
        <>
      <View style={styles.identity}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: avatarColors(colors, handle).bg },
          ]}
        >
          <AtSign size={24} color={avatarColors(colors, handle).fg} />
        </View>
        <View style={styles.idcol}>
          <Text style={styles.name} numberOfLines={1}>
            {handle}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: pill.fg }]} />
            <Text style={styles.statusText}>{pill.label}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={refreshResolution} disabled={resolving} hitSlop={8}>
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

      {resolvable && (
        <>
          <View style={styles.recordsHead}>
            <Text style={styles.recordsTitle}>Records</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("EditRecord", { handle })}
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
                    navigation.navigate("EditRecord", { handle, index: i }),
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

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        {confirmingRemove ? (
          <>
            <Text style={styles.sheetTitle}>Remove handle?</Text>
            <Text style={styles.sheetText}>
              This only removes {handle} from this keystore. Your seed phrase can
              re-derive it.
            </Text>
            <Button
              text="Remove handle"
              onPress={handleRemoveHandle}
              type="danger"
            />
            <Button
              text="Back"
              onPress={() => setConfirmingRemove(false)}
              type="secondary"
            />
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={handleImportCertificate}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.field }]}>
                <Upload size={20} color={colors.text} />
              </View>
              <Text style={styles.menuRowText}>Import certificate</Text>
            </TouchableOpacity>
            {handleData.certRef && (
              <TouchableOpacity
                style={styles.menuRow}
                onPress={handleExportCertificate}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIcon, { backgroundColor: colors.field }]}>
                  <Download size={20} color={colors.text} />
                </View>
                <Text style={styles.menuRowText}>Export certificate</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => setConfirmingRemove(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.dangerBg }]}>
                <Trash size={20} color={colors.danger} />
              </View>
              <Text style={[styles.menuRowText, { color: colors.danger }]}>
                Remove handle
              </Text>
            </TouchableOpacity>
          </>
        )}
      </BottomSheet>
    </View>
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
