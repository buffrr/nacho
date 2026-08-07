import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HandlesMap, useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { RecordsDraftProvider } from "@/RecordsDraft";
import OnboardingHome from "./screens/onboarding/Home";
import ShowMnemonic from "./screens/onboarding/ShowMnemonic";
import ImportKeystore from "./screens/onboarding/ImportKeystore";
import EnterMnemonic from "./screens/onboarding/EnterMnemonic";
import ListHandles from "./screens/main/ListHandles";
import ShowHandle from "./screens/main/ShowHandle";
import CreateRequest from "./screens/main/CreateRequest";
import ImportCertificate from "./screens/main/ImportCertificate";
import Settings from "./screens/main/Settings";
import Preferences from "./screens/main/Preferences";
import Resolve from "./screens/main/Resolve";
import ImportKeypair from "./screens/main/ImportKeypair";
import Redeem from "./screens/main/Redeem";
import RevealSeed from "./screens/main/RevealSeed";
import Shop from "./screens/main/Shop";
import RegisterHub from "./screens/main/RegisterHub";
import EditRecord from "./screens/main/EditRecord";
import VerifyAnchor from "./screens/main/VerifyAnchor";

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
  Shop: undefined;
  Resolve: { prefill?: string } | undefined;
  RegisterHub: undefined;
  ShowHandle: { handle: string };
  CreateRequest: { initialHandle?: string };
  ImportKeypair: { handle?: string };
  Redeem: { code?: string };
  ImportCertificate: { handle: string };
  Settings: undefined;
  Preferences: undefined;
  VerifyAnchor: undefined;
  RevealSeed: undefined;
  EditRecord: { handle: string; index?: number };
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
        options={{ headerShown: false }}
      />
      <OnboardingStack.Screen
        name="ImportKeystore"
        component={ImportKeystore}
        options={{ headerShown: false }}
      />
      <OnboardingStack.Screen
        name="EnterMnemonic"
        component={EnterMnemonic}
        options={{ headerShown: false }}
      />
    </OnboardingStack.Navigator>
  );
}

function MainNavigator() {
  const { colors } = useTheme();
  return (
    <RecordsDraftProvider>
      <HandlesStack.Navigator
        screenOptions={makeScreenOptions(colors)}
        initialRouteName="ListHandles"
      >
      <HandlesStack.Screen
        name="ListHandles"
        component={ListHandles}
        options={{ headerShown: false, animation: "none" }}
      />
      <HandlesStack.Screen
        name="Shop"
        component={Shop}
        options={{ headerShown: false, animation: "none" }}
      />
      <HandlesStack.Screen
        name="RegisterHub"
        component={RegisterHub}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "none",
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <HandlesStack.Screen
        name="ShowHandle"
        component={ShowHandle}
        options={{ headerShown: false }}
      />
      <HandlesStack.Screen
        name="CreateRequest"
        component={CreateRequest}
        options={{ headerShown: false }}
        initialParams={{}}
      />
      <HandlesStack.Screen
        name="ImportKeypair"
        component={ImportKeypair}
        options={{ headerShown: false }}
        initialParams={{}}
      />
      <HandlesStack.Screen
        name="Redeem"
        component={Redeem}
        options={{ headerShown: false }}
        initialParams={{}}
      />
      <HandlesStack.Screen
        name="ImportCertificate"
        component={ImportCertificate}
        options={{ headerShown: false }}
      />
      <HandlesStack.Screen
        name="Settings"
        component={Settings}
        options={{ headerShown: false, animation: "none" }}
      />
      <HandlesStack.Screen
        name="Preferences"
        component={Preferences}
        options={{ headerShown: false }}
      />
      <HandlesStack.Screen
        name="VerifyAnchor"
        component={VerifyAnchor}
        options={{ headerShown: false }}
      />
      <HandlesStack.Screen
        name="RevealSeed"
        component={RevealSeed}
        options={{ headerShown: false }}
      />
        <HandlesStack.Screen
          name="Resolve"
          component={Resolve}
          options={{ headerShown: false, animation: "none" }}
        />
        <HandlesStack.Screen
          name="EditRecord"
          component={EditRecord}
          options={{ headerShown: false }}
        />
      </HandlesStack.Navigator>
    </RecordsDraftProvider>
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
