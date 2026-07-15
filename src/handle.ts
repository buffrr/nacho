// Validation for handle names of the form `label@space`. Labels are DNS-style
// (a-z, 0-9, hyphen; no leading/trailing or doubled hyphens; punycode allowed).

export function isValidSLabel(label: string): boolean {
  if (!label || label.length > 62) {
    return false;
  }
  let verifyRange = label;
  if (label.startsWith("xn--") && label.length > "xn--".length) {
    verifyRange = label.slice("xn--".length);
  }
  if (verifyRange[0] === "-" || verifyRange[verifyRange.length - 1] === "-") {
    return false;
  }
  let prev = "";
  for (const c of verifyRange) {
    if (c === "-" && prev === "-") {
      return false;
    }
    if (!/^[a-z0-9-]$/.test(c)) {
      return false;
    }
    prev = c;
  }
  return true;
}

export function isValidHandle(handle: string): boolean {
  const [l, r] = handle.split("@");
  return isValidSLabel(l) && isValidSLabel(r || "");
}
