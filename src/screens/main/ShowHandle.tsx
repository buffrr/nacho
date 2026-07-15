import React, { useState, useEffect, useLayoutEffect, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { useStore } from "@/Store";
import { pubkeyForHandle, p2trScriptFromPub } from "@/keys";
import { extractCertData } from "@/cert";
import { save, saveBinary } from "@/file";
import { saveCert, loadCert, deleteCert } from "@/certStore";
import { RecordsEditor } from "@/components/RecordsEditor";
import { Layout } from "@/ui/Layout";
import { Header } from "@/ui/Header";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";
import { TrashButton } from "@/ui/icons";
import { Badge } from "@/ui/Badge";
import {
  getHandleBadge,
  sovereigntyBadge,
  sovereigntyDescription,
  STATUS_COLOR,
} from "@/handleStatus";
import { Colors, useTheme } from "@/theme";
import { resolveHandle, exportCert } from "@/fabric";
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

export default function ShowHandle({ route, navigation }: Props) {
  const { handle } = route.params;
  const {
    xpub,
    handles,
    removeHandle,
    setHandleCertData,
    setHandleResolution,
    setCertRef,
  } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const handleData = handles?.[handle];

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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TrashButton onPress={() => setShowRemoveConfirm(true)} />
      ),
    });
  }, [navigation]);

  const fetchAndUpdateHandleStatus = async () => {
    const status = await fetchHandleStatus(handle);
    await applyHandleStatus(status);
  };

  const refreshResolution = async () => {
    setResolving(true);
    try {
      const resolved = await resolveHandle(handle);
      if (!resolved) {
        await setHandleResolution(handle, {
          found: false,
          updatedAt: Date.now(),
        });
        return;
      }
      const sovereignty = resolved.zone.sovereignty ?? "unknown";
      await setHandleResolution(handle, {
        found: true,
        sovereignty,
        scriptPubkey: resolved.zone.script_pubkey,
        updatedAt: Date.now(),
      });

      // Capture/refresh the certificate when it's ours. Re-export only when the
      // sovereignty advances (e.g. dependent → sovereign) or we don't have it.
      const mine = resolved.zone.script_pubkey === script_pubkey;
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

  const handleDownloadSpacecert = async () => {
    const bytes = await loadCert(handle);
    if (bytes) {
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

  const handleDownloadRequest = async () => {
    await save(`${handle}.req.json`, {
      handle: handle,
      script_pubkey,
    });
  };

  const handleBuyHandle = async () => {
    setError(null);
    setHandleStatusString("reserved");
    const result = await reserveHandle(handle, script_pubkey);
    if ("error" in result) {
      setError(result.error);
      fetchAndUpdateHandleStatus();
      return;
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

  const importCertificateButton = (type: "main" | "secondary") => (
    <Button
      text="Import Certificate"
      onPress={() => navigation.navigate("ImportCertificate", { handle })}
      type={type}
    />
  );

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
        <>
          <Button
            text="Download Request"
            onPress={handleDownloadRequest}
            type="main"
          />
          {importCertificateButton("secondary")}
        </>
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
            text="Download Request"
            onPress={handleDownloadRequest}
            type="secondary"
          />
          {importCertificateButton("secondary")}
        </>
      );
    }

    // taken/registered by us (cert pending), or not-yet-registered.
    return (
      <>
        {importCertificateButton("main")}
        <Button
          text="Download Request"
          onPress={handleDownloadRequest}
          type="secondary"
        />
      </>
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
  const badge = resolution?.found
    ? keyMismatch
      ? { label: "Different key", color: STATUS_COLOR.red }
      : sovereigntyBadge(resolution.sovereignty)
    : owned
      ? { label: "Owned", color: STATUS_COLOR.green }
      : purchaseSupport === "unsupported"
        ? { label: "Request only", color: STATUS_COLOR.gray }
        : getHandleBadge({
            status: handleStatusString,
            hasCert: !!cert,
            scriptMatches: isScriptPubkeyValid,
          });
  const resolutionDescription =
    resolution?.found && !keyMismatch
      ? sovereigntyDescription(resolution.sovereignty)
      : null;

  const replaceWithImport = async () => {
    await removeHandle(handle);
    navigation.replace("ImportKeypair", { handle });
  };

  return (
    <Layout
      overlay={showRemoveConfirm}
      footer={
        showRemoveConfirm ? (
          <View style={styles.confirmSection}>
            <Header
              headText="Remove"
              tailText="Handle?"
              subText="This only removes it from this keystore. Your seed phrase can re-derive it."
            />
            <View style={styles.confirmButtons}>
              <Button
                text="Remove Handle"
                onPress={handleRemoveHandle}
                type="danger"
              />
              <Button
                text="Cancel"
                onPress={() => setShowRemoveConfirm(false)}
                type="secondary"
              />
            </View>
          </View>
        ) : (
          renderActions()
        )
      }
    >
      <Text style={styles.title}>
        {(() => {
          const parts = handle.split("@");
          if (parts.length === 2) {
            return (
              <>
                <Text style={styles.handleSubPart}>{parts[0]}</Text>
                <Text style={styles.handleSpacePart}>@{parts[1]}</Text>
              </>
            );
          }
          return <Text style={styles.handleSpacePart}>{handle}</Text>;
        })()}
      </Text>

      <View style={styles.badgeRow}>
        <Badge label={badge.label} color={badge.color} />
      </View>

      {resolutionDescription && (
        <Text style={styles.resolutionDescription}>
          {resolutionDescription}
        </Text>
      )}

      <TouchableOpacity
        onPress={refreshResolution}
        disabled={resolving}
        style={styles.checkStatus}
      >
        <Text style={styles.checkStatusText}>
          {resolving ? "Checking status…" : "Check status"}
        </Text>
      </TouchableOpacity>

      {handleData.certRef && (
        <View style={styles.certRow}>
          <Text style={styles.certSaved}>Certificate saved</Text>
          <TouchableOpacity onPress={handleDownloadSpacecert}>
            <Text style={styles.checkStatusText}>Download .spacecert</Text>
          </TouchableOpacity>
        </View>
      )}

      {error && <Message message={error} type="error" />}

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

      {keyMismatch && !error && (
        <Message
          message="This handle is registered to a different public key. You can't sign with your current key — import its private key to manage it."
          type="error"
        />
      )}

      {!owned &&
        !ownedByOther &&
        !keyMismatch &&
        !error &&
        purchaseSupport === "unsupported" && (
          <Text style={styles.note}>
            This space isn't available to buy here. Download the request and send
            it to an operator — the certificate will appear once it's issued.
          </Text>
        )}

      {resolvable && <RecordsEditor handle={handle} />}

      {awaitingCert && (
        <View style={styles.section}>
          <Text style={styles.label}>Records</Text>
          <Text style={styles.waiting}>
            Waiting for your certificate to appear on certrelay. You can add
            records once it's live.
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Public Key</Text>
        <Text style={styles.value} numberOfLines={6} textBreakStrategy="simple">
          {pubkey}
        </Text>
      </View>
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    title: {
      fontSize: 28,
      fontWeight: "400",
      marginBottom: 12,
      textAlign: "center",
    },
    badgeRow: {
      flexDirection: "row",
      justifyContent: "center",
      marginBottom: 10,
    },
    resolutionDescription: {
      fontSize: 14,
      color: c.textMuted,
      textAlign: "center",
      marginBottom: 10,
    },
    waiting: {
      fontSize: 14,
      color: c.textMuted,
      lineHeight: 20,
    },
    note: {
      fontSize: 14,
      color: c.textMuted,
      lineHeight: 20,
      marginBottom: 20,
    },
    checkStatus: {
      alignSelf: "center",
      paddingVertical: 6,
      marginBottom: 20,
    },
    checkStatusText: {
      color: c.accent,
      fontSize: 14,
      fontWeight: "500",
    },
    certRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      marginBottom: 20,
    },
    certSaved: {
      color: c.success,
      fontSize: 14,
      fontWeight: "500",
    },
    handleSubPart: {
      color: c.text,
    },
    handleSpacePart: {
      color: c.accent,
    },
    section: {
      marginBottom: 20,
    },
    label: {
      fontSize: 18,
      fontWeight: "400",
      color: c.text,
      marginBottom: 12,
    },
    value: {
      fontSize: 14,
      color: c.text,
      backgroundColor: c.surface,
      padding: 16,
      borderRadius: 12,
      fontFamily: "monospace",
      lineHeight: 20,
      // @ts-ignore - web-specific styles for word breaking
      wordBreak: "break-all",
      overflowWrap: "break-word",
    } as any,
    confirmSection: {
      backgroundColor: c.surface,
      padding: 20,
      borderRadius: 12,
      marginTop: 12,
    },
    confirmButtons: {
      flexDirection: "column",
      gap: 0,
    },
  });
