import React, { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { Host, FieldGroup, ListItem, Icon, Text } from "@expo/ui";
import { useStore } from "@/Store";
import { useTheme, boundedHost } from "@/theme";
import { ActionFooter } from "@/ui/actionFooter";
import { authenticate } from "@/auth";
import { exportDbBytes } from "@/db";
import { saveBinary } from "@/file";

// A single "complete backup" flow that surfaces BOTH halves a restore needs:
//   1. the seed phrase (the secret, in the Keychain — the only thing that can
//      restore control of your handles), and
//   2. the .sqlite backup file (the public map: which handles you own +
//      certificates — the seed alone can't tell you "what's what").
// Restore (ImportKeystore → EnterMnemonic) requires both, so backup asks for
// both here instead of leaving them as two unrelated Settings buttons. Imported
// handles' private keys live ONLY in the Keychain (not derived from the seed,
// not in the file), so we warn when any exist.
export default function Backup() {
  const router = useRouter();
  const { getMnemonic, seedBackedUp, markSeedBackedUp, markBackupSaved, handles } =
    useStore();
  const { scheme, colors } = useTheme();
  const [words, setWords] = useState<string[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [noSeed, setNoSeed] = useState(false);
  const [fileSaved, setFileSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const importedCount = Object.values(handles ?? {}).filter(
    (h) => h.source === "imported",
  ).length;

  const reveal = async () => {
    // Gate behind device auth (Face ID / passcode) — the seed is the highest-value
    // secret, so revealing it matches the signing flows. Proceeds if no biometrics
    // are enrolled (see authenticate()).
    if (!(await authenticate("Reveal your seed phrase"))) return;
    // Lazy-load only when the user asks to see it — not on screen entry.
    const m = await getMnemonic();
    const w = m ? m.split(" ") : [];
    setWords(w);
    if (w.length === 0) setNoSeed(true);
    else setRevealed(true);
  };

  const saveFile = async () => {
    setSaving(true);
    try {
      const bytes = await exportDbBytes();
      await saveBinary(
        `nacho-backup-${Date.now()}.sqlite`,
        bytes,
        "application/x-sqlite3",
      );
      // Capture the current keystore signature so the backup nudge clears until
      // the next change (new handle / cert finalized).
      await markBackupSaved();
      setFileSaved(true);
    } catch {
      Alert.alert("Backup failed", "Couldn't export the backup file.");
    } finally {
      setSaving(false);
    }
  };

  const seedDone = seedBackedUp;

  return (
    <>
      <Host style={boundedHost} colorScheme={scheme}>
        <FieldGroup>
          <FieldGroup.Section>
            <ListItem
              leading={<Icon name="checkmark.shield.fill" size={22} color={colors.accent} />}
            >
              <Text>
                A complete backup is two parts — your seed phrase and your backup
                file. You need both to restore your handles on a new device.
              </Text>
            </ListItem>
          </FieldGroup.Section>

          {/* ── 1 · Seed phrase ─────────────────────────────────────────────── */}
          <FieldGroup.Section
            title={seedDone ? "1 · Seed phrase · saved" : "1 · Seed phrase"}
          >
            {noSeed ? (
              <ListItem
                leading={<Icon name="exclamationmark.triangle.fill" size={20} color={colors.statusAmberFg} />}
              >
                <Text textStyle={{ color: colors.textSecondary }}>
                  This keystore has no seed phrase — restore relies on the backup
                  file plus any keys you imported.
                </Text>
              </ListItem>
            ) : revealed && words ? (
              <>
                {words.map((word, i) => (
                  <ListItem
                    key={i}
                    leading={
                      <Text textStyle={{ color: colors.textMuted, fontWeight: "600" }}>
                        {`${i + 1}`}
                      </Text>
                    }
                  >
                    <Text textStyle={{ fontWeight: "600" }}>{word}</Text>
                  </ListItem>
                ))}
                {!seedDone ? (
                  <ListItem
                    leading={<Icon name="checkmark.circle" size={22} color={colors.accent} />}
                    onPress={markSeedBackedUp}
                  >
                    <Text textStyle={{ color: colors.accent, fontWeight: "600" }}>
                      I’ve written it down
                    </Text>
                  </ListItem>
                ) : null}
                <FieldGroup.SectionFooter>
                  <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                    Write these 12 words down in order and keep them offline.
                    Anyone with them controls your handles.
                  </Text>
                </FieldGroup.SectionFooter>
              </>
            ) : (
              <>
                <ListItem
                  leading={
                    <Icon
                      name={seedDone ? "checkmark.circle.fill" : "eye"}
                      size={22}
                      color={seedDone ? colors.statusGreenFg : colors.textSecondary}
                    />
                  }
                  trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
                  onPress={reveal}
                >
                  <Text>{seedDone ? "Reveal seed phrase again" : "Reveal seed phrase"}</Text>
                </ListItem>
                <FieldGroup.SectionFooter>
                  <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                    The only thing that can restore control of your handles. Make
                    sure no one is watching your screen.
                  </Text>
                </FieldGroup.SectionFooter>
              </>
            )}
          </FieldGroup.Section>

          {/* ── 2 · Backup file ─────────────────────────────────────────────── */}
          <FieldGroup.Section title={fileSaved ? "2 · Backup file · saved" : "2 · Backup file"}>
            <ListItem
              leading={
                <Icon
                  name={fileSaved ? "checkmark.circle.fill" : "square.and.arrow.down"}
                  size={22}
                  color={fileSaved ? colors.statusGreenFg : colors.textSecondary}
                />
              }
              trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
              onPress={saving ? undefined : saveFile}
            >
              <Text>
                {saving ? "Saving…" : fileSaved ? "Save backup file again" : "Save backup file"}
              </Text>
            </ListItem>
            <FieldGroup.SectionFooter>
              <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                Records which handles you own and your certificates. Safe to store
                anywhere — it holds no private keys.
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>

          {/* ── Imported-handle warning ─────────────────────────────────────── */}
          {importedCount > 0 ? (
            <FieldGroup.Section title="Imported handles">
              <ListItem
                leading={<Icon name="exclamationmark.triangle.fill" size={20} color={colors.statusAmberFg} />}
              >
                <Text textStyle={{ color: colors.textSecondary }}>
                  {`${importedCount} imported handle${importedCount === 1 ? "" : "s"}: the private key you imported isn’t in this backup or your seed. Keep that key safe separately, or you won’t be able to restore ${importedCount === 1 ? "it" : "them"}.`}
                </Text>
              </ListItem>
            </FieldGroup.Section>
          ) : null}
        </FieldGroup>
      </Host>
      <ActionFooter primary={{ label: "Done", onPress: () => router.back() }} />
    </>
  );
}