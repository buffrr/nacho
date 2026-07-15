import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HandlesMap, useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { SearchButton } from "@/ui/icons";
import OnboardingHome from "./screens/onboarding/Home";
import ShowMnemonic from "./screens/onboarding/ShowMnemonic";
import ImportKeystore from "./screens/onboarding/ImportKeystore";
import EnterMnemonic from "./screens/onboarding/EnterMnemonic";
import ListHandles from "./screens/main/ListHandles";
import ShowHandle from "./screens/main/ShowHandle";
import CreateRequest from "./screens/main/CreateRequest";
import ImportCertificate from "./screens/main/ImportCertificate";
import Settings from "./screens/main/Settings";
import Resolve from "./screens/main/Resolve";
import ImportKeypair from "./screens/main/ImportKeypair";
import Redeem from "./screens/main/Redeem";
import RevealSeed from "./screens/main/RevealSeed";

export type RootStackParamList = {
  Main: undefined;
  Onboarding: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

export type OnboardingStackParamList = {
  Home: undefined;
  ShowMnemonic: undefined;
  ImportKeystore: undefined;
  EnterMnemonic: { xpub: string; handles?: HandlesMap };
};

const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();

export type HandlesStackParamList = {
  ListHandles: undefined;
  ShowHandle: { handle: string };
  CreateRequest: { initialHandle?: string };
  ImportKeypair: { handle?: string };
  Redeem: { code?: string };
  ImportCertificate: { handle: string };
  Settings: undefined;
  Resolve: undefined;
  RevealSeed: undefined;
};

const HandlesStack = createNativeStackNavigator<HandlesStackParamList>();

const makeScreenOptions = (c: Colors) => ({
  headerShown: true,
  headerStyle: {
    backgroundColor: c.background,
  },
  headerTintColor: c.text,
  headerTitleStyle: {
    fontWeight: "600" as const,
    fontSize: 18,
  },
  headerBackTitleVisible: false,
  headerShadowVisible: false,
  contentStyle: {
    backgroundColor: c.background,
  },
});

function OnboardingNavigator() {
  const { colors } = useTheme();
  return (
    <OnboardingStack.Navigator screenOptions={makeScreenOptions(colors)}>
      <OnboardingStack.Screen
        name="Home"
        component={OnboardingHome}
        options={{ headerShown: false }}
      />
      <OnboardingStack.Screen
        name="ShowMnemonic"
        component={ShowMnemonic}
        options={{ title: "Seed Phrase" }}
      />
      <OnboardingStack.Screen
        name="ImportKeystore"
        component={ImportKeystore}
        options={{ title: "Keystore" }}
      />
      <OnboardingStack.Screen
        name="EnterMnemonic"
        component={EnterMnemonic}
        options={{ title: "Seed Phrase" }}
      />
    </OnboardingStack.Navigator>
  );
}

function MainNavigator() {
  const { colors } = useTheme();
  return (
    <HandlesStack.Navigator
      screenOptions={makeScreenOptions(colors)}
      initialRouteName="ListHandles"
    >
      <HandlesStack.Screen
        name="ListHandles"
        component={ListHandles}
        options={({ navigation }) => ({
          title: "Handles",
          headerRight: () => (
            <SearchButton onPress={() => navigation.navigate("Resolve")} />
          ),
        })}
      />
      <HandlesStack.Screen
        name="ShowHandle"
        component={ShowHandle}
        options={{ title: "Handle" }}
      />
      <HandlesStack.Screen
        name="CreateRequest"
        component={CreateRequest}
        options={{ title: "Add Handle" }}
        initialParams={{}}
      />
      <HandlesStack.Screen
        name="ImportKeypair"
        component={ImportKeypair}
        options={{ title: "Import Keypair" }}
        initialParams={{}}
      />
      <HandlesStack.Screen
        name="Redeem"
        component={Redeem}
        options={{ title: "Redeem Code" }}
        initialParams={{}}
      />
      <HandlesStack.Screen
        name="ImportCertificate"
        component={ImportCertificate}
        options={{ title: "Import Certificate" }}
      />
      <HandlesStack.Screen
        name="Settings"
        component={Settings}
        options={{ title: "Settings" }}
      />
      <HandlesStack.Screen
        name="RevealSeed"
        component={RevealSeed}
        options={{ title: "Seed Phrase" }}
      />
      <HandlesStack.Screen
        name="Resolve"
        component={Resolve}
        options={{ title: "Resolve" }}
      />
    </HandlesStack.Navigator>
  );
}

export default function RootNavigator() {
  const { xpub, handles } = useStore();
  const { colors, scheme } = useTheme();
  const isConfigured = xpub !== null && handles !== null;

  return (
    <NavigationContainer
      linking={undefined}
      onStateChange={undefined}
      theme={{
        dark: scheme === "dark",
        colors: {
          primary: colors.accent,
          background: colors.background,
          card: colors.background,
          text: colors.text,
          border: colors.border,
          notification: colors.accent,
        },
        fonts: {
          regular: {
            fontFamily: "System",
            fontWeight: "400",
          },
          medium: {
            fontFamily: "System",
            fontWeight: "500",
          },
          bold: {
            fontFamily: "System",
            fontWeight: "700",
          },
          heavy: {
            fontFamily: "System",
            fontWeight: "900",
          },
        },
      }}
    >
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {isConfigured ? (
          <RootStack.Screen name="Main" component={MainNavigator} />
        ) : (
          <RootStack.Screen name="Onboarding" component={OnboardingNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
