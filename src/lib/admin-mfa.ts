/**
 * Administrator two-step verification with an authenticator app (TOTP) and
 * recovery codes (API 0.40.0). Pure functions with no imports, so `npm test`
 * can run them directly. The API stays the authority on whether a code is
 * right.
 */

/** Digits of an authenticator app code. */
export const TOTP_LENGTH = 6;

/** Characters of a recovery code, without its dash ("abcde-fghij"). */
export const RECOVERY_CODE_LENGTH = 10;

/** How many recovery codes the API makes at a time. */
export const RECOVERY_CODE_COUNT = 10;

/** Spaces, and every kind of dash or hyphen people copy with a code. */
const SEPARATORS = /[\s\-‐-―−]/g;

/** The code as typed, without the spaces and dashes people copy with it. */
export const normaliseCode = (raw: string) => raw.replace(SEPARATORS, "");

/** What is wrong with an authenticator code before it is sent, or undefined when it can be sent. */
export function totpCodeProblem(raw: string): string | undefined {
  const code = normaliseCode(raw);
  if (code === "") return "Enter the 6-digit code from your authenticator app.";
  if (!/^\d+$/.test(code)) return "The code is made of numbers only.";
  if (code.length !== TOTP_LENGTH) return "Enter all 6 digits of the code from your authenticator app.";
  return undefined;
}

/** A recovery code as the API compares it: no spaces or dashes, lower case. */
export const normaliseRecoveryCode = (raw: string) => normaliseCode(raw).toLowerCase();

/** What is wrong with a recovery code before it is sent, or undefined when it can be sent. */
export function recoveryCodeProblem(raw: string): string | undefined {
  const code = normaliseRecoveryCode(raw);
  if (code === "") return "Enter one of your recovery codes.";
  if (!/^[a-z0-9]+$/.test(code)) return "A recovery code is made of letters and numbers only.";
  if (code.length !== RECOVERY_CODE_LENGTH) return "A recovery code has 10 letters and numbers, like abcde-fghij.";
  return undefined;
}

/**
 * A recovery code for reading: lower case, in two groups of five joined by a
 * dash ("abcde-fghij"), however it was typed or sent.
 */
export function formatRecoveryCode(raw: string): string {
  const code = normaliseRecoveryCode(raw);
  const half = Math.ceil(code.length / 2);
  return code.length <= 5 ? code : `${code.slice(0, half)}-${code.slice(half)}`;
}

/** The secret in groups of four for typing: "JBSW Y3DP EHPK 3PXP". */
export function formatSecret(secret: string): string {
  const clean = secret.replace(/\s/g, "").toUpperCase();
  return (clean.match(/.{1,4}/g) ?? []).join(" ");
}

/** The file name of the recovery codes download. */
export const RECOVERY_FILE_NAME = "rightproperty365-admin-recovery-codes.txt";

/**
 * The text of the recovery codes download: what they are, whose they are,
 * when they were made, and one code per line. LF line endings, ending in a
 * newline.
 */
export function recoveryCodesText(codes: readonly string[], account: string, generatedAt: Date): string {
  const when = Number.isNaN(generatedAt.getTime()) ? "" : generatedAt.toISOString().replace(/\.\d{3}Z$/, "Z");
  return [
    "RightProperty365 administrator recovery codes",
    `Account: ${account}`,
    ...(when ? [`Created: ${when}`] : []),
    "",
    "Each code can be used once, instead of a code from your authenticator app.",
    "Keep them somewhere safe and private. Making new codes stops these from working.",
    "",
    ...codes.map((code, index) => `${String(index + 1).padStart(2, " ")}. ${formatRecoveryCode(code)}`),
    "",
  ].join("\n");
}

/** Where a session that may only set up two-step verification is sent, with the reason. */
export const ENROLMENT_REQUIRED_PATH = "/admin/security?required=1";

/** True on /admin/security (with or without a query or trailing slash). */
export const isSecurityPath = (pathname: string) => /^\/admin\/security\/?(?:[?#].*)?$/.test(pathname);

/* ------------------------------------------------------------------------ */
/* The administrator sign-in, as steps                                       */
/* ------------------------------------------------------------------------ */

/** Step 2a: the emailed code was right and the same challenge now waits for the second factor. No session yet. */
export type MfaChallenge = {
  status: "MFA_REQUIRED";
  challenge_id: string;
  methods: string[];
  /** RFC 3339: ten minutes after this answer. */
  expires_at: string;
  code_length: number;
};

/** True for the "second factor required" answer of the emailed-code step. */
export function isMfaChallenge(data: unknown): data is MfaChallenge {
  if (!data || typeof data !== "object") return false;
  const value = data as Partial<MfaChallenge>;
  return value.status === "MFA_REQUIRED" && typeof value.challenge_id === "string" && value.challenge_id !== "";
}

/** The session part of a sign-in answer. */
type SessionLike = { session?: { scope?: string; expires_at?: string; mfa_enrolment_required?: boolean } | null };

/** True when the session may only set up two-step verification (step 2c). */
export const isEnrolmentOnly = (answer: unknown) =>
  Boolean(answer && typeof answer === "object" && (answer as SessionLike).session?.mfa_enrolment_required === true);

/** Which kind of code the second-factor step asks for. */
export type MfaMethod = "totp" | "recovery_code";

/**
 * The steps of the administrator sign-in:
 * credentials -> email code -> (authenticator or recovery code) -> signed in,
 * or straight to enrolment for an enrolment-only session.
 */
export type SignInStep =
  | { step: "credentials"; message?: string }
  | { step: "email-code"; challengeId: string }
  | { step: "mfa"; challengeId: string; method: MfaMethod; expiresAt: string }
  | { step: "signed-in" }
  | { step: "enrol" };

/** What can happen to the sign-in. */
export type SignInEvent =
  /** An answer of the API: to the password, the emailed code or the second factor. */
  | { type: "answer"; data: unknown }
  /** "Use a recovery code instead" and back. */
  | { type: "switch-method"; method: MfaMethod }
  /** The challenge ended (expired, used up or locked): sign in again, with this message. */
  | { type: "start-again"; message?: string };

export const START_STEP: SignInStep = { step: "credentials" };

/** The next step of the sign-in. Events that do not apply to the current step leave it as it is. */
export function signInReducer(current: SignInStep, event: SignInEvent): SignInStep {
  switch (event.type) {
    case "start-again":
      return { step: "credentials", message: event.message };
    case "switch-method":
      return current.step === "mfa" ? { ...current, method: event.method } : current;
    case "answer": {
      const data = event.data as { status?: unknown; challenge_id?: unknown } | null;
      if (current.step === "credentials" && data?.status === "CODE_REQUIRED" && typeof data.challenge_id === "string" && data.challenge_id) {
        return { step: "email-code", challengeId: data.challenge_id };
      }
      if (current.step === "email-code" && isMfaChallenge(event.data)) {
        return { step: "mfa", challengeId: event.data.challenge_id, method: "totp", expiresAt: event.data.expires_at };
      }
      // An MFA challenge answers only the emailed code; anything else that is a session ends the sign-in.
      if (isMfaChallenge(event.data) || data?.status === "CODE_REQUIRED") return current;
      if (current.step === "signed-in" || current.step === "enrol") return current;
      if (!data || typeof data !== "object" || !("user" in data)) return current;
      return isEnrolmentOnly(event.data) ? { step: "enrol" } : { step: "signed-in" };
    }
  }
}

/** A failure of the second-factor step, as the API sends it. */
export type MfaFailure = { code: string; status: number; message: string; fields?: Record<string, string>; retryAfter?: number };

/** What the second-factor step shows for a failure. */
export type MfaFailureOutcome =
  /** Under the field: a wrong, used or badly formed code. */
  | { kind: "field"; message: string }
  /** The challenge ended: back to the email and password with this message. */
  | { kind: "start-again"; message: string }
  /** Too many attempts from this address for now. */
  | { kind: "wait"; message: string }
  /** Anything else, shown as the API's message. */
  | { kind: "alert"; message: string };

export const LOCKED_MESSAGE =
  "This sign-in has ended: it expired, or the code was wrong too many times. For your security, enter your email and password again.";

/** How the second-factor step handles a failed answer. */
export function mfaFailureOutcome(failure: MfaFailure, method: MfaMethod): MfaFailureOutcome {
  if (failure.code === "CODE_EXPIRED") return { kind: "start-again", message: LOCKED_MESSAGE };
  if (failure.status === 429 || failure.code === "RATE_LIMITED") {
    const wait = failure.retryAfter && failure.retryAfter > 0 ? ` Try again in ${failure.retryAfter} seconds.` : " Wait a minute and try again.";
    return { kind: "wait", message: `Too many attempts from this connection.${wait}` };
  }
  const field = method === "recovery_code" ? failure.fields?.recovery_code ?? failure.fields?.code : failure.fields?.code;
  if (field) return { kind: "field", message: field };
  if (failure.code === "MFA_UNAVAILABLE") {
    return { kind: "alert", message: "Two-step sign-in is not available on the server right now. Please contact the platform team." };
  }
  return { kind: "alert", message: failure.message };
}
