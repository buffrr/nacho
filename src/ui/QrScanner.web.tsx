import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/theme";

export type QrScannerProps = {
  active: boolean;
  onScan: (data: string) => void;
  onError?: (message: string) => void;
};

// Web scanner: stream the rear camera into a <video> (react-dom renders raw DOM
// nodes under react-native-web) and poll the browser BarcodeDetector for QR
// codes. Falls back with an error when the API or camera isn't available.
export function QrScanner({ active, onScan, onError }: QrScannerProps) {
  const { colors } = useTheme();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [denied, setDenied] = React.useState(false);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  onScanRef.current = onScan;
  onErrorRef.current = onError;

  const start = React.useCallback(async () => {
    setDenied(false);
    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
      onErrorRef.current?.(
        "QR scanning isn't supported in this browser — use paste instead.",
      );
      return () => {};
    }

    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
    } catch {
      setDenied(true);
      onErrorRef.current?.("Camera permission denied.");
      return () => {};
    }

    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((t) => t.stop());
      return () => {};
    }
    video.srcObject = stream;
    await video.play().catch(() => {});

    // @ts-ignore BarcodeDetector is not in the TS DOM lib yet
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    let latched = false;

    const tick = async () => {
      if (stopped) return;
      try {
        const codes = await detector.detect(video);
        if (codes.length && !latched) {
          latched = true;
          onScanRef.current(codes[0].rawValue);
          return;
        }
      } catch {
        // transient decode error — keep polling
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    start().then((c) => {
      if (cancelled) c?.();
      else cleanup = c;
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [active, start]);

  return (
    <View style={StyleSheet.absoluteFill}>
      {React.createElement("video", {
        ref: videoRef,
        autoPlay: true,
        playsInline: true,
        muted: true,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover",
        },
      })}
      {denied && (
        <View style={styles.prompt}>
          <Text style={styles.promptText}>
            Camera blocked. Allow camera access in your browser, then retry.
          </Text>
          <TouchableOpacity
            onPress={() => start().then(() => {})}
            style={[styles.promptBtn, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.promptBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 14,
  },
  promptText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    color: "#FFFFFF",
  },
  promptBtn: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  promptBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
