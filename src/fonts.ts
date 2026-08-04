import React from "react";
import { Platform, Text, TextInput, StyleSheet } from "react-native";
import { Asset } from "expo-asset";
import {
  useFonts,
  Karla_400Regular,
  Karla_500Medium,
  Karla_600SemiBold,
  Karla_700Bold,
} from "@expo-google-fonts/karla";

const karlaFonts = {
  Karla_400Regular,
  Karla_500Medium,
  Karla_600SemiBold,
  Karla_700Bold,
};

export function useKarla(): boolean {
  const [loaded] = useFonts(karlaFonts);
  // On web the injected @font-face swaps Karla in as it loads, so don't block on it.
  return Platform.OS === "web" ? true : loaded;
}

function familyForWeight(weight?: string | number): string {
  switch (String(weight)) {
    case "500":
      return "Karla_500Medium";
    case "600":
      return "Karla_600SemiBold";
    case "700":
    case "800":
    case "900":
    case "bold":
      return "Karla_700Bold";
    default:
      return "Karla_400Regular";
  }
}

let applied = false;

// Make Karla the app-wide default. Native and web need different mechanisms.
export function applyKarlaDefault(): void {
  if (applied) return;
  applied = true;
  if (Platform.OS === "web") {
    injectWebKarla();
  } else {
    patchNativeText();
  }
}

// Web: register one "Karla" family carrying every weight, then win the cascade
// with a global rule so per-element fontWeight selects the correct face.
function injectWebKarla(): void {
  if (typeof document === "undefined") return;
  const faces: [any, number][] = [
    [Karla_400Regular, 400],
    [Karla_500Medium, 500],
    [Karla_600SemiBold, 600],
    [Karla_700Bold, 700],
  ];
  const fontFaces = faces
    .map(([mod, weight]) => {
      let uri = "";
      try {
        uri = Asset.fromModule(mod).uri;
      } catch {
        uri = "";
      }
      return uri
        ? `@font-face{font-family:'Karla';font-style:normal;font-weight:${weight};font-display:swap;src:url("${uri}") format("truetype");}`
        : "";
    })
    .join("\n");
  const rule = `*{font-family:'Karla',-apple-system,system-ui,'Segoe UI',Roboto,sans-serif !important;}`;
  const style = document.createElement("style");
  style.setAttribute("data-karla", "");
  style.textContent = `${fontFaces}\n${rule}`;
  document.head.appendChild(style);
}

// Native: react-native exposes the forwardRef render, so wrap it to give any
// element without an explicit family the Karla face matching its weight.
function patchNativeText(): void {
  for (const Comp of [Text, TextInput] as any[]) {
    const holder =
      typeof Comp?.render === "function"
        ? Comp
        : typeof Comp?.type?.render === "function"
          ? Comp.type
          : null;
    if (!holder) continue;
    const original = holder.render;
    holder.render = function patchedRender(...args: any[]) {
      const element = original.apply(this, args);
      if (!element) return element;
      const flat = StyleSheet.flatten(element.props?.style) || {};
      if (flat.fontFamily) return element; // respect monospace etc.
      return React.cloneElement(element, {
        style: [
          element.props.style,
          { fontFamily: familyForWeight(flat.fontWeight), fontWeight: "normal" },
        ],
      });
    };
  }
}
