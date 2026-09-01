import React, { useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/ui/Button";
import Svg, { SvgXml, Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { Link, KeyRound } from "@/ui/icons";
import { AtbitcoinLogo } from "@/ui/AtbitcoinLogo";
import { SampleProfileCard } from "@/ui/SampleProfileCard";
import { useStore } from "@/Store";
import { generateMnemonic, xprvFromMnemonic } from "@/keys";
import { Colors, useTheme, CONTENT_MAX_WIDTH } from "@/theme";


const DARK_LOGO = `<svg width="245" height="140" viewBox="0 0 245 140" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M36.239 21.244C31.0838 9.82436 41.3339 -2.52292 53.5024 0.448335L179.208 31.1425C190.465 33.8911 194.511 47.8102 186.482 56.1681L110.391 135.379C103.02 143.052 90.2317 140.848 85.8535 131.149L36.239 21.244Z" fill="#FF7B00"/>
<path d="M5.9383 50.729C7.25191 50.729 8.56535 51.0452 10.2993 52.6219L31.8453 71.9672V51.3083H41.7776V80.4304C41.7774 85.1086 38.9388 87.0528 35.7859 87.0528C34.4198 87.0528 33.1062 86.738 31.4249 85.1613L9.87892 65.816V86.4748H0V57.3007C0 52.6222 2.83786 50.729 5.9383 50.729Z" fill="#FFFFFF"/>
<path d="M135.944 60.455H119.653C113.768 60.4552 109.354 63.9764 109.354 69.0224C109.354 74.0162 113.715 77.4334 119.653 77.4336H142.933L135.944 86.4748H119.653C107.462 86.4746 98.4756 78.7477 98.4756 68.5499C98.4756 58.2468 107.462 51.3085 119.653 51.3083H142.933L135.944 60.455Z" fill="#FFFFFF"/>
<path d="M157.64 63.7656H178.555V51.3083H189.38V86.4748H178.555V72.9123H157.64V86.4748H146.709V51.3083H157.64V63.7656Z" fill="#FFFFFF"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M219.304 87.0528C202.173 87.0527 193.608 81.4284 193.608 68.8649C193.608 56.3016 202.173 50.7291 219.304 50.729C236.435 50.7291 245 56.3016 245 68.8649C245 81.4284 236.435 87.0527 219.304 87.0528ZM204.433 68.8649C204.433 61.2956 208.374 59.8757 219.304 59.8757C230.234 59.8757 234.175 61.2956 234.175 68.8649C234.175 76.4345 230.234 77.9061 219.304 77.9061C208.374 77.9061 204.433 76.4345 204.433 68.8649Z" fill="#FFFFFF"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M48.7224 77.8447L65.1481 54.6723C66.589 52.6647 68.6812 50.7314 71.9792 50.7314C75.2771 50.7314 77.3693 52.6647 78.8102 54.6723L95.2359 77.8447C97.8025 81.4653 95.2145 86.4748 90.7775 86.4748H53.1809C48.7438 86.4748 46.1558 81.4653 48.7224 77.8447ZM61.8707 77.4336L71.9792 63.1355L82.0876 77.4336H61.8707Z" fill="#FFFFFF"/>
</svg>`;

const LIGHT_LOGO = `<svg width="245" height="140" viewBox="0 0 245 140" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M36.239 21.244C31.0838 9.82436 41.3339 -2.52292 53.5024 0.448335L179.208 31.1425C190.465 33.8911 194.511 47.8102 186.482 56.1681L110.391 135.379C103.02 143.052 90.2317 140.848 85.8535 131.149L36.239 21.244Z" fill="#FF7B00"/>
<path d="M5.9383 50.729C7.25191 50.729 8.56535 51.0452 10.2993 52.6219L31.8453 71.9672V51.3083H41.7776V80.4304C41.7774 85.1086 38.9388 87.0528 35.7859 87.0528C34.4198 87.0528 33.1062 86.738 31.4249 85.1613L9.87892 65.816V86.4748H0V57.3007C0 52.6222 2.83786 50.729 5.9383 50.729Z" fill="#252422"/>
<path d="M135.944 60.455H119.653C113.768 60.4552 109.354 63.9764 109.354 69.0224C109.354 74.0162 113.715 77.4334 119.653 77.4336H142.933L135.944 86.4748H119.653C107.462 86.4746 98.4756 78.7477 98.4756 68.5499C98.4756 58.2468 107.462 51.3085 119.653 51.3083H142.933L135.944 60.455Z" fill="#252422"/>
<path d="M157.64 63.7656H178.555V51.3083H189.38V86.4748H178.555V72.9123H157.64V86.4748H146.709V51.3083H157.64V63.7656Z" fill="#252422"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M219.304 87.0528C202.173 87.0527 193.608 81.4284 193.608 68.8649C193.608 56.3016 202.173 50.7291 219.304 50.729C236.435 50.7291 245 56.3016 245 68.8649C245 81.4284 236.435 87.0527 219.304 87.0528ZM204.433 68.8649C204.433 61.2956 208.374 59.8757 219.304 59.8757C230.234 59.8757 234.175 61.2956 234.175 68.8649C234.175 76.4345 230.234 77.9061 219.304 77.9061C208.374 77.9061 204.433 76.4345 204.433 68.8649Z" fill="#252422"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M48.7224 77.8447L65.1481 54.6723C66.589 52.6647 68.6812 50.7314 71.9792 50.7314C75.2771 50.7314 77.3693 52.6647 78.8102 54.6723L95.2359 77.8447C97.8025 81.4653 95.2145 86.4748 90.7775 86.4748H53.1809C48.7438 86.4748 46.1558 81.4653 48.7224 77.8447ZM61.8707 77.4336L71.9792 63.1355L82.0876 77.4336H61.8707Z" fill="#252422"/>
<g filter="url(#filter0_d_1_946)">
<path d="M135.577 60.7236H119.286C113.401 60.7238 108.987 64.245 108.987 69.291C108.987 74.2847 113.348 77.702 119.286 77.7021H142.565L135.577 86.7432H119.286C107.094 86.743 98.1079 79.0163 98.1079 68.8184C98.1079 58.5153 107.094 51.5773 119.286 51.5771H142.565L135.577 60.7236ZM157.272 64.0342H178.187V51.5771H189.012V52.1758C188.329 53.6892 187.369 55.1307 186.115 56.4365L170.03 73.1807H157.272V86.4609L157.001 86.7432H146.341V51.5771H157.272V64.0342ZM71.6118 51C74.9095 51.0001 77.002 52.9329 78.4429 54.9404L94.8687 78.1133C97.435 81.7339 94.8466 86.7432 90.4097 86.7432H65.3188L56.3374 66.8506L64.7808 54.9404C66.2216 52.933 68.3141 51 71.6118 51ZM61.5034 77.7021H81.7202L71.6118 63.4043L61.5034 77.7021Z" fill="white"/>
</g>
<defs>
<filter id="filter0_d_1_946" x="52.3374" y="51" width="140.675" height="43.7432" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dy="4"/>
<feGaussianBlur stdDeviation="2"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1_946"/>
<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_1_946" result="shape"/>
</filter>
</defs>
</svg>`;

// A single warm radial wash from the top, behind everything (onboard.html "The
// glow"): brand orange at 10% fading to transparent by ~68% of the radius. A
// gradient, not glass — glass has nothing to sample on a near-black screen and
// degrades badly below iOS 26 / on Android. Non-interactive, doesn't scroll.
function Glow() {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="onboardGlow" cx="50%" cy="4%" rx="78%" ry="52%">
          <Stop offset="0" stopColor="#FF7B00" stopOpacity={0.1} />
          <Stop offset="0.68" stopColor="#FF7B00" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#onboardGlow)" />
    </Svg>
  );
}

// `preview` renders the exact screen for design review (from Settings) without
// side effects — the buttons just dismiss instead of creating/restoring a
// keystore, so it's safe to open while already configured.
export default function Home({ preview = false }: { preview?: boolean }) {
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const { setupKeystore } = useStore();
  const [creating, setCreating] = useState(false);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const logoXml = scheme === "light" ? LIGHT_LOGO : DARK_LOGO;

  // "Get started" creates the keystore silently — no seed-phrase reveal/confirm
  // step. The seed is generated and stored securely (revealable + backup-able
  // later from Settings); we nudge the user to back it up after the fact to keep
  // onboarding frictionless. The root gate flips to the main app once
  // isConfigured is true.
  const createKeystore = async () => {
    setCreating(true);
    await new Promise((r) => setTimeout(r, 5));
    const phrase = generateMnemonic();
    await setupKeystore(xprvFromMnemonic(phrase), {}, phrase);
  };

  const bullet = (icon: React.ReactNode, text: string) => (
    <View style={styles.bullet}>
      <View style={styles.bulletIcon}>{icon}</View>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [pagerH, setPagerH] = useState(0);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  const goToProfile = () => scrollRef.current?.scrollTo({ x: width, animated: true });

  const dots = (
    <View style={styles.dots}>
      <View style={[styles.dot, page === 0 && styles.dotOn]} />
      <View style={[styles.dot, page === 1 && styles.dotOn]} />
    </View>
  );

  const pageStyle = [styles.page, { width, height: pagerH || undefined }];
  const pad = { paddingTop: insets.top, paddingBottom: insets.bottom + 12 };
  // Equal vertical rhythm between logo → field → title → bullets → button.
  const GAP = 28;

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onLayout={(e) => setPagerH(e.nativeEvent.layout.height)}
        style={styles.pager}
      >
        {/* ── Screen 1: what it is. One even rhythm — equal GAP between logo →
            field → title/desc → bullets → button. A top spacer keeps the logo at
            its height while the stack is bottom-anchored. ──────────────────── */}
        <View style={[pageStyle, pad]}>
          {/* Warm glow behind screen 1 only — screen 2's card carries its own
              gradient, so a page-level wash there would double up. */}
          <Glow />
          {/* Cap the content column on wide screens (iPad) so it reads as an
              intentional centered layout instead of edge-to-edge stretch. No-op
              on phones (their width is below the cap). */}
          <View style={styles.pageInner}>
          {/* Two equal spacers center the logo between the top and the field;
              the field-through-button stack below keeps the even GAP rhythm and
              is bottom-anchored. */}
          <View style={styles.spacer} />
          <SvgXml xml={logoXml} width={152} height={87} style={styles.logo} />
          <View style={styles.spacer} />

          {/* Address field — "your | @bitcoin". Not a real input: the static
              caret after "your" invites the reader to imagine typing their own
              name, and teaches the @bitcoin syntax before the headline. */}
          <View
            style={[
              styles.field,
              // The default `border` token (#E5E7EA) is nearly invisible on the
              // light grey screen (#F2F2F7). Use the slightly stronger chevron
              // grey in light so the field reads as a bordered input; dark is fine.
              scheme === "light" && { borderColor: colors.chevron, borderWidth: 1 },
            ]}
          >
            <Text style={styles.fieldYour}>your</Text>
            <View style={styles.caret} />
            <View style={styles.fieldMark}>
              <AtbitcoinLogo height={20} color={colors.accent} />
            </View>
          </View>

          <View style={[styles.copy, { marginTop: GAP }]}>
            <Text style={styles.headline}>Own your{"\n"}internet address</Text>
            <Text style={styles.lede}>One handle for everything you want found.</Text>
          </View>

          <View style={[styles.bullets, { marginTop: GAP }]}>
            {bullet(
              <Link size={18} color={colors.textMuted} />,
              "For your socials, your keys and getting paid.",
            )}
            {bullet(
              <KeyRound size={18} color={colors.textMuted} />,
              "Can't be closed or taken down. Not even by us.",
            )}
          </View>

          <View style={[styles.actions, { marginTop: GAP }]}>
            <Button text="Continue" onPress={goToProfile} type="main" />
            <Button
              text="Restore from backup"
              onPress={
                preview
                  ? () => router.back()
                  : () => router.push("/(onboarding)/import-keystore")
              }
              type="secondary"
            />
          </View>
          {dots}
          </View>
        </View>

        {/* ── Screen 2: what it does — a native, self-verified profile. Mirrors
            screen 1: the figure (card) up top, the copy bottom-weighted by the
            button. ─────────────────────────────────────────────────────────── */}
        <View style={[pageStyle, pad]}>
          <View style={styles.pageInner}>
          <View style={styles.spacer} />
          <View style={styles.cardWrap}>
            <SampleProfileCard />
          </View>
          {/* Copy sits just under the preview (modest gap); the spacer below it
              keeps the button at the bottom. */}
          <View style={[styles.page2Head, { marginTop: GAP }]}>
            <Text style={styles.headline2}>
                Look up anyone.{"\n"}Verified on your phone.
            </Text>
            <Text style={styles.lede}>No company decides who's real — your phone checks the proof itself.</Text>
          </View>
          <View style={[styles.spacer, { flex: 2 }]} />
          <View style={styles.actions}>
            <Button
              text={creating ? "Creating…" : "Get started"}
              onPress={preview ? () => router.back() : createKeystore}
              type="main"
              disabled={creating}
            />
          </View>
          {dots}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    pager: {
      flex: 1,
    },
    page: {
      flexDirection: "column",
    },
    // Cap the content column so onboarding reads as an intentional centered
    // layout on iPad rather than a stretched phone screen. On phones the window
    // is narrower than the cap, so alignSelf:center + maxWidth is a no-op.
    pageInner: {
      flex: 1,
      width: "100%",
      maxWidth: CONTENT_MAX_WIDTH,
      alignSelf: "center",
    },
    actions: {
      paddingHorizontal: 20,
    },
    copy: {
      paddingHorizontal: 20,
    },
    page2Head: {
      paddingHorizontal: 20,
    },
    cardWrap: {
      paddingHorizontal: 20,
    },
    dots: {
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
      paddingTop: 14,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.textMuted,
      opacity: 0.4,
    },
    dotOn: {
      backgroundColor: c.text,
      opacity: 1,
    },
    spacer: {
      flex: 1,
    },
    logo: {
      alignSelf: "center",
    },
    block: {
      alignItems: "flex-start",
      paddingHorizontal: 20,
      paddingBottom: 4,
    },
    field: {
      marginHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: 14,
      borderCurve: "continuous",
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    fieldYour: {
      fontSize: 21,
      fontWeight: "600",
      color: c.textMuted,
      letterSpacing: -0.4,
    },
    caret: {
      width: 2,
      height: 22,
      borderRadius: 1,
      backgroundColor: c.accent,
      marginLeft: 1,
    },
    fieldMark: {
      marginLeft: "auto",
    },
    headline: {
      fontSize: 30,
      fontWeight: "700",
      color: c.text,
      letterSpacing: -0.8,
      lineHeight: 34,
    },
    headline2: {
      fontSize: 28,
      fontWeight: "700",
      color: c.text,
      letterSpacing: -0.7,
      lineHeight: 32,
    },
    lede: {
      fontSize: 16,
      color: c.textSecondary,
      marginTop: 12,
      lineHeight: 22,
    },
    bullets: {
      paddingHorizontal: 20,
    },
    bullet: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 11,
      paddingVertical: 5,
    },
    bulletIcon: {
      width: 20,
      alignItems: "center",
      marginTop: 2,
    },
    bulletText: {
      flex: 1,
      fontSize: 14,
      color: c.textMuted,
      lineHeight: 20,
    },
  });
