import React, { useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter, Stack } from "expo-router";
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
import { useTheme } from "@/theme";
import { useRecordsDraft } from "@/RecordsDraft";
import { lookupRecord } from "@/recordRegistry";
import { sfFor } from "@/ui/handleProfileNative";

// One editable field, extracted so useNativeState is called once per component
// (a hook can't run in a loop). It owns its native text state and reports each
// change up to the parent's values map; the parent only tracks a list of ids.
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
          <Icon
            name="minus.circle.fill"
            size={20}
            color={removeColor}
            onPress={onRemove}
          />
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

export default function EditRecord() {
  const router = useRouter();
  const navigation = useNavigation();
  const { scheme, colors } = useTheme();
  const params = useLocalSearchParams<{
    handle: string;
    index?: string;
    rtype?: string;
    key?: string;
  }>();
  const handle = params.handle;
  const index =
    params.index !== undefined && params.index !== ""
      ? Number(params.index)
      : undefined;
  const { getRecords, setRecord, deleteRecord } = useRecordsDraft();

  const existing = index !== undefined ? getRecords(handle)[index] : undefined;
  const presetType = existing?.type ?? (params.rtype as "addr" | "txt" | undefined);
  const presetKey = existing?.key ?? params.key;
  const { def, known } =
    presetType && presetKey
      ? lookupRecord(presetType, presetKey)
      : { def: null, known: false };
  const useSlots = !!def && known;

  // Current text per field id (seeded with initials, updated via onChangeText).
  const values = useRef<Map<string, string>>(new Map());
  const idCounter = useRef(0);
  const mkId = () => `v${idCounter.current++}`;

  const initVals = existing?.value ?? [];

  // ── Known-type slots ────────────────────────────────────────────────────
  const singleSlots = useMemo(
    () =>
      def
        ? def.slots.map((s, i) => ({ s, i })).filter((x) => !x.s.multi)
        : [],
    [def],
  );
  const multiSlotIdx = def ? def.slots.findIndex((s) => s.multi) : -1;
  const multiSlot = multiSlotIdx >= 0 ? def!.slots[multiSlotIdx] : null;
  const multiStart = multiSlotIdx >= 0 ? multiSlotIdx : def ? def.slots.length : 0;

  const [multiIds, setMultiIds] = useState<string[]>(() => {
    if (!multiSlot) return [];
    const seeded = initVals.slice(multiStart);
    return (seeded.length ? seeded : multiSlot.optional ? [] : [""]).map(() => mkId());
  });

  // ── Freeform (Other / unknown) ──────────────────────────────────────────
  const [ftype, setFtype] = useState<string>((presetType ?? "addr").toUpperCase());
  const [valueIds, setValueIds] = useState<string[]>(() =>
    (initVals.length ? initVals : [""]).map(() => mkId()),
  );

  // Seed the values map once, in field order.
  useMemo(() => {
    if (useSlots) {
      singleSlots.forEach(({ i }) => values.current.set(`s${i}`, initVals[i] ?? ""));
      const seeded = initVals.slice(multiStart);
      multiIds.forEach((id, k) => values.current.set(id, seeded[k] ?? ""));
    } else {
      values.current.set("key", presetKey ?? "");
      valueIds.forEach((id, k) => values.current.set(id, initVals[k] ?? ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (id: string) => (t: string) => values.current.set(id, t);

  // After adding a NEW record we came via the Add-record picker, so pop past it
  // too (back → the handle, not the picker). Editing an existing record was
  // pushed straight from the handle, so a single back is right.
  const done = () => {
    const nav = navigation as unknown as { pop?: (n?: number) => void };
    if (index === undefined && typeof nav.pop === "function") nav.pop(2);
    else router.back();
  };

  const save = () => {
    if (useSlots && def) {
      const singles = singleSlots.map(({ i }) => (values.current.get(`s${i}`) ?? "").trim());
      const multis = multiIds
        .map((id) => (values.current.get(id) ?? "").trim())
        .filter(Boolean);
      // Validate required slots — the first slot may be the multi one (e.g. Note),
      // so don't assume singles[0] exists.
      const missing = singleSlots.find(({ s }, k) => !s.optional && !singles[k]);
      if (missing) {
        Alert.alert("Missing value", `Enter the ${missing.s.label.toLowerCase()}.`);
        return;
      }
      if (multiSlot && !multiSlot.optional && multis.length === 0) {
        Alert.alert("Missing value", `Enter the ${multiSlot.label.toLowerCase()}.`);
        return;
      }
      const clean = [...singles.filter(Boolean), ...multis];
      if (clean.length === 0) {
        Alert.alert("Missing value", "Enter a value.");
        return;
      }
      setRecord(handle, index ?? null, { type: def.rtype, key: def.key, value: clean });
    } else {
      const key = (values.current.get("key") ?? "").trim();
      const clean = valueIds
        .map((id) => values.current.get(id) ?? "")
        .map((v) => v.trim())
        .filter(Boolean);
      if (!key) return Alert.alert("Missing key", "Enter a key.");
      if (clean.length === 0) return Alert.alert("Missing value", "Enter at least one value.");
      setRecord(handle, index ?? null, {
        type: ftype.toLowerCase() as "txt" | "addr",
        key,
        value: clean,
      });
    }
    done();
  };

  const remove = () => {
    if (index !== undefined) deleteRecord(handle, index);
    router.back();
  };

  const addMulti = () => {
    const id = mkId();
    values.current.set(id, "");
    setMultiIds((ids) => [...ids, id]);
  };
  const removeMulti = (id: string) => {
    values.current.delete(id);
    setMultiIds((ids) => ids.filter((x) => x !== id));
  };
  const addValue = () => {
    const id = mkId();
    values.current.set(id, "");
    setValueIds((ids) => [...ids, id]);
  };
  const removeValue = (id: string) => {
    values.current.delete(id);
    setValueIds((ids) => ids.filter((x) => x !== id));
  };

  const title = useSlots && def ? def.label : index !== undefined ? "Edit record" : "Add record";
  const headerItems: NativeStackHeaderItem[] = [
    { type: "button", label: "Save", tintColor: colors.text, onPress: save },
  ];

  return (
    <>
      <Stack.Screen
        options={{ title, unstable_headerRightItems: () => headerItems }}
      />
      <Host style={{ flex: 1 }} colorScheme={scheme}>
        <FieldGroup>
          {useSlots && def ? (
            <>
              {/* Type header */}
              <FieldGroup.Section>
                <ListItem leading={<Icon name={sfFor(def.key)} size={24} color={def.color} />}>
                  <Text>{def.label}</Text>
                </ListItem>
              </FieldGroup.Section>

              {singleSlots.map(({ s, i }) => (
                <FieldGroup.Section
                  key={`s${i}`}
                  title={s.optional ? `${s.label} · optional` : s.label}
                >
                  <Field
                    initial={initVals[i] ?? ""}
                    placeholder={s.placeholder ?? s.label}
                    onChangeText={set(`s${i}`)}
                    removeColor={colors.danger}
                  />
                </FieldGroup.Section>
              ))}

              {multiSlot ? (
                <FieldGroup.Section
                  title={multiSlot.optional ? `${multiSlot.label} · optional` : multiSlot.label}
                >
                  {multiIds.map((id, k) => (
                    <Field
                      key={id}
                      initial={initVals[multiStart + k] ?? ""}
                      placeholder={multiSlot.placeholder ?? multiSlot.label}
                      onChangeText={set(id)}
                      onRemove={multiIds.length > 1 || multiSlot.optional ? () => removeMulti(id) : undefined}
                      removeColor={colors.danger}
                    />
                  ))}
                  <ListItem
                    leading={<Icon name="plus.circle.fill" size={20} color={colors.textSecondary} />}
                    onPress={addMulti}
                  >
                    <Text textStyle={{ color: colors.text }}>
                      {`Add ${multiSlot.label.toLowerCase()}`}
                    </Text>
                  </ListItem>
                </FieldGroup.Section>
              ) : null}
            </>
          ) : (
            <>
              {/* Freeform "Other" record */}
              <FieldGroup.Section title="Type">
                <Picker
                  selectedValue={ftype}
                  onValueChange={(v) => setFtype(v)}
                >
                  <Picker.Item label="Address" value="ADDR" />
                  <Picker.Item label="Text" value="TXT" />
                </Picker>
              </FieldGroup.Section>
              <FieldGroup.Section title="Key">
                <Field
                  initial={presetKey ?? ""}
                  placeholder="e.g. age"
                  onChangeText={set("key")}
                  removeColor={colors.danger}
                />
              </FieldGroup.Section>
              <FieldGroup.Section title="Values">
                {valueIds.map((id, k) => (
                  <Field
                    key={id}
                    initial={initVals[k] ?? ""}
                    placeholder="value"
                    onChangeText={set(id)}
                    onRemove={valueIds.length > 1 ? () => removeValue(id) : undefined}
                    removeColor={colors.danger}
                  />
                ))}
                <ListItem
                  leading={<Icon name="plus.circle.fill" size={20} color={colors.textSecondary} />}
                  onPress={addValue}
                >
                  <Text textStyle={{ color: colors.text }}>Add value</Text>
                </ListItem>
              </FieldGroup.Section>
            </>
          )}

          {index !== undefined ? (
            <FieldGroup.Section>
              <ListItem
                leading={<Icon name="trash" size={22} color={colors.danger} />}
                onPress={remove}
              >
                <Text textStyle={{ color: colors.danger }}>Delete record</Text>
              </ListItem>
            </FieldGroup.Section>
          ) : null}
        </FieldGroup>
      </Host>
    </>
  );
}
