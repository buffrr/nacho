import React from "react";
import { StoreProvider } from "./Store";
import { ThemeProvider } from "./theme";
import Navigation from "./Navigation";
import { useKarla, applyKarlaDefault } from "./fonts";

applyKarlaDefault();

export default function () {
  const fontsLoaded = useKarla();
  if (!fontsLoaded) return null;
  return (
    <ThemeProvider>
      <StoreProvider>
        <Navigation />
      </StoreProvider>
    </ThemeProvider>
  );
}
