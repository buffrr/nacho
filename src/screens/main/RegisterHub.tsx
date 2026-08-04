import React, { useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { Colors, useTheme } from "@/theme";
import {
  Storefront,
  Ticket,
  Key,
  AtSign,
  ChevronRight,
  X,
  IconProps,
} from "@/ui/icons";

type Props = NativeStackScreenProps<HandlesStackParamList, "RegisterHub">;

export default function RegisterHub({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const translateY = useRef(new Animated.Value(height)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 24,
        stiffness: 240,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate the sheet down, then unmount and optionally run a follow-up (e.g.
  // navigate to the chosen flow) so the transition reads as one motion.
  const close = (after?: () => void) => {
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: height,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigation.goBack();
      after?.();
    });
  };

  const options: {
    title: string;
    subtitle: string;
    Icon: (p: IconProps) => React.JSX.Element;
    bg: string;
    go: () => void;
  }[] = [
    {
      title: "Shop for a handle",
      subtitle: "Browse and buy available handles",
      Icon: Storefront,
      bg: colors.tileOrangeBg,
      go: () => navigation.navigate("Shop"),
    },
    {
      title: "Redeem a code",
      subtitle: "Have a voucher or gift code",
      Icon: Ticket,
      bg: colors.tileLavenderBg,
      go: () => navigation.navigate("Redeem", {}),
    },
    {
      title: "Import private key",
      subtitle: "Already own a handle elsewhere",
      Icon: Key,
      bg: colors.tileTealBg,
      go: () => navigation.navigate("ImportKeypair", {}),
    },
    {
      title: "Create a request",
      subtitle: "Setup a key pair and create inclusion request",
      Icon: AtSign,
      bg: colors.tileGoldBg,
      go: () => navigation.navigate("CreateRequest", {}),
    },
  ];

  return (
    <View style={styles.root}>
      <Animated.View
        style={[styles.backdrop, { opacity: backdrop, backgroundColor: colors.overlay }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom + 20,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.grabber} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Register a handle</Text>
            <Text style={styles.subtitle}>
              Choose how you'd like to add a handle.
            </Text>
          </View>
          <TouchableOpacity onPress={() => close()} hitSlop={8} style={styles.closeBtn}>
            <X size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {options.map(({ title, subtitle, Icon, bg, go }) => (
          <TouchableOpacity
            key={title}
            style={styles.option}
            onPress={() => close(go)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconBox, { backgroundColor: bg }]}>
              <Icon size={26} color={colors.text} />
            </View>
            <View style={styles.optionMid}>
              <Text style={styles.optionTitle}>{title}</Text>
              <Text style={styles.optionSub}>{subtitle}</Text>
            </View>
            <ChevronRight size={18} color={colors.iconDefault} />
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    sheet: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    grabber: {
      alignSelf: "center",
      width: 40,
      height: 5,
      borderRadius: 999,
      backgroundColor: c.border,
      marginBottom: 18,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    headerText: {
      flex: 1,
      gap: 6,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: c.text,
    },
    subtitle: {
      fontSize: 15,
      color: c.textSecondary,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.field,
      alignItems: "center",
      justifyContent: "center",
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borderWarm,
      borderRadius: 18,
      padding: 14,
      marginBottom: 12,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    iconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    optionMid: {
      flex: 1,
      gap: 3,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: c.text,
    },
    optionSub: {
      fontSize: 13,
      color: c.textSecondary,
    },
  });
