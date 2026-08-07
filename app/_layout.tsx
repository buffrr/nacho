import React from "react";
import { Platform, View, StyleSheet } from "react-native";
import {
  Stack,
  ThemeProvider as NavThemeProvider,
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavDefaultTheme,
} from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StoreProvider, useStore } from "@/Store";
import { ThemeProvider, useTheme } from "@/theme";
import { useKarla, applyKarlaDefault } from "@/fonts";

// Runs once at module load (patches the default Text font). Must stay a
// top-level side effect, not inside a component.
applyKarlaDefault();

// Auth gate: pick the (main) or (onboarding) group from the store's configured
// state. StoreProvider renders null until it has loaded, so this never mounts
// with a half-loaded state → no onboarding flash. Mirrors the old
// Navigation.tsx RootStack conditional.
function RootLayoutNav() {
  const { xpub, handles } = useStore();
  const { colors, scheme } = useTheme();
  const isConfigured = xpub !== null && handles !== null;

  // The navigator's own theme paints BEHIND screens during native transitions
  // (the slide). Expo Router defaults to react-navigation's light theme (white
  // bg) — that white is what flashed behind the header on the Handles→detail
  // slide. Derive the nav theme from our app colors so the transition backdrop
  // is the theme background. (ThemeProvider/DarkTheme are re-exported by
  // expo-router; importing them from @react-navigation/native is guarded.)
  const base = scheme === "light" ? NavDefaultTheme : NavDarkTheme;
  const navTheme = React.useMemo(
    () => ({
      ...base,
      colors: {
        ...base.colors,
        background: colors.background,
        card: colors.background,
        text: colors.text,
        border: colors.border,
        primary: colors.accent,
      },
    }),
    [base, colors],
  );

  return (
    <NavThemeProvider value={navTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={isConfigured}>
          <Stack.Screen name="(main)" />
        </Stack.Protected>
        <Stack.Protected guard={!isConfigured}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
      </Stack>
    </NavThemeProvider>
  );
}

// Web-only: constrain the app to a 390px "phone" viewport centered on the page
// (native is pass-through). Ported from the old App.web.tsx frame.
function WebFrame({ children }: { children: React.ReactNode }) {
  const { colors, scheme } = useTheme();
  if (Platform.OS !== "web") return <>{children}</>;
  return (
    <View
      style={[
        styles.webContainer,
        { backgroundColor: scheme === "light" ? "#E5E5E5" : "#1a1a1a" },
      ]}
    >
      <View
        style={[styles.mobileViewport, { backgroundColor: colors.background }]}
      >
        {children}
      </View>
    </View>
  );
}

export default function RootLayout() {
  const fontsLoaded = useKarla();
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StoreProvider>
          <WebFrame>
            <RootLayoutNav />
          </WebFrame>
        </StoreProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    // @ts-ignore - web-only style
    minHeight: "100vh",
    // @ts-ignore - web-only style
    width: "100vw",
  },
  mobileViewport: {
    width: 390,
    // @ts-ignore - web-only style
    height: "100vh",
    maxHeight: 844,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
});
