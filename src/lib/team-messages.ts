/**
 * Plain words for the answers of the team and invitation routes (API
 * 0.23.0), by error code. Pure, with no imports, so `npm test` can run it.
 * A code that is not here keeps the API's own message.
 */

const teamMessages: Record<string, string> = {
  FORBIDDEN: "Only the Agency Principal or an Agency Administrator can manage the team.",
  ROLE_NOT_ALLOWED: "Your role cannot give that role or change this person. Ask the Agency Principal.",
  OWNER_PROTECTED: "The Agency Principal cannot be changed or removed here.",
  SELF_CHANGE_FORBIDDEN: "You cannot change or remove yourself. Ask another manager or the Agency Principal.",
  LAST_OWNER: "This is the organisation's only principal, so they cannot be changed or removed.",
  MEMBER_NOT_FOUND: "That person is no longer in the team. The list has been loaded again.",
  ALREADY_A_MEMBER: "That person is already in the team.",
  INVITATION_NOT_FOUND: "That invitation could not be found. The list has been loaded again.",
  INVITATION_NO_LONGER_VALID: "That invitation was already accepted, cancelled or replaced.",
  INVITATION_EXPIRED: "That invitation has expired.",
  JOIN_REQUEST_NOT_FOUND: "That request to join could not be found. The list has been loaded again.",
  JOIN_REQUEST_ALREADY_DECIDED:
    "Someone has already decided this request to join (another manager or our verification team). The list has been loaded again.",
  AGENCY_NOT_VERIFIED: "Your agency must be verified before people can join it.",
  ORGANISATION_NOT_FOUND: "We could not find that organisation, or you are no longer an active member of it.",
  RATE_LIMITED: "That was a lot of changes at once. Please wait a minute and try again.",
};

/** The message to show for a failed team action. */
export function teamMessage(failure: { code: string; message: string }): string {
  return teamMessages[failure.code] ?? failure.message;
}

/** Codes after which the list on screen is out of date and is read again. */
export const STALE_CODES = new Set([
  "MEMBER_NOT_FOUND",
  "INVITATION_NOT_FOUND",
  "INVITATION_NO_LONGER_VALID",
  "JOIN_REQUEST_NOT_FOUND",
  "JOIN_REQUEST_ALREADY_DECIDED",
  "LAST_OWNER",
  "ALREADY_A_MEMBER",
]);

export const JOB_TITLE_MAX = 80;
export const DECLINE_MIN = 5;
export const DECLINE_MAX = 500;

/** The reason for declining a request to join: 5 to 500 characters once trimmed. */
export function declineReasonProblem(reason: string): string | undefined {
  const length = Array.from(reason.trim()).length;
  if (length === 0) return "Write why you are declining. The applicant is emailed this reason.";
  if (length < DECLINE_MIN) return `Use at least ${DECLINE_MIN} characters.`;
  if (length > DECLINE_MAX) return `Use ${DECLINE_MAX} characters or fewer.`;
  return undefined;
}

/** A job title: optional, one line, at most 80 characters. */
export function jobTitleProblem(title: string): string | undefined {
  const value = title.trim();
  if (/[\r\n]/.test(value)) return "Keep the job title on one line.";
  if (Array.from(value).length > JOB_TITLE_MAX) return `Use ${JOB_TITLE_MAX} characters or fewer.`;
  return undefined;
}
