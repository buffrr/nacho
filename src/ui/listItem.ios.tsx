// iOS: the real @expo/ui ListItem is exactly right — SwiftUI Section renders
// each ListItem as a native grouped row. Re-export unchanged so iOS behaviour is
// identical (the Android sibling file is where the parity fix lives).
export { ListItem } from "@expo/ui";