import React from "react";
import type { ComponentProps } from "react";
import { Icon as ExpoIcon } from "@expo/ui";
import { sfIcon } from "./sfIcon";

type Props = ComponentProps<typeof ExpoIcon>;

// Drop-in replacement for @expo/ui's <Icon>. Call sites keep passing SF Symbol
// names (authored for iOS); this maps a string name through sfIcon() so Android
// gets the matching @expo/material-symbols drawable. Non-string names (already
// { ios, android } or a require'd asset) pass through untouched. iOS behaviour is
// identical to the raw @expo/ui Icon.
export function Icon({ name, ...rest }: Props) {
  return (
    <ExpoIcon name={typeof name === "string" ? sfIcon(name) : name} {...rest} />
  );
}
