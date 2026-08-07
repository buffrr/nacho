import React from "react";
import { Stack, useRouter } from "expo-router";
import { Pressable, TouchableOpacity } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useTheme } from "@/theme";
import { Plus } from "@/ui/icons";

// The "+" (Register a handle) as a native headerRight button — a Liquid Glass
// circle on iOS 26, solid accent fallback elsewhere.
function AddButton() {
  const router = useRouter();
  const { colors } = useTheme();
  const onPress = () => router.push("/(main)/register-hub");
  const glyph = <Plus size={18} color={colors.accentText} />;
  const size = {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    overflow: "hidden" as const,
  };
  return isLiquidGlassAvailable() ? (
    <Pressable onPress={onPress} accessibilityLabel="Add handle">
      <GlassView
        style={size}
        glassEffectStyle="regular"
        isInteractive
        tintColor={colors.accent}
      >
        {glyph}
      </GlassView>
    </Pressable>
  ) : (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel="Add handle"
      style={[size, { backgroundColor: colors.accent }]}
    >
      {glyph}
    </TouchableOpacity>
  );
}

// Native large-title header → iOS 26 gives it the glass scroll-edge treatment
// that matches the tab bar (closes the flat-top / glass-bottom gap). Title/tint
// colors are set explicitly so the large title reads white in dark mode.
export default function HandlesTabLayout() {
  const { colors } = useTheme();
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Handles",
          headerLargeTitle: false,
          // Transparent header (the clean default); iOS applies its own subtle
          // scroll-edge as content scrolls under it. Just fix the title/tint to
          // read white in dark mode.
          headerTransparent: true,
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          headerRight: () => <AddButton />,
        }}
      />
    </Stack>
  );
}
