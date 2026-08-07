import React, { ReactNode } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";

interface LayoutProps {
  children: ReactNode;
  footer?: ReactNode;
  overlay?: boolean;
  scrollable?: boolean;
  // Headerless tab screens (no native nav header) need explicit top space to
  // clear the status bar / window edge. On native the safe-area inset already
  // covers this; on web there is no inset, so fall back to a fixed gap.
  padTop?: boolean;
  // A tab screen sitting under the floating native tab bar. iOS auto-insets the
  // scroll content via contentInsetAdjustmentBehavior; Android/web get an
  // explicit bottom pad so the last row clears the bar (intended under-glass scroll).
  tabBarInset?: boolean;
  // The screen has a native header above it (its top space is handled natively),
  // so skip the manual top padding. Pair with tabBarInset on transparent tab
  // headers to also enable automatic content-inset adjustment.
  underHeader?: boolean;
}

// Bottom padding for tab screens on platforms without automatic content-inset
// adjustment (Android/web). iOS handles it natively → 0.
const TAB_BAR_PAD = 64;

export function Layout({
  children,
  footer,
  overlay = false,
  scrollable = true,
  padTop = false,
  tabBarInset = false,
  underHeader = false,
}: LayoutProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const topInset = underHeader
    ? 0
    : padTop
      ? Math.max(insets.top, 20)
      : insets.top;
  // Auto content-inset only for the transparent tab headers (content scrolls
  // under them). Solid detail headers lay content below themselves, so it's off
  // there — otherwise it fights the keyboard-aware scroll view on forms.
  const autoInset = tabBarInset;
  const bottomPad =
    tabBarInset && Platform.OS !== "ios" ? insets.bottom + TAB_BAR_PAD : 0;

  const content = scrollable ? (
    <KeyboardAwareScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.scrollContent,
        bottomPad ? { paddingBottom: bottomPad } : null,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
      contentInsetAdjustmentBehavior={autoInset ? "automatic" : "never"}
    >
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <View style={[styles.content, bottomPad ? { paddingBottom: bottomPad } : null]}>
      {children}
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        { paddingTop: topInset, backgroundColor: colors.background },
      ]}
    >
      {overlay && (
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]} />
      )}
      {content}
      {footer && (
        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom, backgroundColor: colors.background },
          ]}
        >
          {footer}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  footer: {
    paddingTop: 20,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
});
