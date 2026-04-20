/**
 * Pure-function guards for the partnership rotation roster workflow.
 *
 * The DB enforces these too via triggers/RPC; these mirror the rules
 * client-side for fast UX feedback and unit-testability.
 */

export type RosterStatus =
  | "draft"
  | "submitted"
  | "partially_approved"
  | "fully_approved"
  | "needs_changes"
  | "activated";

export type ApprovalState = "pending" | "approved" | "rejected";

export interface RosterLite {
  id: string;
  status: RosterStatus;
  version: number;
  partnership_id: string;
}

export interface ApprovalLite {
  roster_id: string;
  team_id: string;
  manager_id: string;
  state: ApprovalState;
  roster_version: number;
}

export interface UserLite {
  id: string;
  isAdminOrPlanner: boolean;
  managedTeamIds: string[];
}

export interface AssignmentLite {
  roster_id: string;
  team_id: string;
}

export interface GuardResult {
  ok: boolean;
  reason?: string;
}

const OK: GuardResult = { ok: true };
const fail = (reason: string): GuardResult => ({ ok: false, reason });

export function canSubmit(
  roster: RosterLite,
  assignments: AssignmentLite[]
): GuardResult {
  if (roster.status === "activated") return fail("Roster is already activated");
  if (assignments.length === 0)
    return fail("Roster has no assignments to submit");
  return OK;
}

export function canApprove(
  user: UserLite,
  roster: RosterLite,
  teamId: string,
  approvals: ApprovalLite[]
): GuardResult {
  if (
    roster.status !== "submitted" &&
    roster.status !== "partially_approved" &&
    roster.status !== "needs_changes"
  ) {
    return fail(`Cannot approve roster in status ${roster.status}`);
  }

  if (!user.isAdminOrPlanner && !user.managedTeamIds.includes(teamId)) {
    return fail("You are not a manager of this team");
  }

  const myApproval = approvals.find(
    (a) => a.team_id === teamId && a.manager_id === user.id
  );
  if (!myApproval && !user.isAdminOrPlanner) {
    return fail("No approval record for you on this team");
  }

  return OK;
}

export function canReject(
  user: UserLite,
  roster: RosterLite,
  teamId: string
): GuardResult {
  // Same gating as approve
  return canApprove(user, roster, teamId, []);
}

export function canActivate(
  roster: RosterLite,
  approvals: ApprovalLite[],
  user: UserLite
): GuardResult {
  if (roster.status === "activated") return fail("Already activated");
  if (user.isAdminOrPlanner) return OK;

  if (roster.status !== "fully_approved")
    return fail(`Roster must be fully_approved (current: ${roster.status})`);

  if (approvals.length === 0) return fail("No approvals recorded");

  const allApprovedCurrentVersion = approvals.every(
    (a) => a.state === "approved" && a.roster_version === roster.version
  );
  if (!allApprovedCurrentVersion)
    return fail("Some teams have not approved the current version");

  return OK;
}

export function canEdit(
  user: UserLite,
  roster: RosterLite,
  teamId: string
): GuardResult {
  if (roster.status === "activated") return fail("Activated rosters are locked");
  if (user.isAdminOrPlanner) return OK;
  if (!user.managedTeamIds.includes(teamId))
    return fail("You can only edit your own team's rows");
  return OK;
}

/**
 * Apply the optimistic side effects of an edit:
 * bumps version, resets all approvals to pending, sets status to draft.
 * The DB trigger does the same — this is for UI consistency before refetch.
 */
export function applyEditSideEffects(
  roster: RosterLite,
  approvals: ApprovalLite[]
): { roster: RosterLite; approvals: ApprovalLite[]; changed: boolean } {
  const wasSubmitted =
    roster.status === "submitted" ||
    roster.status === "partially_approved" ||
    roster.status === "fully_approved" ||
    roster.status === "needs_changes";

  if (!wasSubmitted) {
    return { roster, approvals, changed: false };
  }

  return {
    roster: { ...roster, version: roster.version + 1, status: "draft" },
    approvals: approvals.map((a) => ({ ...a, state: "pending" as const })),
    changed: true,
  };
}

export function computeRosterStatusFromApprovals(
  current: RosterStatus,
  approvals: ApprovalLite[]
): RosterStatus {
  if (current === "activated") return current;
  if (approvals.length === 0) return current;

  const total = approvals.length;
  const approved = approvals.filter((a) => a.state === "approved").length;
  const rejected = approvals.filter((a) => a.state === "rejected").length;

  if (rejected > 0) return "needs_changes";
  if (approved === total) return "fully_approved";
  if (approved > 0) return "partially_approved";
  return current === "draft" ? "submitted" : current;
}