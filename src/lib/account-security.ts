/** Wording of the account security page (API 0.50.0). Pure, so `npm test` checks it. */

/** The line under a device: when it signed in and was last used. */
export function deviceLine(s: { created_at: string; last_seen_at: string; current: boolean }, format: (iso: string) => string): string {
  if (s.current) return `This device · signed in ${format(s.created_at)}`;
  return `Signed in ${format(s.created_at)} · last used ${format(s.last_seen_at)}`;
}

/** What "Sign out everywhere else" reports. */
export function revokedText(n: number): string {
  if (n === 0) return "No other device was signed in.";
  return n === 1 ? "1 other device was signed out." : `${n} other devices were signed out.`;
}

/** Plain words for the API's errors on this page, or null for others. */
export function securityErrorText(code: string): string | null {
  switch (code) {
    case "PLATFORM_ACCOUNT":
      return "Administrator accounts change their password and email address with the operator tool.";
    case "INVALID_TOKEN":
      return "This link is not valid any more. Ask for a new one from your account's security page.";
    case "EMAIL_TAKEN":
      return "This email address is now used by another account. Choose another one from your account's security page.";
    case "RATE_LIMITED":
      return "Too many attempts. Please wait a minute and try again.";
    default:
      return null;
  }
}
