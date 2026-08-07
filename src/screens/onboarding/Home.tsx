import React, { useMemo } from "react";
import { View, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/ui/Button";
import { Layout } from "@/ui/Layout";
import { AtbitcoinLogo } from "@/ui/AtbitcoinLogo";
import { SvgXml } from "react-native-svg";
import { Colors, useTheme } from "@/theme";


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

export default function () {
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const logoXml = scheme === "light" ? LIGHT_LOGO : DARK_LOGO;
  return (
    <Layout
      scrollable={false}
      footer={
        <>
          <Button
            text="Create a new keystore"
            onPress={() => router.push("/(onboarding)/show-mnemonic")}
            type="main"
          />
          <Button
            text="Restore from backup"
            onPress={() => router.push("/(onboarding)/import-keystore")}
            type="secondary"
          />
        </>
      }
    >
      <View style={styles.content}>
        <SvgXml xml={logoXml} width={280} height={160} />
        <View style={styles.headerContainer}>
          <View style={styles.ownRow}>
            <Text style={styles.ownText}>Own </Text>
            <AtbitcoinLogo height={20} />
          </View>
          <Text style={styles.tagline}>Self-custodial handles for Bitcoin.</Text>
        </View>
      </View>
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    content: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    headerContainer: {
      alignItems: "center",
      marginBottom: 48,
    },
    ownRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    ownText: {
      fontSize: 20,
      fontWeight: "400",
      color: c.text,
    },
    tagline: {
      fontSize: 15,
      color: c.textSecondary,
      marginTop: 14,
      textAlign: "center",
    },
  });
