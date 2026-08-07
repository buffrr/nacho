import React, { createContext, useContext, useState } from "react";
import type { HandlesMap } from "@/Store";

// Ephemeral handoff for the onboarding flow's object params. Expo Router
// serializes route params to strings (and they'd leak into the web address
// bar), so the keystore under construction — `{ xpub, handles? }` — is passed
// through this context (scoped to the (onboarding) group) instead of the URL.
// `handles === undefined` means a brand-new keystore (create flow); a present
// map means an imported one.
export type PendingKeystore = { xpub: string; handles?: HandlesMap } | null;

const PendingKeystoreContext = createContext<{
  pending: PendingKeystore;
  setPending: (p: PendingKeystore) => void;
}>({ pending: null, setPending: () => {} });

export function PendingKeystoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pending, setPending] = useState<PendingKeystore>(null);
  return (
    <PendingKeystoreContext.Provider value={{ pending, setPending }}>
      {children}
    </PendingKeystoreContext.Provider>
  );
}

export function usePendingKeystore() {
  return useContext(PendingKeystoreContext);
}
