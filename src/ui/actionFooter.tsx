import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/ui/Button";
import { useTheme } from "@/theme";

type Primary = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  type?: "main" | "danger";
};
type Secondary = { label: string; onPress: () => void; disabled?: boolean };

// A pinned bottom action bar for the native (@expo/ui Host) screens: the app's
// full-width Button as the primary CTA + an optional text secondary. Sits below
// the native content (a real full-width button reads better than a native
// borderedProminent button squeezed into a Form row).
//
// Keyboard-aware: native stack screens don't resize for the keyboard, so a
// pinned footer would otherwise sit BEHIND it (unreachable — the user can't tap
// the button, and on search screens the only way to dismiss the keyboard also
// navigates away). We lift the footer to just above the keyboard while it's up.
export function ActionFooter({
  primary,
  secondary,
}: {
  primary?: Primary;
  secondary?: Secondary;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, (e) =>
      setKbHeight(e.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // When the keyboard is up, pad the footer up by its height (the keyboard's own
  // inset already covers the home indicator). Otherwise use the safe-area inset.
  const paddingBottom = kbHeight > 0 ? kbHeight + 8 : insets.bottom + 8;

  return (
    <View style={[styles.footer, { paddingBottom, backgroundColor: colors.background }]}>
      {primary ? (
        <Button
          text={primary.label}
          onPress={primary.onPress}
          type={primary.type ?? "main"}
          disabled={primary.disabled}
        />
      ) : null}
      {secondary ? (
        <TouchableOpacity
          onPress={secondary.onPress}
          disabled={secondary.disabled}
          style={styles.secondary}
        >
          <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>
            {secondary.label}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingHorizontal: 20, paddingTop: 10 },
  secondary: { paddingVertical: 14, alignItems: "center" },
  secondaryText: { fontSize: 15, fontWeight: "500" },
});
