import React, { useMemo, useRef, useState } from "react";
import { Stack } from "expo-router";
import type { NativeStackHeaderItem } from "@react-navigation/native-stack";
import {
  Host,
  FieldGroup,
  ListItem,
  Icon,
  Text,
  TextInput,
  Picker,
  useNativeState,
} from "@expo/ui";
import { ThemeMode, useTheme } from "@/theme";
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
  const { scheme, colors, mode, setMode } = useTheme();
  const conf = useMemo(() => getNetConfig(), []);

  const values = useRef<Map<string, string>>(new Map());
  const idc = useRef(0);
  const mk = () => `f${idc.current++}`;

  const [relayIds, setRelayIds] = useState<string[]>(() =>
    (conf.anchorRelays.length ? conf.anchorRelays : [""]).map(() => mk()),
  );
  const [seedIds, setSeedIds] = useState<string[]>(() =>
    (conf.seeds.length ? conf.seeds : [""]).map(() => mk()),
  );
  const [ver, setVer] = useState(0); // bump to remount fields (reset)
  const [savedTick, setSavedTick] = useState(false);

  // Seed the values map once (and re-seed on reset via the ver bump path).
  useMemo(() => {
    values.current.set("api", conf.apiUrl);
    relayIds.forEach((id, i) => values.current.set(id, conf.anchorRelays[i] ?? ""));
    seedIds.forEach((id, i) => values.current.set(id, conf.seeds[i] ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (id: string) => (t: string) => values.current.set(id, t);
  const clean = (ids: string[]) =>
    ids.map((id) => (values.current.get(id) ?? "").trim()).filter(Boolean);

  const onSave = async () => {
    await saveNetConfig({
      anchorRelays: clean(relayIds),
      seeds: clean(seedIds),
      apiUrl: (values.current.get("api") ?? "").trim(),
    });
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1600);
  };

  const onReset = () => {
    values.current.clear();
    values.current.set("api", DEFAULT_NET_CONFIG.apiUrl);
    const rids = (DEFAULT_NET_CONFIG.anchorRelays.length
      ? DEFAULT_NET_CONFIG.anchorRelays
      : [""]
    ).map(() => mk());
    const sids = (DEFAULT_NET_CONFIG.seeds.length ? DEFAULT_NET_CONFIG.seeds : [""]).map(
      () => mk(),
    );
    rids.forEach((id, i) => values.current.set(id, DEFAULT_NET_CONFIG.anchorRelays[i] ?? ""));
    sids.forEach((id, i) => values.current.set(id, DEFAULT_NET_CONFIG.seeds[i] ?? ""));
    setRelayIds(rids);
    setSeedIds(sids);
    setVer((v) => v + 1);
  };

  const addRelay = () => {
    const id = mk();
    values.current.set(id, "");
    setRelayIds((ids) => [...ids, id]);
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

  const headerItems: NativeStackHeaderItem[] = [
    {
      type: "button",
      label: savedTick ? "Saved ✓" : "Save",
      tintColor: colors.text,
      onPress: onSave,
    },
  ];

  return (
    <>
      <Stack.Screen options={{ unstable_headerRightItems: () => headerItems }} />
      <Host style={{ flex: 1 }} colorScheme={scheme}>
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

          <FieldGroup.Section title="Anchor relays">
            {relayIds.map((id, i) => (
              <Field
                key={`${ver}:${id}`}
                initial={values.current.get(id) ?? ""}
                placeholder="https://…"
                onChangeText={set(id)}
                onRemove={relayIds.length > 1 ? () => removeId(id, setRelayIds) : undefined}
                removeColor={colors.danger}
              />
            ))}
            <ListItem
              leading={<Icon name="plus.circle.fill" size={20} color={colors.textSecondary} />}
              onPress={addRelay}
            >
              <Text textStyle={{ color: colors.text }}>Add relay</Text>
            </ListItem>
          </FieldGroup.Section>

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
        </FieldGroup>
      </Host>
    </>
  );
}
