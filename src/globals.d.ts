// Ambient types for globals installed at startup by polyfills.ts (native) and
// polyfills.web.ts (web). The `buffer` package ships its own types; we expose
// them on the global `Buffer` the polyfill assigns, plus the Node-style `global`
// alias the web polyfill uses. Declaring these here (rather than pulling in all
// of @types/node) avoids clobbering React Native's DOM/timer typings.
import type { Buffer as NodeBuffer } from "buffer";

declare global {
  // eslint-disable-next-line no-var
  var Buffer: typeof NodeBuffer;
  // eslint-disable-next-line no-var
  var global: typeof globalThis;
}

export {};