import { describe, it, expect } from "vitest";
import {
  canSubmit,
  canApprove,
  canActivate,
  canEdit,
  applyEditSideEffects,
  computeRosterStatusFromApprovals,
  type RosterLite,
  type ApprovalLite,
  type UserLite,
} from "./rosterWorkflow";

const makeRoster = (overrides: Partial<RosterLite> = {}): RosterLite => ({
  id: "r1",
  status: "draft",
  version: 1,
  partnership_id: "p1",
  ...overrides,
});

const makeUser = (overrides: Partial<UserLite> = {}): UserLite => ({
  id: "u1",
  isAdminOrPlanner: false,
  managedTeamIds: ["t1"],
  ...overrides,
});

const approval = (
  team: string,
  manager: string,
  state: ApprovalLite["state"] = "pending",
  version = 1
): ApprovalLite => ({
  roster_id: "r1",
  team_id: team,
  manager_id: manager,
  state,
  roster_version: version,
});

describe("canSubmit", () => {
  it("blocks submit when no assignments", () => {
    expect(canSubmit(makeRoster(), []).ok).toBe(false);
  });
  it("allows submit with assignments", () => {
    expect(
      canSubmit(makeRoster(), [{ roster_id: "r1", team_id: "t1" }]).ok
    ).toBe(true);
  });
  it("blocks submit when activated", () => {
    expect(
      canSubmit(makeRoster({ status: "activated" }), [
        { roster_id: "r1", team_id: "t1" },
      ]).ok
    ).toBe(false);
  });
});

describe("canApprove", () => {
  it("blocks approve when status is draft", () => {
    const r = makeRoster({ status: "draft" });
    expect(canApprove(makeUser(), r, "t1", [approval("t1", "u1")]).ok).toBe(
      false
    );
  });
  it("allows approve when submitted and user manages team", () => {
    const r = makeRoster({ status: "submitted" });
    expect(canApprove(makeUser(), r, "t1", [approval("t1", "u1")]).ok).toBe(
      true
    );
  });
  it("blocks cross-team approve", () => {
    const r = makeRoster({ status: "submitted" });
    expect(canApprove(makeUser(), r, "t2", [approval("t2", "u2")]).ok).toBe(
      false
    );
  });
});

describe("canActivate", () => {
  it("blocks when not fully_approved", () => {
    const r = makeRoster({ status: "partially_approved" });
    expect(canActivate(r, [approval("t1", "u1", "approved")], makeUser()).ok).toBe(
      false
    );
  });
  it("allows when fully_approved and all current version", () => {
    const r = makeRoster({ status: "fully_approved", version: 2 });
    expect(
      canActivate(
        r,
        [
          approval("t1", "u1", "approved", 2),
          approval("t2", "u2", "approved", 2),
        ],
        makeUser()
      ).ok
    ).toBe(true);
  });
  it("blocks when an approval is for an older version", () => {
    const r = makeRoster({ status: "fully_approved", version: 2 });
    expect(
      canActivate(
        r,
        [
          approval("t1", "u1", "approved", 1),
          approval("t2", "u2", "approved", 2),
        ],
        makeUser()
      ).ok
    ).toBe(false);
  });
  it("admin/planner override allowed", () => {
    const r = makeRoster({ status: "needs_changes" });
    expect(
      canActivate(r, [], makeUser({ isAdminOrPlanner: true })).ok
    ).toBe(true);
  });
});

describe("canEdit", () => {
  it("blocks edit on activated rosters", () => {
    expect(
      canEdit(makeUser(), makeRoster({ status: "activated" }), "t1").ok
    ).toBe(false);
  });
  it("blocks cross-team edit for non-admins", () => {
    expect(canEdit(makeUser(), makeRoster(), "t2").ok).toBe(false);
  });
  it("admins can edit any team", () => {
    expect(
      canEdit(makeUser({ isAdminOrPlanner: true }), makeRoster(), "t99").ok
    ).toBe(true);
  });
});

describe("applyEditSideEffects", () => {
  it("no-op on draft rosters", () => {
    const r = makeRoster();
    const result = applyEditSideEffects(r, []);
    expect(result.changed).toBe(false);
    expect(result.roster.version).toBe(1);
  });
  it("bumps version and resets approvals when previously submitted", () => {
    const r = makeRoster({ status: "fully_approved", version: 3 });
    const approvals = [
      approval("t1", "u1", "approved", 3),
      approval("t2", "u2", "approved", 3),
    ];
    const result = applyEditSideEffects(r, approvals);
    expect(result.changed).toBe(true);
    expect(result.roster.version).toBe(4);
    expect(result.roster.status).toBe("draft");
    expect(result.approvals.every((a) => a.state === "pending")).toBe(true);
  });
});

describe("computeRosterStatusFromApprovals", () => {
  it("returns needs_changes if any rejected", () => {
    expect(
      computeRosterStatusFromApprovals("submitted", [
        approval("t1", "u1", "approved"),
        approval("t2", "u2", "rejected"),
      ])
    ).toBe("needs_changes");
  });
  it("returns fully_approved when all approved", () => {
    expect(
      computeRosterStatusFromApprovals("partially_approved", [
        approval("t1", "u1", "approved"),
        approval("t2", "u2", "approved"),
      ])
    ).toBe("fully_approved");
  });
  it("returns partially_approved with mixed approved/pending", () => {
    expect(
      computeRosterStatusFromApprovals("submitted", [
        approval("t1", "u1", "approved"),
        approval("t2", "u2", "pending"),
      ])
    ).toBe("partially_approved");
  });
  it("activated is sticky", () => {
    expect(
      computeRosterStatusFromApprovals("activated", [
        approval("t1", "u1", "rejected"),
      ])
    ).toBe("activated");
  });
});