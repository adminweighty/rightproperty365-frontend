// Checks the rules the account forms apply before sending. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CAPTCHA_LIFETIME_MS,
  captchaAnswerProblem,
  captchaLifetimeMs,
  emailProblem,
  firstProblem,
  hasProblems,
  nameProblem,
  newPasswordProblem,
  registerProblems,
  rolesProblem,
  signInProblems,
  splitRoleGroups,
} from "../src/lib/auth-validation.ts";

const groups = [
  { code: "PROPERTY_SEEKERS", roles: [{ code: "CONSUMER" }, { code: "TENANT" }] },
  { code: "REAL_ESTATE_PROFESSIONALS", roles: [{ code: "ESTATE_AGENT" }, { code: "SOLICITOR" }] },
  { code: "PROPERTY_OWNERS", roles: [{ code: "PRIVATE_SELLER" }, { code: "LANDLORD" }] },
];

test("name is required and at most 120 characters", () => {
  assert.match(nameProblem(""), /full name/);
  assert.match(nameProblem("   "), /full name/);
  assert.equal(nameProblem("Tendai Moyo"), undefined);
  assert.equal(nameProblem("a".repeat(120)), undefined);
  assert.equal(nameProblem(`  ${"a".repeat(120)}  `), undefined, "spaces around it do not count");
  assert.match(nameProblem("a".repeat(121)), /120 characters/);
  assert.equal(nameProblem("é".repeat(120)), undefined, "an accented letter is one character");
});

test("email is required and well formed", () => {
  assert.match(emailProblem(""), /Enter your email/);
  assert.equal(emailProblem("tendai@example.com"), undefined);
  assert.equal(emailProblem("  tendai.moyo+home@mail.example.co.zw  "), undefined);
  for (const bad of ["tendai", "tendai@", "@example.com", "tendai@example", "ten dai@example.com", "a@b@c.com", "tendai@example..com", "tendai@.com", "tendai@example.com."]) {
    assert.match(emailProblem(bad), /name@example\.com/, bad);
  }
  assert.match(emailProblem(`${"a".repeat(250)}@example.com`), /name@example\.com/);
});

test("a new password is 10 to 128 characters and is not trimmed", () => {
  assert.match(newPasswordProblem(""), /Choose a password/);
  assert.match(newPasswordProblem("123456789"), /at least 10/);
  assert.equal(newPasswordProblem("1234567890"), undefined);
  assert.equal(newPasswordProblem("a phrase  "), undefined, "spaces count");
  assert.equal(newPasswordProblem("a".repeat(128)), undefined);
  assert.match(newPasswordProblem("a".repeat(129)), /128 characters/);
});

test("sign-in asks only for an email address and some password", () => {
  assert.deepEqual(signInProblems({ email: "tendai@example.com", password: "x" }), {});
  const problems = signInProblems({ email: "tendai", password: "" });
  assert.deepEqual(Object.keys(problems), ["email", "password"]);
  assert.match(problems.password, /Enter your password/);
});

test("an account is a property seeker or has other roles, never both", () => {
  const { seekers, others } = splitRoleGroups(groups);
  assert.deepEqual(seekers.map((group) => group.code), ["PROPERTY_SEEKERS"]);
  assert.equal(others.length, 2);

  assert.match(rolesProblem([], groups), /at least one/);
  assert.equal(rolesProblem(["CONSUMER"], groups), undefined);
  assert.equal(rolesProblem(["CONSUMER", "TENANT"], groups), undefined);
  assert.equal(rolesProblem(["ESTATE_AGENT"], groups), undefined);
  assert.equal(rolesProblem(["ESTATE_AGENT", "LANDLORD", "SOLICITOR"], groups), undefined, "any mix of the other groups");
  assert.match(rolesProblem(["CONSUMER", "ESTATE_AGENT"], groups), /not both/);
  assert.match(rolesProblem(["LANDLORD", "TENANT"], groups), /not both/);
  // Without the seekers group there is nothing to keep apart.
  assert.equal(rolesProblem(["ESTATE_AGENT", "LANDLORD"], groups.slice(1)), undefined);
});

test("the captcha answer is digits", () => {
  assert.match(captchaAnswerProblem(""), /Answer the question/);
  assert.match(captchaAnswerProblem("  "), /Answer the question/);
  assert.equal(captchaAnswerProblem("12"), undefined);
  assert.equal(captchaAnswerProblem(" 12 "), undefined);
  assert.equal(captchaAnswerProblem("0"), undefined);
  for (const bad of ["twelve", "1 2", "-3", "1.5", "12a", "1234567890"]) {
    assert.match(captchaAnswerProblem(bad), /digits only/, bad);
  }
});

test("a question lasts until expires_at, or ten minutes when the clock cannot be trusted", () => {
  const now = Date.parse("2026-11-14T10:00:00Z");
  assert.equal(captchaLifetimeMs("2026-11-14T10:10:00Z", now), CAPTCHA_LIFETIME_MS);
  assert.equal(captchaLifetimeMs("2026-11-14T10:04:30Z", now), 270_000);
  assert.equal(captchaLifetimeMs("2026-11-14T12:10:00+02:00", now), CAPTCHA_LIFETIME_MS, "RFC 3339 offsets");
  // A device clock that is ahead or behind, and a value that is not a date.
  assert.equal(captchaLifetimeMs("2026-11-14T09:59:00Z", now), CAPTCHA_LIFETIME_MS);
  assert.equal(captchaLifetimeMs("2026-11-14T11:00:00Z", now), CAPTCHA_LIFETIME_MS);
  assert.equal(captchaLifetimeMs("soon", now), CAPTCHA_LIFETIME_MS);
});

test("registerProblems lists what to fix, in the order of the form", () => {
  const good = {
    name: "Tendai Moyo",
    email: "tendai@example.com",
    password: "a short phrase",
    roles: ["CONSUMER"],
    consent: true,
  };
  assert.deepEqual(registerProblems(good, groups), {});
  assert.equal(hasProblems(registerProblems(good, groups)), false);

  const problems = registerProblems({ name: "", email: "x", password: "short", roles: [], consent: false }, groups);
  assert.deepEqual(Object.keys(problems), ["name", "email", "password", "roles", "consent"]);
  assert.equal(hasProblems(problems), true);
  assert.match(problems.consent, /Tick the box/);

  const order = ["name", "email", "password", "roles", "consent", "captcha"];
  assert.equal(firstProblem(order, problems), "name");
  assert.equal(firstProblem(order, registerProblems({ ...good, roles: ["CONSUMER", "LANDLORD"] }, groups)), "roles");
  assert.equal(firstProblem(order, { captcha: "Answer the question." }), "captcha");
  assert.equal(firstProblem(order, { email: undefined }), undefined);
  assert.equal(firstProblem(order, {}), undefined);
});
