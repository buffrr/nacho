import type { SFSymbol } from "sf-symbols-typescript";
import type { IconName } from "@expo/ui";

// @expo/ui's <Icon> renders SF Symbols on iOS but XML vector drawables on
// Android. We author against SF Symbol names everywhere; this maps every symbol
// the app uses to its @expo/material-symbols equivalent so the same call site
// renders on both platforms. `sfIcon(sf)` returns the cross-platform
// `{ ios, android }` form for mapped symbols, or the bare SF string (iOS-only)
// for anything unmapped — if a new symbol shows up blank on Android, add a row.
//
// require()'d statically so Metro bundles each .xml as an asset (needs `xml` in
// metro.config assetExts). @expo/ui fetches the asset URI at runtime. iOS is
// unaffected — it uses the `ios` SF string.
const ANDROID: Partial<Record<string, number>> = {
  "arrow.clockwise": require("@expo/material-symbols/icons/refresh.xml"),
  "arrow.counterclockwise": require("@expo/material-symbols/icons/restart_alt.xml"),
  "arrow.right": require("@expo/material-symbols/icons/arrow_forward.xml"),
  "arrow.right.circle.fill": require("@expo/material-symbols/icons/arrow_circle_right.xml"),
  "arrow.triangle.2.circlepath": require("@expo/material-symbols/icons/autorenew.xml"),
  "arrow.up.arrow.down": require("@expo/material-symbols/icons/swap_vert.xml"),
  "arrow.up.right": require("@expo/material-symbols/icons/arrow_outward.xml"),
  at: require("@expo/material-symbols/icons/alternate_email.xml"),
  bag: require("@expo/material-symbols/icons/shopping_bag.xml"),
  "bitcoinsign.circle.fill": require("@expo/material-symbols/icons/currency_bitcoin.xml"),
  "checkmark.circle": require("@expo/material-symbols/icons/check_circle.xml"),
  "checkmark.circle.fill": require("@expo/material-symbols/icons/check_circle.xml"),
  "checkmark.seal.fill": require("@expo/material-symbols/icons/verified.xml"),
  "checkmark.shield": require("@expo/material-symbols/icons/verified_user.xml"),
  "checkmark.shield.fill": require("@expo/material-symbols/icons/verified_user.xml"),
  "chevron.backward": require("@expo/material-symbols/icons/chevron_left.xml"),
  "chevron.forward": require("@expo/material-symbols/icons/chevron_right.xml"),
  clock: require("@expo/material-symbols/icons/schedule.xml"),
  "clock.arrow.circlepath": require("@expo/material-symbols/icons/history.xml"),
  "doc.on.doc": require("@expo/material-symbols/icons/content_copy.xml"),
  ellipsis: require("@expo/material-symbols/icons/more_horiz.xml"),
  "ellipsis.circle": require("@expo/material-symbols/icons/more_horiz.xml"),
  "exclamationmark.shield.fill": require("@expo/material-symbols/icons/gpp_maybe.xml"),
  "exclamationmark.triangle.fill": require("@expo/material-symbols/icons/warning.xml"),
  gearshape: require("@expo/material-symbols/icons/settings.xml"),
  infinity: require("@expo/material-symbols/icons/all_inclusive.xml"),
  "line.3.horizontal": require("@expo/material-symbols/icons/menu.xml"),
  link: require("@expo/material-symbols/icons/link.xml"),
  "lock.fill": require("@expo/material-symbols/icons/lock.xml"),
  magnifyingglass: require("@expo/material-symbols/icons/search.xml"),
  "minus.circle": require("@expo/material-symbols/icons/do_not_disturb_on.xml"),
  "minus.circle.fill": require("@expo/material-symbols/icons/do_not_disturb_on.xml"),
  paperplane: require("@expo/material-symbols/icons/send.xml"),
  plus: require("@expo/material-symbols/icons/add.xml"),
  "plus.circle.fill": require("@expo/material-symbols/icons/add_circle.xml"),
  "qrcode.viewfinder": require("@expo/material-symbols/icons/qr_code_scanner.xml"),
  "questionmark.circle": require("@expo/material-symbols/icons/help.xml"),
  "shield.lefthalf.filled": require("@expo/material-symbols/icons/shield.xml"),
  signature: require("@expo/material-symbols/icons/signature.xml"),
  "slider.horizontal.3": require("@expo/material-symbols/icons/tune.xml"),
  sparkles: require("@expo/material-symbols/icons/star_shine.xml"),
  "square.and.arrow.down": require("@expo/material-symbols/icons/download.xml"),
  "square.and.arrow.up": require("@expo/material-symbols/icons/ios_share.xml"),
  tag: require("@expo/material-symbols/icons/sell.xml"),
  trash: require("@expo/material-symbols/icons/delete.xml"),
  "trash.fill": require("@expo/material-symbols/icons/delete.xml"),
  "wand.and.stars": require("@expo/material-symbols/icons/wand_stars.xml"),
  "wifi.slash": require("@expo/material-symbols/icons/wifi_off.xml"),
  "xmark.circle": require("@expo/material-symbols/icons/cancel.xml"),
};

export function sfIcon(sf: SFSymbol): IconName {
  const android = ANDROID[sf];
  return android != null ? ({ ios: sf, android } as IconName) : (sf as IconName);
}