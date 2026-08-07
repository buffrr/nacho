// Polyfills must run before anything else (Buffer, crypto.getRandomValues for
// @noble/* key derivation). Then hand the root off to Expo Router, which
// registers the root component against the app/ directory.
import "./polyfills";
import "expo-router/entry";