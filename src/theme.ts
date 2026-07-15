import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Colors = {
  background: string;
  surface: string;
  surfaceSunken: string;
  chip: string;
  text: string;
  textMuted: string;
  textFaint: string;
  placeholder: string;
  border: string;
  accent: string;
  accentText: string;
  accentMuted: string;
  accentDisabledBg: string;
  danger: string;
  dangerText: string;
  dangerBg: string;
  dangerBgDisabled: string;
  dangerTextDisabled: string;
  success: string;
  successBg: string;
  successText: string;
  overlay: string;
};

export const darkColors: Colors = {
  background: "#000000",
  surface: "#1A1A1A",
  surfaceSunken: "#0F0F0F",
  chip: "#2A2A2A",
  text: "#FFFFFF",
  textMuted: "#8A8A8A",
  textFaint: "#D6D6D6",
  placeholder: "#4A4A4A",
  border: "#333333",
  accent: "#FF7B00",
  accentText: "#FFFFFF",
  accentMuted: "#B8571F",
  accentDisabledBg: "#271300",
  danger: "#FF4D4D",
  dangerText: "#FF0000",
  dangerBg: "#330000",
  dangerBgDisabled: "#1A0000",
  dangerTextDisabled: "#800000",
  success: "#10B981",
  successBg: "#003300",
  successText: "#00FF00",
  overlay: "rgba(0,0,0,0.7)",
};

export const lightColors: Colors = {
  background: "#FFFFFF",
  surface: "#F2F2F2",
  surfaceSunken: "#EAEAEA",
  chip: "#E5E5E5",
  text: "#111111",
  textMuted: "#6B6B6B",
  textFaint: "#555555",
  placeholder: "#A0A0A0",
  border: "#E3E3E3",
  accent: "#FF7B00",
  accentText: "#FFFFFF",
  accentMuted: "#B8571F",
  accentDisabledBg: "#FFD9B3",
  danger: "#E53935",
  dangerText: "#D32F2F",
  dangerBg: "#FDECEC",
  dangerBgDisabled: "#F7DADA",
  dangerTextDisabled: "#E9A0A0",
  success: "#10B981",
  successBg: "#E7F7EF",
  successText: "#0A7D4B",
  overlay: "rgba(0,0,0,0.4)",
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