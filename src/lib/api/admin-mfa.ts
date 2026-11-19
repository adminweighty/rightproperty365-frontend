import type { MfaChallenge } from "@/lib/admin-mfa";
import type { SessionResponse } from "@/lib/api/auth";
import { apiFetch } from "@/lib/api/http";

/**
 * Administrator two-step verification (API 0.40.0): the second step of the
 * administrator sign-in, the administrator's own authenticator and recovery
 * codes, and a Super Administrator's reset of someone else's.
 */

/** Two-step verification of an administrator (`GET /v1/admin/auth/mfa`). */
export type MfaStatus = {
  enrolled: boolean;
  method: "totp" | null;
  /** RFC 3339: when the authenticator was confirmed. Null when not enrolled. */
  created_at: string | null;
  recovery_codes_remaining: number;
  /** True when the server requires every administrator to use it. */
  required: boolean;
  /** True between setup and confirm (within 15 minutes of setup). */
  pending_setup: boolean;
  webauthn_available: boolean;
};

/** A new, pending authenticator secret. Nothing changes for sign-in until it is confirmed. */
export type TotpSetup = {
  secret_base32: string;
  otpauth_uri: string;
  issuer: string;
  account_name: string;
  algorithm: string;
  digits: number;
  period: number;
  /** RFC 3339: confirm before this, or start again. */
  expires_at: string;
  /** Not sent by API 0.40.0; drawn from `otpauth_uri` in the browser instead. */
  qr_svg?: string | null;
};

/** The recovery codes, shown once, and the status after the change. */
export type RecoveryCodes = { recovery_codes: string[]; mfa: MfaStatus };

/** What the emailed-code step answers for an administrator: the second-factor challenge, or the session. */
export type AdminVerifyAnswer = SessionResponse | MfaChallenge;

/**
 * The second factor of the sign-in, on the same challenge: exactly one of an
 * authenticator code or a recovery code. 400 `VALIDATION_FAILED` with
 * `fields.code` or `fields.recovery_code`; 400 `CODE_EXPIRED` when the
 * challenge ended or locked after 5 wrong codes; 429 `RATE_LIMITED`.
 */
export const submitSignInMfa = (challengeId: string, factor: { code: string } | { recovery_code: string }) =>
  apiFetch<SessionResponse>("/v1/admin/auth/login/mfa", {
    method: "POST",
    body: { challenge_id: challengeId, ...factor },
    cache: "no-store",
  });

/** The signed-in administrator's two-step verification. Allowed in an enrolment-only session. */
export const getMfaStatus = () => apiFetch<MfaStatus>("/v1/admin/auth/mfa", { cache: "no-store" });

/** Starts (or restarts) setting up an authenticator. 409 `MFA_ALREADY_ENROLLED`, 503 `MFA_UNAVAILABLE`. */
export const setupTotp = () =>
  apiFetch<TotpSetup>("/v1/admin/auth/mfa/totp/setup", { method: "POST", body: {}, cache: "no-store" });

/**
 * Confirms the authenticator with a code from it; answers the 10 recovery
 * codes, shown once. 400 `fields.code`, 409 `MFA_SETUP_REQUIRED` (no setup,
 * or older than 15 minutes), 409 `MFA_ALREADY_ENROLLED`.
 */
export const confirmTotp = (code: string) =>
  apiFetch<RecoveryCodes>("/v1/admin/auth/mfa/totp/confirm", { method: "POST", body: { code }, cache: "no-store" });

/** New recovery codes; every earlier one stops working. 400 `fields.code`, 409 `MFA_NOT_ENROLLED`. */
export const regenerateRecoveryCodes = (code: string) =>
  apiFetch<RecoveryCodes>("/v1/admin/auth/mfa/recovery-codes/regenerate", {
    method: "POST",
    body: { code },
    cache: "no-store",
  });

/**
 * Removes the authenticator and every recovery code (204). 403
 * `MFA_REMOVAL_NOT_ALLOWED` while the server requires two-step sign-in.
 */
export const removeTotp = (code: string) =>
  apiFetch<null>("/v1/admin/auth/mfa/totp", { method: "DELETE", body: { code }, cache: "no-store" });

/** Another administrator's two-step verification (SUPER_ADMIN only). */
export const adminGetUserMfa = (userId: string) =>
  apiFetch<MfaStatus>(`/v1/admin/users/${encodeURIComponent(userId)}/mfa`, { cache: "no-store" });

/**
 * Resets another administrator's two-step verification (SUPER_ADMIN only;
 * not their own). Every session of theirs ends and they are emailed. 400
 * `fields.reason`, 403 `FORBIDDEN`, 404, 409 `MFA_NOT_ENROLLED`.
 */
export const adminResetUserMfa = (userId: string, reason: string) =>
  apiFetch<MfaStatus>(`/v1/admin/users/${encodeURIComponent(userId)}/mfa/reset`, {
    method: "POST",
    body: { reason },
  });
