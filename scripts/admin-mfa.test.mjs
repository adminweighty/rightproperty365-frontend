// Checks administrator two-step sign-in logic (API 0.40.0). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ENROLMENT_REQUIRED_PATH,
  formatRecoveryCode,
  formatSecret,
  isEnrolmentOnly,
  isMfaChallenge,
  isSecurityPath,
  LOCKED_MESSAGE,
  mfaFailureOutcome,
  normaliseCode,
  normaliseRecoveryCode,
  RECOVERY_FILE_NAME,
  recoveryCodeProblem,
  recoveryCodesText,
  signInReducer,
  START_STEP,
  totpCodeProblem,
} from "../src/lib/admin-mfa.ts";

test("authenticator codes lose spaces and dashes", () => {
  assert.equal(normaliseCode("123 456"), "123456");
  assert.equal(normaliseCode(" 123-456 "), "123456");
  assert.equal(normaliseCode("123–456"), "123456");
  assert.equal(normaliseCode("1 2 3\t4 5 6"), "123456");
});

test("authenticator code problems", () => {
  assert.equal(totpCodeProblem("123 456"), undefined);
  assert.equal(totpCodeProblem("123-456"), undefined);
  assert.match(totpCodeProblem(""), /6-digit/);
  assert.match(totpCodeProblem("12a456"), /numbers only/);
  assert.match(totpCodeProblem("12345"), /all 6 digits/);
  assert.match(totpCodeProblem("1234567"), /all 6 digits/);
});

test("recovery codes: case, spaces and dashes are ignored", () => {
  assert.equal(normaliseRecoveryCode("ABCDE-FGHJK"), "abcdefghjk");
  assert.equal(normaliseRecoveryCode(" abcde fghjk "), "abcdefghjk");
  assert.equal(recoveryCodeProblem("ABCDE-FGHJK"), undefined);
  assert.match(recoveryCodeProblem(""), /Enter one/);
  assert.match(recoveryCodeProblem("abcde-fgh!k"), /letters and numbers/);
  assert.match(recoveryCodeProblem("abcde"), /10 letters/);
});

test("recovery codes are shown as xxxxx-xxxxx", () => {
  assert.equal(formatRecoveryCode("abcdefghjk"), "abcde-fghjk");
  assert.equal(formatRecoveryCode("ABCDE-FGHJK"), "abcde-fghjk");
  assert.equal(formatRecoveryCode("ab cd ef gh jk"), "abcde-fghjk");
  assert.equal(formatRecoveryCode("abc"), "abc");
});

test("the secret is grouped in fours", () => {
  assert.equal(formatSecret("JBSWY3DPEHPK3PXP"), "JBSW Y3DP EHPK 3PXP");
  assert.equal(formatSecret("jbswy3dpe"), "JBSW Y3DP E");
});

test("the .txt download lists every code once, numbered, with LF endings", () => {
  const codes = ["abcdefghjk", "mnpqrstuvw"];
  const text = recoveryCodesText(codes, "admin@example.test", new Date("2026-11-19T09:00:00.123Z"));
  assert.equal(
    text,
    [
      "RightProperty365 administrator recovery codes",
      "Account: admin@example.test",
      "Created: 2026-11-19T09:00:00Z",
      "",
      "Each code can be used once, instead of a code from your authenticator app.",
      "Keep them somewhere safe and private. Making new codes stops these from working.",
      "",
      " 1. abcde-fghjk",
      " 2. mnpqr-stuvw",
      "",
    ].join("\n"),
  );
  assert.ok(!text.includes("\r"));
  assert.ok(text.endsWith("\n"));
  assert.match(RECOVERY_FILE_NAME, /\.txt$/);
});

test("the .txt download leaves out an unreadable date and numbers ten codes", () => {
  const codes = Array.from({ length: 10 }, (_, i) => `code${i}abcde`.slice(0, 10));
  const text = recoveryCodesText(codes, "a@b.test", new Date("nope"));
  assert.ok(!text.includes("Created:"));
  assert.match(text, /\n10\. /);
});

const challenge = { status: "CODE_REQUIRED", challenge_id: "c1", sent_to: "a•••@b.test", expires_at: "2026-11-19T09:10:00Z", code_length: 6 };
const mfa = { status: "MFA_REQUIRED", challenge_id: "c1", methods: ["totp", "recovery_code"], expires_at: "2026-11-19T09:10:00Z", code_length: 6 };
const session = { user: { id: "u1" }, session: { scope: "admin", expires_at: "2026-11-19T10:00:00Z" } };
const restricted = { user: { id: "u1" }, session: { scope: "admin", expires_at: "x", mfa_enrolment_required: true } };

test("recognises the MFA challenge and the enrolment-only session", () => {
  assert.equal(isMfaChallenge(mfa), true);
  assert.equal(isMfaChallenge(challenge), false);
  assert.equal(isMfaChallenge({ status: "MFA_REQUIRED", challenge_id: "" }), false);
  assert.equal(isMfaChallenge(null), false);
  assert.equal(isEnrolmentOnly(restricted), true);
  assert.equal(isEnrolmentOnly(session), false);
  assert.equal(isEnrolmentOnly({ user: {}, session: { mfa_enrolment_required: false } }), false);
});

test("sign-in steps: password, emailed code, authenticator code, signed in (2a)", () => {
  let step = signInReducer(START_STEP, { type: "answer", data: challenge });
  assert.deepEqual(step, { step: "email-code", challengeId: "c1" });
  step = signInReducer(step, { type: "answer", data: mfa });
  assert.deepEqual(step, { step: "mfa", challengeId: "c1", method: "totp", expiresAt: mfa.expires_at });
  step = signInReducer(step, { type: "switch-method", method: "recovery_code" });
  assert.equal(step.method, "recovery_code");
  step = signInReducer(step, { type: "switch-method", method: "totp" });
  assert.equal(step.method, "totp");
  step = signInReducer(step, { type: "answer", data: session });
  assert.deepEqual(step, { step: "signed-in" });
});

test("sign-in steps: not enrolled, not required (2b) signs in after the emailed code", () => {
  const step = signInReducer({ step: "email-code", challengeId: "c1" }, { type: "answer", data: session });
  assert.deepEqual(step, { step: "signed-in" });
});

test("sign-in steps: enrolment-only session (2c) goes to enrolment", () => {
  const step = signInReducer({ step: "email-code", challengeId: "c1" }, { type: "answer", data: restricted });
  assert.deepEqual(step, { step: "enrol" });
  assert.equal(ENROLMENT_REQUIRED_PATH, "/admin/security?required=1");
});

test("sign-in steps: an API without the code step answers the session at once", () => {
  assert.deepEqual(signInReducer(START_STEP, { type: "answer", data: session }), { step: "signed-in" });
  assert.deepEqual(signInReducer(START_STEP, { type: "answer", data: restricted }), { step: "enrol" });
});

test("sign-in steps: answers out of place are ignored, start again resets", () => {
  // An MFA challenge only answers the emailed code.
  assert.deepEqual(signInReducer(START_STEP, { type: "answer", data: mfa }), START_STEP);
  // Switching method outside the MFA step does nothing.
  const code = { step: "email-code", challengeId: "c1" };
  assert.equal(signInReducer(code, { type: "switch-method", method: "recovery_code" }), code);
  // Garbage does not move on.
  assert.equal(signInReducer(code, { type: "answer", data: null }), code);
  assert.equal(signInReducer(code, { type: "answer", data: { status: "WHAT" } }), code);
  const mfaStep = { step: "mfa", challengeId: "c1", method: "totp", expiresAt: "x" };
  assert.deepEqual(signInReducer(mfaStep, { type: "start-again", message: LOCKED_MESSAGE }), { step: "credentials", message: LOCKED_MESSAGE });
});

test("second-factor failures: field errors, lockout, rate limit, other", () => {
  const wrong = { code: "VALIDATION_FAILED", status: 400, message: "x", fields: { code: "That code is not right." } };
  assert.deepEqual(mfaFailureOutcome(wrong, "totp"), { kind: "field", message: "That code is not right." });

  const wrongRecovery = { code: "VALIDATION_FAILED", status: 400, message: "x", fields: { recovery_code: "That recovery code is not right or was already used." } };
  assert.equal(mfaFailureOutcome(wrongRecovery, "recovery_code").kind, "field");
  assert.match(mfaFailureOutcome(wrongRecovery, "recovery_code").message, /recovery code/);

  const locked = { code: "CODE_EXPIRED", status: 400, message: "Sign in again." };
  assert.deepEqual(mfaFailureOutcome(locked, "totp"), { kind: "start-again", message: LOCKED_MESSAGE });

  const limited = { code: "RATE_LIMITED", status: 429, message: "x", retryAfter: 20 };
  assert.deepEqual(mfaFailureOutcome(limited, "totp"), { kind: "wait", message: "Too many attempts from this connection. Try again in 20 seconds." });
  assert.match(mfaFailureOutcome({ ...limited, retryAfter: undefined }, "totp").message, /Wait a minute/);

  assert.match(mfaFailureOutcome({ code: "MFA_UNAVAILABLE", status: 503, message: "x" }, "totp").message, /not available/);
  assert.deepEqual(mfaFailureOutcome({ code: "NETWORK_ERROR", status: 0, message: "Offline" }, "totp"), { kind: "alert", message: "Offline" });
});

test("security path matching", () => {
  assert.equal(isSecurityPath("/admin/security"), true);
  assert.equal(isSecurityPath("/admin/security/"), true);
  assert.equal(isSecurityPath("/admin/security?required=1"), true);
  assert.equal(isSecurityPath("/admin/securityx"), false);
  assert.equal(isSecurityPath("/admin/users"), false);
});
