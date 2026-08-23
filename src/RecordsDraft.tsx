import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { EditableRecord } from "@/fabricResolver";

// `dirty` = the draft has edits not yet published (drives whether "Sign and
// publish" shows). Set on edit, cleared on load and after publishing.
type Draft = { records: EditableRecord[]; seq: number; dirty: boolean };

type RecordsDraftValue = {
  // Seed a handle's draft from its resolved zone (only if not already loaded).
  ensureLoaded: (handle: string, records: EditableRecord[], seq: number) => void;
  // Replace the draft with freshly-resolved records — used once a network
  // resolve returns to update a draft seeded from the (possibly stale) cache.
  // No-op if the user has unsaved edits (dirty), so edits are never clobbered.
  applyResolved: (handle: string, records: EditableRecord[], seq: number) => void;
  getRecords: (handle: string) => EditableRecord[];
  getSeq: (handle: string) => number;
  isDirty: (handle: string) => boolean;
  // index null → append a new record.
  setRecord: (
    handle: string,
    index: number | null,
    record: EditableRecord,
  ) => void;
  deleteRecord: (handle: string, index: number) => void;
  // Reorder a record within the draft array (SIP-7 record order is meaningful
  // and part of the signed set, so a move is a dirtying edit that publishes).
  moveRecord: (handle: string, from: number, to: number) => void;
  // Update the draft's sequence number (published seq = unix seconds) without
  // dropping the loaded records.
  setSeq: (handle: string, seq: number) => void;
  // Mark the draft as saved/published (no pending edits).
  markClean: (handle: string) => void;
  clear: (handle: string) => void;
};

const RecordsDraftContext = createContext<RecordsDraftValue | undefined>(
  undefined,
);

const EMPTY: Draft = { records: [], seq: 0, dirty: false };

export function RecordsDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const ensureLoaded = useCallback(
    (handle: string, records: EditableRecord[], seq: number) => {
      setDrafts((prev) =>
        prev[handle]
          ? prev
          : { ...prev, [handle]: { records, seq, dirty: false } },
      );
    },
    [],
  );

  const applyResolved = useCallback(
    (handle: string, records: EditableRecord[], seq: number) => {
      setDrafts((prev) => {
        const draft = prev[handle];
        if (draft?.dirty) return prev; // keep unsaved edits
        // Don't clobber newer local records with an older/stale resolve — right
        // after publishing, the relay often still returns the previous (or empty,
        // seq 0) zone before the new records propagate. Only take the network's
        // data when it's at least as new as what we already have.
        if (draft && seq < draft.seq) return prev;
        return { ...prev, [handle]: { records, seq, dirty: false } };
      });
    },
    [],
  );

  const getRecords = useCallback(
    (handle: string) => drafts[handle]?.records ?? [],
    [drafts],
  );
  const getSeq = useCallback((handle: string) => drafts[handle]?.seq ?? 0, [
    drafts,
  ]);
  const isDirty = useCallback(
    (handle: string) => drafts[handle]?.dirty ?? false,
    [drafts],
  );

  const setRecord = useCallback(
    (handle: string, index: number | null, record: EditableRecord) => {
      setDrafts((prev) => {
        const draft = prev[handle] ?? EMPTY;
        const records =
          index === null
            ? [...draft.records, record]
            : draft.records.map((r, i) => (i === index ? record : r));
        return { ...prev, [handle]: { ...draft, records, dirty: true } };
      });
    },
    [],
  );

  const deleteRecord = useCallback((handle: string, index: number) => {
    setDrafts((prev) => {
      const draft = prev[handle];
      if (!draft) return prev;
      return {
        ...prev,
        [handle]: {
          ...draft,
          records: draft.records.filter((_, i) => i !== index),
          dirty: true,
        },
      };
    });
  }, []);

  const moveRecord = useCallback((handle: string, from: number, to: number) => {
    setDrafts((prev) => {
      const draft = prev[handle];
      if (!draft) return prev;
      const n = draft.records.length;
      if (from < 0 || from >= n || to < 0 || to >= n || from === to) return prev;
      const records = [...draft.records];
      const [item] = records.splice(from, 1);
      records.splice(to, 0, item);
      return { ...prev, [handle]: { ...draft, records, dirty: true } };
    });
  }, []);

  const setSeq = useCallback((handle: string, seq: number) => {
    setDrafts((prev) => {
      const draft = prev[handle] ?? EMPTY;
      return { ...prev, [handle]: { ...draft, seq } };
    });
  }, []);

  const markClean = useCallback((handle: string) => {
    setDrafts((prev) => {
      const draft = prev[handle];
      if (!draft) return prev;
      return { ...prev, [handle]: { ...draft, dirty: false } };
    });
  }, []);

  const clear = useCallback((handle: string) => {
    setDrafts((prev) => {
      const { [handle]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  return (
    <RecordsDraftContext.Provider
      value={{
        ensureLoaded,
        applyResolved,
        getRecords,
        getSeq,
        isDirty,
        setRecord,
        deleteRecord,
        moveRecord,
        setSeq,
        markClean,
        clear,
      }}
    >
      {children}
    </RecordsDraftContext.Provider>
  );
}

export function useRecordsDraft(): RecordsDraftValue {
  const ctx = useContext(RecordsDraftContext);
  if (!ctx) {
    throw new Error("useRecordsDraft must be used within RecordsDraftProvider");
  }
  return ctx;
}
