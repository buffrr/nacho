import React, { useEffect, useState } from "react";
import { Host, FieldGroup, ListItem, Icon, Text } from "@expo/ui";
import { useStore } from "@/Store";
import { useTheme } from "@/theme";
import { NativeEmpty } from "@/ui/nativeEmpty";
import { ActionFooter } from "@/ui/actionFooter";

export default function RevealSeed() {
  const { getMnemonic } = useStore();
  const { scheme, colors } = useTheme();
  const [words, setWords] = useState<string[] | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let active = true;
    getMnemonic().then((m) => {
      if (active) setWords(m ? m.split(" ") : []);
    });
    return () => {
      active = false;
    };
  }, []);

  if (words !== null && words.length === 0) {
    return (
      <NativeEmpty
        sf="exclamationmark.triangle"
        title="No seed phrase stored"
        message="This keystore was set up without saving its seed phrase. Back it up with the keystore file from Settings instead."
      />
    );
  }

  return (
    <>
      <Host style={{ flex: 1 }} colorScheme={scheme}>
        <FieldGroup>
          {revealed && words ? (
            <FieldGroup.Section title="Your seed phrase">
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
              <FieldGroup.SectionFooter>
                <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                  Write these 12 words down in order and keep them offline. Anyone
                  with them controls your handles.
                </Text>
              </FieldGroup.SectionFooter>
            </FieldGroup.Section>
          ) : (
            <FieldGroup.Section>
              <ListItem leading={<Icon name="lock.fill" size={22} color={colors.textMuted} />}>
                <Text textStyle={{ color: colors.textSecondary }}>
                  Hidden until you reveal it
                </Text>
              </ListItem>
              <FieldGroup.SectionFooter>
                <Text textStyle={{ fontSize: 12, color: colors.textSecondary }}>
                  Anyone with your seed phrase controls your handles. Make sure
                  no one is watching your screen.
                </Text>
              </FieldGroup.SectionFooter>
            </FieldGroup.Section>
          )}
        </FieldGroup>
      </Host>
      {!revealed ? (
        <ActionFooter
          primary={{
            label: "Reveal seed phrase",
            onPress: () => setRevealed(true),
            disabled: words === null,
          }}
        />
      ) : null}
    </>
  );
}
