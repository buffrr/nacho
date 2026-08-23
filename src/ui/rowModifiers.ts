// Web / Android shim for the swift-ui row modifiers. The universal @expo/ui
// components ignore swift-ui modifiers off iOS, but importing
// `@expo/ui/swift-ui/modifiers` there pulls the native ExpoUI module and crashes
// the web bundle ("Cannot find native module 'ExpoUI'"). These inert stubs keep
// the call sites cross-platform. The `import type` is erased at build time, so it
// never loads the native module.
import type { ModifierConfig } from "@expo/ui/swift-ui/modifiers";

const noop = (type: string, params: Record<string, unknown> = {}): ModifierConfig =>
  ({ $type: type, ...params }) as unknown as ModifierConfig;

export const listRowBackground = (color: string) => noop("listRowBackground", { color });
export const listRowSeparator = (
  visibility: "automatic" | "visible" | "hidden",
  edges?: "all" | "top" | "bottom",
) => noop("listRowSeparator", { visibility, edges });
export const refreshable = (handler: () => Promise<void>) =>
  noop("refreshable", { handler });
export const controlSize = (size: string) => noop("controlSize", { size });
export const tint = (color: string) => noop("tint", { color });
export const glassEffect = (params?: Record<string, unknown>) =>
  noop("glassEffect", params ?? {});
