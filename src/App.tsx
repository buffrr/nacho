import React from "react";
import { StoreProvider } from "./Store";
import { ThemeProvider } from "./theme";
import Navigation from "./Navigation";

export default function () {
  return (
    <ThemeProvider>
      <StoreProvider>
        <Navigation />
      </StoreProvider>
    </ThemeProvider>
  );
}
