import React, { ReactNode } from "react";
import { View, StyleSheet } from "react-native";
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
}

export function Layout({
  children,
  footer,
  overlay = false,
  scrollable = true,
  padTop = false,
}: LayoutProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const topInset = padTop ? Math.max(insets.top, 20) : insets.top;

  const content = scrollable ? (
    <KeyboardAwareScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
    >
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
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
