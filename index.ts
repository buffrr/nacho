// Polyfills must run before anything else (Buffer, crypto.getRandomValues for
// @noble/* key derivation). Then hand the root off to Expo Router, which
// registers the root component against the app/ directory.
import "./polyfills";

// Suppress the dev-only LogBox warning overlay as early as possible so it never
// appears in screenshots (no-op in release; __DEV__ is false there).
import { LogBox } from "react-native";
if (__DEV__) LogBox.ignoreAllLogs();

import "expo-router/entry";