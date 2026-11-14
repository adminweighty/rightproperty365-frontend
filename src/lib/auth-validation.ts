/**
 * The checks the account forms run in the browser before anything is sent:
 * sign-up, sign-in, and the two password-reset forms. They repeat the API's
 * rules so people see a message beside the field straight away. The API stays
 * the authority and its own field errors are shown the same way.
 *
 * Pure functions with no imports, so `npm test` can run them directly.
 */

export const NAME_MAX = 120;
export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

/** Field name -> message. A field with no problem is absent. */
export type Problems = Record<string, string | undefined>;

/** Characters as people count them, so an emoji or an accented letter is one. */
const lengthOf = (value: string) => Array.from(value).length;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function nameProblem(name: string): string | undefined {
  const value = name.trim();
  if (!value) return "Enter your full name.";
  if (lengthOf(value) > NAME_MAX) return `Use ${NAME_MAX} characters or fewer.`;
  return undefined;
}

export function emailProblem(email: string): string | undefined {
  const value = email.trim();
  if (!value) return "Enter your email address.";
  if (value.length > EMAIL_MAX || !EMAIL_PATTERN.test(value)) {
    return "Enter an email address like name@example.com.";
  }
  return undefined;
}

/** For a password being chosen. Spaces count: a password is never trimmed. */
export function newPasswordProblem(password: string): string | undefined {
  if (!password) return "Choose a password.";
  if (lengthOf(password) < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (lengthOf(password) > PASSWORD_MAX) return `Use ${PASSWORD_MAX} characters or fewer.`;
  return undefined;
}

/** For a password being entered to sign in: only that there is one. */
export function currentPasswordProblem(password: string): string | undefined {
  return password ? undefined : "Enter your password.";
}

/** Drops the fields that have no problem, so an empty object means "all good". */
function only(problems: Problems): Problems {
  return Object.fromEntries(Object.entries(problems).filter(([, message]) => Boolean(message)));
}

export const hasProblems = (problems: Problems) => Object.values(problems).some(Boolean);

export function signInProblems(input: { email: string; password: string }): Problems {
  return only({ email: emailProblem(input.email), password: currentPasswordProblem(input.password) });
}

// --- Roles -------------------------------------------------------------------

/**
 * Behaviour tied to an API code (not a list): the group of the roles for
 * people looking for a property. An account is either in this group (buyer,
 * tenant or both) or has roles from the other groups, never both. The API
 * enforces the same rule.
 */
export const SEEKER_GROUP = "PROPERTY_SEEKERS";

type RoleGroupLike = { code: string; roles: { code: string }[] };

export function splitRoleGroups<G extends RoleGroupLike>(groups: G[]): { seekers: G[]; others: G[] } {
  return {
    seekers: groups.filter((group) => group.code === SEEKER_GROUP),
    others: groups.filter((group) => group.code !== SEEKER_GROUP),
  };
}

export function rolesProblem(roles: string[], groups: RoleGroupLike[]): string | undefined {
  if (roles.length === 0) return "Choose at least one option.";
  const { seekers } = splitRoleGroups(groups);
  const seekerCodes = new Set(seekers.flatMap((group) => group.roles.map((role) => role.code)));
  const seeking = roles.some((role) => seekerCodes.has(role));
  const working = roles.some((role) => !seekerCodes.has(role));
  if (seeking && working) {
    return "Choose either the Property Seeker options or the other options, not both.";
  }
  return undefined;
}

// --- Captcha -----------------------------------------------------------------

/** The answer to the sign-up question is a whole number, sent as its digits. */
export function captchaAnswerProblem(answer: string): string | undefined {
  const value = answer.trim();
  if (!value) return "Answer the question.";
  if (!/^\d{1,9}$/.test(value)) return "Answer with a number, using digits only.";
  return undefined;
}

/** How long the API keeps a question. */
export const CAPTCHA_LIFETIME_MS = 10 * 60 * 1000;

/**
 * How long a question just received can still be answered, by this device's
 * clock. A device whose clock is wrong would see `expires_at` already past or
 * far in the future; then the API's ten minutes are assumed, and the API
 * still rejects a question that really has expired.
 */
export function captchaLifetimeMs(expiresAt: string, now: number): number {
  const left = Date.parse(expiresAt) - now;
  if (!Number.isFinite(left) || left <= 0 || left > CAPTCHA_LIFETIME_MS) return CAPTCHA_LIFETIME_MS;
  return left;
}

// --- Sign-up -----------------------------------------------------------------

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  roles: string[];
  consent: boolean;
};

/**
 * Everything on the sign-up form except the captcha, whose state (loading,
 * expired, failed) the form knows. Keys are in the order of the form.
 */
export function registerProblems(input: RegisterInput, groups: RoleGroupLike[]): Problems {
  return only({
    name: nameProblem(input.name),
    email: emailProblem(input.email),
    password: newPasswordProblem(input.password),
    roles: rolesProblem(input.roles, groups),
    consent: input.consent ? undefined : "Tick the box to agree before you create an account.",
  });
}

/** The first field, in the order given, that has a problem. */
export function firstProblem(order: readonly string[], problems: Problems): string | undefined {
  return order.find((field) => Boolean(problems[field]));
}
