import React from "react";
import Home from "@/screens/onboarding/Home";

// Design-review preview of the first onboarding screen, reachable from Settings
// while already configured. `preview` makes the buttons inert (dismiss only).
export default function OnboardingPreview() {
  return <Home preview />;
}
