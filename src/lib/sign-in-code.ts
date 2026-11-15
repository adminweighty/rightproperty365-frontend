/**
 * The second step of signing in: the code sent by email. Pure functions with
 * no imports, so `npm test` can run them directly. The API stays the
 * authority on whether a code is right.
 */

/**
 * The API normally sends 6 digits (`code_length`), and on the test site a
 * 4-digit demo code is also accepted, so anything from 4 to 6 digits is sent.
 */
export const CODE_MIN = 4;
export const CODE_MAX = 6;

/** Seconds before "Send a new code" can be used, when the API does not say. */
export const RESEND_WAIT_SECONDS = 30;

/** What the sign-in endpoints answer when a code is needed. No session exists yet. */
export type SignInChallenge = {
  status: "CODE_REQUIRED";
  challenge_id: string;
  /** The address the code went to, partly hidden: "u•••@example.com". */
  sent_to: string;
  /** RFC 3339. After this the code no longer works and sign-in starts again. */
  expires_at: string;
  code_length: number;
};

/** True for a "code required" answer; false for a session (the API before the code step). */
export function isSignInChallenge(data: unknown): data is SignInChallenge {
  if (!data || typeof data !== "object") return false;
  const value = data as Partial<SignInChallenge>;
  return value.status === "CODE_REQUIRED" && typeof value.challenge_id === "string" && value.challenge_id !== "";
}

/** The code as typed, without the spaces or dashes people copy with it. */
export const cleanCode = (raw: string) => raw.replace(/[\s-]/g, "");

/** What is wrong with a code before it is sent, or undefined when it can be sent. */
export function codeProblem(raw: string): string | undefined {
  const code = cleanCode(raw);
  if (code === "") return "Enter the code we sent you.";
  if (!/^\d+$/.test(code)) return "The code is made of numbers only.";
  if (code.length < CODE_MIN) return "That code is too short. Check the email and try again.";
  if (code.length > CODE_MAX) return "That code is too long. Check the email and try again.";
  return undefined;
}

/** Whole seconds from `nowMs` until `untilMs`, never below zero. */
export const secondsLeft = (untilMs: number, nowMs: number) => Math.max(0, Math.ceil((untilMs - nowMs) / 1000));

/** 27 -> "0:27", 65 -> "1:05". */
export function formatCountdown(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** True once the code's `expires_at` has passed. An unreadable time never expires here; the API decides. */
export function hasExpired(expiresAt: string, nowMs: number): boolean {
  const at = Date.parse(expiresAt);
  return Number.isFinite(at) && at <= nowMs;
}
