import React, { useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import type { NativeStackHeaderItem } from "@react-navigation/native-stack";
import {
  Host,
  TextInput,
  Picker,
  useNativeState,
} from "@expo/ui";
import { FieldGroup } from "@/ui/fieldGroup";
import { Text } from "@/ui/text";
import { ListItem } from "@/ui/listItem";
import { Icon } from "@/ui/icon";
import { useStore } from "@/Store";
import { recordsSet } from "@/db";
import { ThemeMode, useTheme, boundedHost } from "@/theme";
import { headerRightItemsOption } from "@/ui/androidHeaderItems";
import {
  getNetConfig,
  saveNetConfig,
  DEFAULT_NET_CONFIG,
} from "@/config";

const MODES: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

// One text field owning its own native state (see EditRecord for the pattern):
// a hook can't run in a loop, so each row is its own component.
function Field({
  initial,
  placeholder,
  onChangeText,
  onRemove,
  removeColor,
}: {
  initial: string;
  placeholder?: string;
  onChangeText: (t: string) => void;
  onRemove?: () => void;
  removeColor: string;
}) {
  const text = useNativeState(initial);
  return (
    <ListItem
      trailing={
        onRemove ? (
          <Icon name="minus.circle.fill" size={20} color={removeColor} onPress={onRemove} />
        ) : undefined
      }
    >
      <TextInput
        value={text}
        placeholder={placeholder}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </ListItem>
  );
}

export default function Preferences() {
  const router = useRouter();
  const { scheme, colors, mode, setMode } = useTheme();
  const { wipeEverything, createHandle, setHandlePurchase, setHandleOnboarded } =
    useStore();

  // Seed a couple of local @example handles with rich records for screenshots.
  // Reuses the @example demo bypass (no cert/network), so this only ever touches
  // demo handles. Records go straight into the local cache the manage/resolve
  // views read from.
  const seedDemo = async () => {
    const seq = Math.floor(Date.now() / 1000);
    const demo: Record<string, { type: "txt" | "addr"; key: string; value: string[] }[]> = {
      "alice@example": [
        { type: "addr", key: "btc", value: ["bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"] },
        { type: "addr", key: "nostr", value: ["npub1sn0wdenkukak0d9dfczzeacvhkrgz92ak56egt7vdgzn8pv2wfqqhrjdv9"] },
        { type: "txt", key: "x", value: ["alice"] },
        { type: "txt", key: "instagram", value: ["alice"] },
        { type: "txt", key: "website", value: ["alice.com"] },
      ],
      "satoshi@example": [
        { type: "addr", key: "btc", value: ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"] },
        { type: "addr", key: "ln", value: ["lno1pg257enxv4ezqcneype82um50ynhxgrwdajx293pqglnyxw6q0hzngfdusg8umzuxe8kquuz7pjl90ldj8wadwgs0xlmc"] },
        { type: "txt", key: "bluesky", value: ["satoshi.bsky.social"] },
        { type: "txt", key: "github", value: ["satoshi"] },
      ],
    };
    for (const [h, records] of Object.entries(demo)) {
      await createHandle(h);
      await setHandlePurchase(h, { amountCents: 900 });
      await setHandleOnboarded(h, true);
      await recordsSet(h, JSON.stringify({ records, seq }), Date.now());
    }
    Alert.alert(
      "Demo data seeded",
      "alice@example and satoshi@example added with records. Resolve either handle or open it from the list.",
    );
  };
  const conf = useMemo(() => getNetConfig(), []);

  // Dev/testing: wipe the keystore + all handles and reset to onboarding. The
  // root gate swaps to the onboarding stack automatically once xpub is cleared.
  const confirmWipe = () => {
    Alert.alert(
      "Delete everything?",
      "Erases this keystore, all handles, records and the backup reminder from this device, resetting the app to onboarding. Back up your seed phrase first if you want to restore it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: () => {
            void wipeEverything();
          },
        },
      ],
    );
  };

  const values = useRef<Map<string, string>>(new Map());
  const idc = useRef(0);
  const mk = () => `f${idc.current++}`;

  const [seedIds, setSeedIds] = useState<string[]>(() =>
    (conf.seeds.length ? conf.seeds : [""]).map(() => mk()),
  );
  const [ver, setVer] = useState(0); // bump to remount fields (reset)
  const [savedTick, setSavedTick] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false); // collapse noise
  const [, bump] = useState(0); // force a re-render so "Save" can react to edits
  // Signature of the last-saved config, so "Save" only shows when the editor
  // has unsaved changes (the fields are uncontrolled, hence the manual compare).
  const savedSig = useRef<string>("");

  const clean = (ids: string[]) =>
    ids.map((id) => (values.current.get(id) ?? "").trim()).filter(Boolean);
  const cfgSig = (seeds: string[], api: string) =>
    JSON.stringify({ seeds, api: api.trim() });

  // Seed the values map once (and re-seed on reset via the ver bump path).
  useMemo(() => {
    values.current.set("api", conf.apiUrl);
    seedIds.forEach((id, i) => values.current.set(id, conf.seeds[i] ?? ""));
    savedSig.current = cfgSig(conf.seeds.map((s) => s.trim()).filter(Boolean), conf.apiUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (id: string) => (t: string) => {
    values.current.set(id, t);
    bump((x) => x + 1);
  };

  const onSave = async () => {
    // Anchor relays are edited on the Trust page now — preserve whatever is
    // currently configured so saving here doesn't wipe them.
    const seeds = clean(seedIds);
    const apiUrl = (values.current.get("api") ?? "").trim();
    await saveNetConfig({
      anchorRelays: getNetConfig().anchorRelays,
      seeds,
      apiUrl,
    });
    savedSig.current = cfgSig(seeds, apiUrl);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1600);
  };

  const onReset = () => {
    values.current.clear();
    values.current.set("api", DEFAULT_NET_CONFIG.apiUrl);
    const sids = (DEFAULT_NET_CONFIG.seeds.length ? DEFAULT_NET_CONFIG.seeds : [""]).map(
      () => mk(),
    );
    sids.forEach((id, i) => values.current.set(id, DEFAULT_NET_CONFIG.seeds[i] ?? ""));
    setSeedIds(sids);
    setVer((v) => v + 1);
  };

  const addSeed = () => {
    const id = mk();
    values.current.set(id, "");
    setSeedIds((ids) => [...ids, id]);
  };
  const removeId = (
    id: string,
    setIds: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    values.current.delete(id);
    setIds((ids) => ids.filter((x) => x !== id));
  };

  const dirty =
    cfgSig(clean(seedIds), values.current.get("api") ?? "") !== savedSig.current;

  // Only surface "Save" when there are unsaved edits (or a save just landed, so
  // "Saved ✓" still flashes). Theme changes save immediately and don't count.
  const headerItems: NativeStackHeaderItem[] =
    dirty || savedTick
      ? [
          {
            type: "button",
            label: savedTick ? "Saved ✓" : "Save",
            tintColor: colors.text,
            onPress: onSave,
          },
        ]
      : [];

  return (
    <>
      <Stack.Screen options={{ ...headerRightItemsOption(headerItems, colors.text) }} />
      <Host style={boundedHost} colorScheme={scheme}>
        <FieldGroup>
          <FieldGroup.Section title="Appearance">
            <Picker
              appearance="menu"
              selectedValue={mode}
              onValueChange={(v) => setMode(v as ThemeMode)}
            >
              {MODES.map((m) => (
                <Picker.Item key={m.id} label={m.label} value={m.id} />
              ))}
            </Picker>
          </FieldGroup.Section>

          <FieldGroup.Section title="Keystore">
            <ListItem
              leading={<Icon name="checkmark.shield" size={22} color={colors.textSecondary} />}
              trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
              onPress={() => router.push("/(main)/backup")}
            >
              <Text>Back up</Text>
            </ListItem>
            <FieldGroup.SectionFooter>
              <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                A complete backup is your seed phrase plus a backup file — you need
                both to restore. Your private key never leaves secure storage.
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>

          {/* Advanced — collapsed by default. Network config + dev/danger tools
              are noise for most users, so they live behind one tap. */}
          <FieldGroup.Section>
            <ListItem
              leading={<Icon name="slider.horizontal.3" size={22} color={colors.textSecondary} />}
              trailing={
                <Icon
                  name={advancedOpen ? "chevron.down" : "chevron.forward"}
                  size={14}
                  color={colors.chevron}
                />
              }
              onPress={() => setAdvancedOpen((o) => !o)}
            >
              <Text>Advanced</Text>
            </ListItem>
          </FieldGroup.Section>

          {advancedOpen ? (
            <>
              <FieldGroup.Section title="Certrelay seeds">
                {seedIds.map((id) => (
                  <Field
                    key={`${ver}:${id}`}
                    initial={values.current.get(id) ?? ""}
                    placeholder="https://…"
                    onChangeText={set(id)}
                    onRemove={seedIds.length > 1 ? () => removeId(id, setSeedIds) : undefined}
                    removeColor={colors.danger}
                  />
                ))}
                <ListItem
                  leading={<Icon name="plus.circle.fill" size={20} color={colors.textSecondary} />}
                  onPress={addSeed}
                >
                  <Text textStyle={{ color: colors.text }}>Add seed</Text>
                </ListItem>
                <FieldGroup.SectionFooter>
                  <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                    Used to bootstrap certrelays when the defaults are unreachable.
                  </Text>
                </FieldGroup.SectionFooter>
              </FieldGroup.Section>

              <FieldGroup.Section title="API URL">
                <Field
                  key={`${ver}:api`}
                  initial={values.current.get("api") ?? ""}
                  placeholder="https://…/api"
                  onChangeText={set("api")}
                  removeColor={colors.danger}
                />
              </FieldGroup.Section>

              <FieldGroup.Section>
                <ListItem
                  leading={<Icon name="arrow.counterclockwise" size={22} color={colors.danger} />}
                  onPress={onReset}
                >
                  <Text textStyle={{ color: colors.danger }}>Reset to defaults</Text>
                </ListItem>
              </FieldGroup.Section>

              {/* Debug tools — compiled out of release builds (__DEV__ is false
                  in production), so real users never see them. */}
              {__DEV__ ? (
                <FieldGroup.Section title="Debug">
                  <ListItem
                    leading={<Icon name="sparkles" size={22} color={colors.textSecondary} />}
                    trailing={<Icon name="chevron.forward" size={14} color={colors.chevron} />}
                    onPress={() => router.push("/(main)/onboarding-preview")}
                  >
                    <Text>Show onboarding</Text>
                  </ListItem>
                  <ListItem
                    leading={<Icon name="wand.and.stars" size={22} color={colors.textSecondary} />}
                    onPress={seedDemo}
                  >
                    <Text>Seed demo data (@example)</Text>
                  </ListItem>
                </FieldGroup.Section>
              ) : null}

              <FieldGroup.Section title="Danger zone">
                <ListItem
                  leading={<Icon name="trash.fill" size={22} color={colors.danger} />}
                  onPress={confirmWipe}
                >
                  <Text textStyle={{ color: colors.danger }}>Delete everything</Text>
                </ListItem>
                <FieldGroup.SectionFooter>
                  <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                    Erases this keystore and all handles from this device, resetting
                    the app to onboarding.
                  </Text>
                </FieldGroup.SectionFooter>
              </FieldGroup.Section>
            </>
          ) : null}
        </FieldGroup>
      </Host>
    </>
  );
}
