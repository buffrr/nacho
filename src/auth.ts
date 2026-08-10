import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

// Device-authentication gate for a protected action (design-notes.md §6). Returns
// true if the user authenticated, OR if there's nothing to authenticate against
// (web, or a device with no biometrics/enrollment) — those proceed, per the
// product decision. NEVER names the method: the OS prompt does that itself.
export async function authenticate(reason: string): Promise<boolean> {
  if (Platform.OS === "web") return true;
  try {
    const has = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!has || !enrolled) return true; // nothing enrolled → no check
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
    });
    return res.success;
  } catch {
    // Don't leave a flow unreachable on an auth-subsystem error.
    return true;
  }
}
