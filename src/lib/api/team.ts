import { apiFetch } from "@/lib/api/http";

/*
 * Agency teams (API 0.23.0): members, invitations, join requests and the
 * team's audit trail, for an organisation's OWNER and MANAGER (the
 * dashboard's `organisations[].can_manage_team`; other members get 403), and
 * the invitation link anyone holding it can open.
 */

export type TeamRole = "OWNER" | "MANAGER" | "AGENT" | "STAFF";
/** The roles a member can be given or invited with. Nobody is made an OWNER. */
export type GivenRole = Exclude<TeamRole, "OWNER">;

/** One member of an organisation. No email address or phone number. */
export type TeamMember = {
  user_id: string;
  name: string;
  role: TeamRole;
  /** "Agency Principal", "Estate Agent"… */
  role_label: string;
  job_title: string | null;
  status: "ACTIVE" | "SUSPENDED";
  status_label: string;
  market_code: string;
  joined_at: string | null;
  /** Open requests (not converted or closed) assigned to the member. */
  open_leads: number;
  is_you: boolean;
  /** The caller may change this member's role, status or job title, or remove them. */
  can_change: boolean;
  /** The roles the caller may give this member (empty when `can_change` is false). */
  allowed_roles: GivenRole[];
  /** Requests can be assigned to this member (an ACTIVE OWNER, MANAGER or AGENT). */
  can_hold_leads: boolean;
};

export type TeamOrganisation = { id: string; name: string; kind: string };

export type TeamMembers = { organisation: TeamOrganisation; items: TeamMember[] };

/** A pending invitation. Never its token. */
export type TeamInvitation = {
  id: string;
  email: string;
  role: GivenRole;
  role_label: string;
  job_title: string | null;
  status: "PENDING" | "ACCEPTED" | "CANCELLED" | "REPLACED";
  invited_by: { user_id: string | null; name: string };
  created_at: string;
  expires_at: string;
  /** Still listed after 7 days; invite the address again to send a new link. */
  expired: boolean;
  can_cancel: boolean;
};

/** A submitted application to join the agency, as the agency sees it. */
export type JoinRequest = {
  id: string;
  role: string;
  role_label: string;
  membership_role: GivenRole;
  membership_role_label: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  status_label: string;
  applicant: { user_id: string; name: string; email_masked: string };
  job_title: string | null;
  document_count: number;
  submitted_at: string | null;
  decision_reason: string | null;
  decided_at: string | null;
  can_decide: boolean;
};

export type TeamAuditEvent = {
  id: string;
  action: string;
  action_label: string;
  actor: { user_id: string | null; name: string };
  target: { type: "MEMBER" | "INVITATION" | "JOIN_REQUEST" | "PROPERTY_REQUEST"; id: string; label: string };
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: string;
};

export type TeamAuditPage = {
  items: TeamAuditEvent[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

/** What an invitation link shows to anyone holding it. */
export type PublicInvitation = {
  organisation: { name: string; kind: string };
  role: GivenRole;
  role_label: string;
  job_title: string | null;
  invited_by_name: string;
  /** "n•••@example.com". */
  email_masked: string;
  expires_at: string;
};

export type AcceptedInvitation = {
  organisation: TeamOrganisation;
  role: GivenRole;
  role_label: string;
  /** The public agent profile created for an agency's AGENT; null otherwise. */
  profile: { kind: string; slug: string } | null;
};

const base = (organisationId: string) => `/v1/agent/organisations/${organisationId}`;

export const listTeamMembers = (organisationId: string) =>
  apiFetch<TeamMembers>(`${base(organisationId)}/members`, { cache: "no-store" });

/** At least one key. An empty `job_title` clears it. */
export const changeTeamMember = (
  organisationId: string,
  userId: string,
  change: { role?: GivenRole; status?: "ACTIVE" | "SUSPENDED"; job_title?: string },
) =>
  apiFetch<{ member: TeamMember }>(`${base(organisationId)}/members/${userId}`, { method: "PATCH", body: change });

/** Their open requests and appointments go back to the organisation inbox. */
export const removeTeamMember = (organisationId: string, userId: string) =>
  apiFetch<null>(`${base(organisationId)}/members/${userId}`, { method: "DELETE" });

export const listTeamInvitations = (organisationId: string) =>
  apiFetch<{ items: TeamInvitation[] }>(`${base(organisationId)}/invitations`, { cache: "no-store" });

/** Inviting an address that already has a pending invitation replaces it. */
export const inviteTeamMember = (
  organisationId: string,
  input: { email: string; role: GivenRole; job_title?: string },
) =>
  apiFetch<{ invitation: TeamInvitation }>(`${base(organisationId)}/invitations`, { method: "POST", body: input });

export const cancelTeamInvitation = (organisationId: string, invitationId: string) =>
  apiFetch<null>(`${base(organisationId)}/invitations/${invitationId}`, { method: "DELETE" });

export const listJoinRequests = (organisationId: string) =>
  apiFetch<{ items: JoinRequest[] }>(`${base(organisationId)}/join-requests`, { cache: "no-store" });

export const approveJoinRequest = (organisationId: string, requestId: string) =>
  apiFetch<{ join_request: JoinRequest }>(`${base(organisationId)}/join-requests/${requestId}/approve`, {
    method: "POST",
  });

/** `reason`: 5 to 500 characters, emailed to the applicant. */
export const declineJoinRequest = (organisationId: string, requestId: string, reason: string) =>
  apiFetch<{ join_request: JoinRequest }>(`${base(organisationId)}/join-requests/${requestId}/decline`, {
    method: "POST",
    body: { reason },
  });

export const listTeamAudit = (organisationId: string, page: number, pageSize = 20) =>
  apiFetch<TeamAuditPage>(`${base(organisationId)}/audit?page=${page}&page_size=${pageSize}`, { cache: "no-store" });

/** Public: no session needed. */
export const getInvitation = (token: string) =>
  apiFetch<{ invitation: PublicInvitation }>(`/v1/invitations/${encodeURIComponent(token)}`, { cache: "no-store" });

/** Signed in with the invited address. */
export const acceptInvitation = (token: string) =>
  apiFetch<AcceptedInvitation>(`/v1/invitations/${encodeURIComponent(token)}/accept`, { method: "POST" });
