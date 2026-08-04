import React from "react";
import { View, StyleSheet } from "react-native";
import { StoreProvider } from "./Store";
import { ThemeProvider, useTheme } from "./theme";
import Navigation from "./Navigation";
import { useKarla, applyKarlaDefault } from "./fonts";

applyKarlaDefault();

const Frame = () => {
  const { colors, scheme } = useTheme();
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
        <Navigation />
      </View>
    </View>
  );
};

export default function () {
  const fontsLoaded = useKarla();
  if (!fontsLoaded) return null;
  return (
    <ThemeProvider>
      <StoreProvider>
        <Frame />
      </StoreProvider>
    </ThemeProvider>
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
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
});
