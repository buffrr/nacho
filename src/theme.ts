import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useColorScheme, Appearance, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Semantic color tokens mirroring the Nacho v2 Figma variable system.
export type Colors = {
  // surfaces
  background: string; // surface/screen
  card: string; // surface/card
  surface: string; // filled container (interim; use `card` + border for v2 tiles)
  surfaceSunken: string;
  field: string; // surface/field — input backgrounds
  chip: string; // chip/bg
  tileNeutral: string; // surface/tile-neutral — dark utility surface (gear, etc.)
  // text
  text: string; // text/primary
  textSecondary: string; // text/secondary — row labels, subtitles (#73737a)
  textMuted: string; // text/muted
  textFaint: string;
  placeholder: string;
  iconDefault: string; // icon/default
  chevron: string; // icon/chevron — subtle disclosure indicator (systemGray-ish)
  accentText: string; // text/on-accent
  // lines
  border: string; // border/divider
  borderWarm: string; // border/warm
  // accent
  accent: string; // accent/primary
  accentMuted: string;
  accentDisabledBg: string;
  // danger
  danger: string;
  dangerText: string;
  dangerBg: string;
  dangerBgDisabled: string;
  dangerTextDisabled: string;
  // success (maps to status green)
  success: string;
  successBg: string;
  successText: string;
  overlay: string;
  // status pills (fg on bg)
  statusGreenFg: string;
  statusGreenBg: string;
  statusAmberFg: string;
  statusAmberBg: string;
  statusBlueFg: string;
  statusBlueBg: string;
  statusGreyFg: string;
  statusGreyBg: string;
  // tile / avatar backgrounds
  tileTealFg: string;
  tileTealBg: string;
  tileOrangeBg: string;
  tileLavenderBg: string;
  tileGoldBg: string;
  tileBlueBg: string;
  tilePinkBg: string;
};

export const darkColors: Colors = {
  // Matches iOS's dark grouped background (systemGroupedBackground = pure black),
  // so RN screens + the native @expo/ui Form share one seamless backdrop and
  // cards (≈ secondarySystemGroupedBackground #1C1C1E) lift off it like native.
  background: "#000000",
  card: "#1B1B1F",
  surface: "#1B1B1F",
  surfaceSunken: "#27272B",
  field: "#27272B",
  chip: "#27272B",
  tileNeutral: "#333339",
  text: "#F2F2F6",
  textSecondary: "#A2A2AC",
  textMuted: "#80808A",
  textFaint: "#9E9EA8",
  placeholder: "#80808A",
  iconDefault: "#B2B2BD",
  chevron: "#5E5E68",
  accentText: "#000000",
  border: "#303037",
  // Formerly a warm amber divider; neutralised to the standard border so cards
  // and forms read native rather than "highlighted". Kept as an alias so callers
  // don't all need editing.
  borderWarm: "#303037",
  accent: "#FF7B00",
  accentMuted: "#B8571F",
  accentDisabledBg: "#3D291C",
  danger: "#FF6B6B",
  dangerText: "#FF6B6B",
  dangerBg: "#321C1C",
  dangerBgDisabled: "#2A1616",
  dangerTextDisabled: "#7A3B3B",
  success: "#1B8C49",
  successBg: "#1C2C20",
  successText: "#3FBE6E",
  overlay: "rgba(0,0,0,0.6)",
  statusGreenFg: "#3FBE6E",
  statusGreenBg: "#1C2C20",
  statusAmberFg: "#D89A3C",
  statusAmberBg: "#44331C",
  statusBlueFg: "#5A8FE6",
  statusBlueBg: "#1C2535",
  statusGreyFg: "#9E9EA8",
  statusGreyBg: "#1C1D20",
  tileTealFg: "#2FB79A",
  tileTealBg: "#1C352E",
  tileOrangeBg: "#3D291C",
  tileLavenderBg: "#221C30",
  tileGoldBg: "#40381C",
  tileBlueBg: "#1C2739",
  tilePinkBg: "#321C28",
};

export const lightColors: Colors = {
  // iOS grouped style: the screen is a light grey so white cards/fields stand
  // out as distinct groups (previously bg + card were both white → cards
  // vanished into the screen). Cards + inputs are white to pop off the grey.
  background: "#F2F2F7",
  card: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceSunken: "#E9EAED",
  field: "#FFFFFF",
  chip: "#E5E6E9",
  tileNeutral: "#0E0E12",
  text: "#0E0E12",
  textSecondary: "#6B6B75",
  textMuted: "#94949E",
  textFaint: "#6B6B73",
  placeholder: "#B8B8BF",
  iconDefault: "#B8B8BF",
  chevron: "#C4C4CC",
  // White on the orange accent in light mode (black looked muddy on the bright
  // orange against a light background). Dark mode keeps black.
  accentText: "#FFFFFF",
  border: "#E5E7EA",
  borderWarm: "#E5E7EA",
  accent: "#FF7B00",
  accentMuted: "#B8571F",
  accentDisabledBg: "#FFD9B3",
  danger: "#E5484D",
  dangerText: "#D3352B",
  dangerBg: "#FDECEC",
  dangerBgDisabled: "#F7DADA",
  dangerTextDisabled: "#E9A0A0",
  success: "#1B8C49",
  successBg: "#E5F6EA",
  successText: "#1B8C49",
  overlay: "rgba(0,0,0,0.4)",
  statusGreenFg: "#1B8C49",
  statusGreenBg: "#E5F6EA",
  statusAmberFg: "#B8730D",
  statusAmberBg: "#FEECD4",
  statusBlueFg: "#2567CA",
  statusBlueBg: "#E4EEFE",
  statusGreyFg: "#6B6B73",
  statusGreyBg: "#EAEBEE",
  tileTealFg: "#088C70",
  tileTealBg: "#D9F4EC",
  tileOrangeBg: "#FCE7D9",
  tileLavenderBg: "#ECE6FB",
  tileGoldBg: "#FAF1D4",
  tileBlueBg: "#E0ECFE",
  tilePinkBg: "#FCE5F2",
};

// Max width for a screen's content column. On wide screens (iPad) content is
// capped at this and centered so it reads as an intentional layout instead of a
// stretched phone screen; on phones the window is narrower so it's a no-op.
// Single knob — tune here, every bounded screen follows.
export const CONTENT_MAX_WIDTH = 600;

// Ready-made style for a full-screen @expo/ui <Host>: caps + centers the
// SwiftUI content column on iPad (matches CONTENT_MAX_WIDTH), no-op on phones.
// Spread extra props (e.g. paddingTop) via an array: style={[boundedHost, {…}]}.
export const boundedHost = {
  flex: 1,
  width: "100%",
  maxWidth: CONTENT_MAX_WIDTH,
  alignSelf: "center",
} as const;

export type ThemeMode = "system" | "light" | "dark";

type ThemeContextValue = {
  colors: Colors;
  scheme: "light" | "dark";
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Narrow RN's ColorSchemeName ("light" | "dark" | "unspecified" | null) to a
// concrete scheme, or null when it carries no usable signal.
function asScheme(s: unknown): "light" | "dark" | null {
  return s === "light" || s === "dark" ? s : null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // useColorScheme() can transiently return null (notably right after
  // Appearance.setColorScheme fires — including resetting to "unspecified" when
  // switching back to System), and while a mode is FORCED it returns our own
  // override, not the OS. The old `system === "light" ? light : dark` mapped that
  // null to dark, flipping a light OS to dark on the System setting. Track the
  // last KNOWN-GOOD OS scheme instead: seed from the live Appearance, and only
  // trust useColorScheme while we're actually following the system.
  const rnScheme = useColorScheme();
  const [sysScheme, setSysScheme] = useState<"light" | "dark">(
    () => asScheme(rnScheme) ?? asScheme(Appearance.getColorScheme?.()) ?? "light",
  );
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    const v = asScheme(rnScheme);
    if (mode === "system" && v) setSysScheme(v);
  }, [rnScheme, mode]);

  useEffect(() => {
    AsyncStorage.getItem("themeMode").then((v) => {
      if (v === "light" || v === "dark" || v === "system") {
        setModeState(v);
      }
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem("themeMode", next);
  };

  // Push the chosen appearance down to the native layer (the way Signal etc.
  // do it): this overrides the app's UIUserInterfaceStyle so native components —
  // sheets, headers, blur, tab bar — follow OUR theme rather than the system
  // appearance. `"unspecified"` = follow the system (RN 0.86 reset value).
  useEffect(() => {
    // Native-only: RN web has no Appearance.setColorScheme.
    Appearance.setColorScheme?.(mode === "system" ? "unspecified" : mode);
    // Re-reading the live OS scheme after resetting to "unspecified" recovers the
    // true system value even if useColorScheme() is momentarily null.
    if (mode === "system") {
      const s = asScheme(Appearance.getColorScheme?.());
      if (s) setSysScheme(s);
    }
  }, [mode]);

  const scheme: "light" | "dark" = mode === "system" ? sysScheme : mode;
  const colors = scheme === "light" ? lightColors : darkColors;

  // Web: @expo/ui's web components read their palette from `--expo-ui-*` CSS vars
  // gated on `[data-theme]`. Their defaults don't match ours (their dark bg is
  // #0b0f14 / gray-50 #111418, ours is pure #000000), so FieldGroup/sections look
  // like a mismatched grey. Pin `data-theme` to our scheme and remap the vars to
  // our exact tokens so the native grouped look matches the rest of the app.
  // No-op on native.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", scheme);
    const ID = "nacho-expo-ui-theme";
    if (document.getElementById(ID)) return;
    const style = document.createElement("style");
    style.id = ID;
    const vars = (c: Colors) => `
      --expo-ui-background: ${c.card};
      --expo-ui-foreground: ${c.text};
      --expo-ui-gray-50: ${c.background};
      --expo-ui-gray-100: ${c.border};
      --expo-ui-gray-150: ${c.border};
      --expo-ui-gray-200: ${c.surfaceSunken};
      --expo-ui-gray-500: ${c.textMuted};
      --expo-ui-gray-600: ${c.textSecondary};
      --expo-ui-gray-900: ${c.textSecondary};`;
    style.textContent = `:root[data-theme="light"]{${vars(lightColors)}}:root[data-theme="dark"]{${vars(darkColors)}}`;
    document.head.appendChild(style);
  }, [scheme]);

  return React.createElement(
    ThemeContext.Provider,
    { value: { colors, scheme, mode, setMode } },
    children,
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}