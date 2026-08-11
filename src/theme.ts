import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useColorScheme, Appearance } from "react-native";
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
  background: "#0E0E11",
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
  accentText: "#FFFFFF",
  border: "#303037",
  borderWarm: "#5F3D1C",
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
  background: "#FFFFFF",
  card: "#FFFFFF",
  surface: "#F2F3F6",
  surfaceSunken: "#E9EAED",
  field: "#F2F3F6",
  chip: "#E5E6E9",
  tileNeutral: "#0E0E12",
  text: "#0E0E12",
  textSecondary: "#6B6B75",
  textMuted: "#94949E",
  textFaint: "#6B6B73",
  placeholder: "#B8B8BF",
  iconDefault: "#B8B8BF",
  chevron: "#C4C4CC",
  accentText: "#FFFFFF",
  border: "#E5E7EA",
  borderWarm: "#F6D3B0",
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

export type ThemeMode = "system" | "light" | "dark";

type ThemeContextValue = {
  colors: Colors;
  scheme: "light" | "dark";
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

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
    Appearance.setColorScheme(mode === "system" ? "unspecified" : mode);
  }, [mode]);

  const scheme: "light" | "dark" =
    mode === "system" ? (system === "light" ? "light" : "dark") : mode;
  const colors = scheme === "light" ? lightColors : darkColors;

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