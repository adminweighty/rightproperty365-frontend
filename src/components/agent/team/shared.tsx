"use client";

import type { Ref } from "react";
import { Alert } from "@/components/ui/alert";
import type { ApiFailure } from "@/lib/api/http";
import type { GivenRole, TeamInvitation, TeamMember } from "@/lib/api/team";
import { teamMessage } from "@/lib/team-messages";

/** The result of an action, shown where the action was taken. */
export type Notice = { tone: "success" | "danger" | "warning"; text: string; traceId?: string };

export const failureNotice = (failure: ApiFailure, tone: Notice["tone"] = "danger"): Notice => ({
  tone,
  text: teamMessage(failure),
  // A known code is explained in plain words; a support reference only helps with the unexpected.
  traceId: teamMessage(failure) === failure.message ? failure.traceId : undefined,
});

/** A focusable live region for the result of an action. */
export function NoticeArea({ notice, ref }: { notice: Notice | null; ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} tabIndex={-1} aria-live="polite" className="outline-none">
      {notice && <Alert tone={notice.tone} title={notice.text} traceId={notice.traceId} className="mt-3" />}
    </div>
  );
}

export const GIVEN_ROLES: GivenRole[] = ["MANAGER", "AGENT", "STAFF"];

const agencyTitles: Record<GivenRole, string> = {
  MANAGER: "Agency Administrator",
  AGENT: "Estate Agent",
  STAFF: "Agency Staff",
};
const otherTitles: Record<GivenRole, string> = { MANAGER: "Manager", AGENT: "Estate Agent", STAFF: "Staff" };

/**
 * The title of each role in this organisation. The API's own labels (on the
 * members and invitations it sent) win; the fallbacks are the API's wording
 * for an agency and for other kinds of organisation.
 */
export function roleTitles(
  kind: string,
  members: Pick<TeamMember, "role" | "role_label">[] = [],
  invitations: Pick<TeamInvitation, "role" | "role_label">[] = [],
): Record<GivenRole, string> {
  const titles = { ...(kind === "AGENCY" ? agencyTitles : otherTitles) };
  for (const item of [...members, ...invitations]) {
    if (item.role !== "OWNER" && item.role_label) titles[item.role] = item.role_label;
  }
  return titles;
}

/** The roles a caller with this role may invite: an owner any, a manager agents and staff. */
export const invitableRoles = (callerRole: string): GivenRole[] =>
  callerRole === "OWNER" ? GIVEN_ROLES : callerRole === "MANAGER" ? ["AGENT", "STAFF"] : [];

export const countLabel = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
