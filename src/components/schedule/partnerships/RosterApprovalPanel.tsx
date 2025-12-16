import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, Loader2, Rocket, AlertTriangle, Mail, UserPlus } from "lucide-react";
import { generateRosterSchedules } from "@/lib/rosterGenerationUtils";
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
}

interface Approval {
  id: string;
  manager_id: string;
  team_id: string;
  approved: boolean;
  approved_at: string | null;
  comments: string | null;
  manager_name: string;
  team_name: string;
}

interface MissingApproval {
  team_id: string;
  team_name: string;
  manager_id: string | null;
  manager_name: string | null;
  manager_email: string | null;
}

interface RosterApprovalPanelProps {
  rosterId: string;
  teams: Team[];
  onRosterActivated?: () => void;
}

export function RosterApprovalPanel({ rosterId, teams, onRosterActivated }: RosterApprovalPanelProps) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [missingApprovals, setMissingApprovals] = useState<MissingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [creatingMissing, setCreatingMissing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
    fetchApprovals();
  }, [rosterId]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
    
    if (user) {
      // Check if user is admin or planner
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      const hasAdminAccess = roles?.some(r => r.role === 'admin' || r.role === 'planner');
      setIsAdmin(hasAdminAccess || false);
    }
  };

  const fetchApprovals = async () => {
    try {
      // Fetch existing approval records
      const { data, error } = await supabase
        .from("roster_manager_approvals")
        .select(`
          *,
          profiles!roster_manager_approvals_manager_id_fkey (
            first_name,
            last_name
          ),
          teams (
            name
          )
        `)
        .eq("roster_id", rosterId);

      if (error) throw error;

      const formattedApprovals = data.map((approval: any) => ({
        id: approval.id,
        manager_id: approval.manager_id,
        team_id: approval.team_id,
        approved: approval.approved,
        approved_at: approval.approved_at,
        comments: approval.comments,
        manager_name: `${approval.profiles.first_name} ${approval.profiles.last_name}`,
        team_name: approval.teams.name,
      }));

      setApprovals(formattedApprovals);

      // Find teams without approval records
      const approvedTeamIds = new Set(formattedApprovals.map(a => a.team_id));
      const teamsWithoutApprovals = teams.filter(t => !approvedTeamIds.has(t.id));

      if (teamsWithoutApprovals.length > 0) {
        // Fetch manager info for teams without approvals
        const missingTeamIds = teamsWithoutApprovals.map(t => t.id);
        const { data: teamManagers, error: managersError } = await supabase
          .from("team_members")
          .select(`
            team_id,
            user_id,
            profiles!team_members_user_id_fkey (
              first_name,
              last_name,
              email
            )
          `)
          .in("team_id", missingTeamIds)
          .eq("is_manager", true);

        if (managersError) throw managersError;

        const missingList: MissingApproval[] = teamsWithoutApprovals.map(team => {
          const manager = teamManagers?.find(tm => tm.team_id === team.id);
          return {
            team_id: team.id,
            team_name: team.name,
            manager_id: manager?.user_id || null,
            manager_name: manager?.profiles 
              ? `${(manager.profiles as any).first_name} ${(manager.profiles as any).last_name}` 
              : null,
            manager_email: manager?.profiles 
              ? (manager.profiles as any).email 
              : null,
          };
        });

        setMissingApprovals(missingList);
      } else {
        setMissingApprovals([]);
      }
    } catch (error) {
      console.error("Error fetching approvals:", error);
      toast.error("Failed to load approvals");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMissingRecords = async () => {
    if (missingApprovals.length === 0) return;

    setCreatingMissing(true);
    try {
      const recordsToCreate = missingApprovals
        .filter(m => m.manager_id)
        .map(m => ({
          roster_id: rosterId,
          team_id: m.team_id,
          manager_id: m.manager_id!,
          approved: false,
        }));

      if (recordsToCreate.length === 0) {
        toast.error("No managers found for missing teams. Cannot create approval records.");
        return;
      }

      const { error } = await supabase
        .from("roster_manager_approvals")
        .insert(recordsToCreate);

      if (error) throw error;

      toast.success(`Created ${recordsToCreate.length} approval record(s)`);
      fetchApprovals();
    } catch (error) {
      console.error("Error creating missing records:", error);
      toast.error("Failed to create approval records");
    } finally {
      setCreatingMissing(false);
    }
  };

  const handleApprove = async () => {
    if (!currentUserId) return;

    const myApproval = approvals.find((a) => a.manager_id === currentUserId);
    if (!myApproval) {
      toast.error("You are not authorized to approve this roster");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("roster_manager_approvals")
        .update({
          approved: true,
          approved_at: new Date().toISOString(),
          comments: comments || null,
        })
        .eq("id", myApproval.id);

      if (error) throw error;

      // Check if all approvals are complete
      const { data: allApprovals, error: checkError } = await supabase
        .from("roster_manager_approvals")
        .select("approved")
        .eq("roster_id", rosterId);

      if (checkError) throw checkError;

      // Fixed: Check for non-empty array AND all approved
      const allApproved = allApprovals.length > 0 && 
                          allApprovals.length >= teams.length && 
                          allApprovals.every((a) => a.approved);

      if (allApproved) {
        // Update roster status to approved
        const { error: updateError } = await supabase
          .from("partnership_rotation_rosters")
          .update({ status: "approved" })
          .eq("id", rosterId);

        if (updateError) throw updateError;
        toast.success("All approvals complete! Roster is now approved.");
      } else {
        toast.success("Your approval has been recorded");
      }

      fetchApprovals();
      setComments("");
    } catch (error) {
      console.error("Error approving roster:", error);
      toast.error("Failed to approve roster");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!currentUserId || !comments.trim()) {
      toast.error("Please add comments explaining the requested changes");
      return;
    }

    const myApproval = approvals.find((a) => a.manager_id === currentUserId);
    if (!myApproval) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("roster_manager_approvals")
        .update({
          approved: false,
          comments: comments,
        })
        .eq("id", myApproval.id);

      if (error) throw error;

      // Update roster status back to draft
      const { error: updateError } = await supabase
        .from("partnership_rotation_rosters")
        .update({ status: "draft" })
        .eq("id", rosterId);

      if (updateError) throw updateError;

      toast.success("Changes requested. Roster returned to draft status.");
      fetchApprovals();
      setComments("");
    } catch (error) {
      console.error("Error requesting changes:", error);
      toast.error("Failed to request changes");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const myApproval = approvals.find((a) => a.manager_id === currentUserId);
  const approvedCount = approvals.filter((a) => a.approved).length;
  const totalTeams = teams.length;
  // Fixed: All approved only if we have records for all teams AND all are approved
  const allApproved = approvals.length >= totalTeams && 
                      approvals.length > 0 && 
                      approvals.every((a) => a.approved);
  const pendingCount = approvals.filter((a) => !a.approved).length;
  const hasMissingRecords = missingApprovals.length > 0;

  const handleActivateFromPanel = async () => {
    const confirmed = confirm(
      "This will generate all schedule entries based on the approved roster. Continue?"
    );
    if (!confirmed) return;

    setActivating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const result = await generateRosterSchedules(rosterId, user.id);

      if (result.success) {
        toast.success(`Roster activated! Created ${result.entriesCreated} schedule entries.`);
        if (onRosterActivated) onRosterActivated();
      } else {
        throw new Error(result.error || "Failed to generate schedules");
      }
    } catch (error) {
      console.error("Error activating roster:", error);
      toast.error("Failed to activate roster");
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="flex items-center gap-2 text-sm">
        {hasMissingRecords || pendingCount > 0 ? (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        ) : (
          <CheckCircle className="h-4 w-4 text-green-500" />
        )}
        <span className="font-medium">
          Approval Status: {approvedCount} of {totalTeams} teams
        </span>
      </div>

      {/* Missing Approval Records Warning */}
      {hasMissingRecords && (
        <Card className="p-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-800 dark:text-amber-200">
                Missing Approval Records ({missingApprovals.length})
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                These teams don't have approval records. Each team manager must open this roster and submit for approval, or an admin can create the records below.
              </p>
            </div>
          </div>
          
          <div className="space-y-2 ml-7">
            {missingApprovals.map((missing) => (
              <div 
                key={missing.team_id} 
                className="flex items-center justify-between p-2 bg-background rounded border"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="font-medium text-sm">{missing.team_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {missing.manager_name ? (
                    <>
                      <span>Manager: {missing.manager_name}</span>
                      {missing.manager_email && (
                        <a 
                          href={`mailto:${missing.manager_email}?subject=Roster Approval Required&body=Please review and approve the roster rotation schedule.`}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <Mail className="h-3 w-3" />
                          Contact
                        </a>
                      )}
                    </>
                  ) : (
                    <span className="text-destructive">No manager assigned</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isAdmin && missingApprovals.some(m => m.manager_id) && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 ml-7 gap-2"
              onClick={handleCreateMissingRecords}
              disabled={creatingMissing}
            >
              {creatingMissing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Create Missing Approval Records
            </Button>
          )}
        </Card>
      )}

      {/* Existing Approval Records */}
      {approvals.length > 0 && (
        <div className="grid gap-3">
          {approvals.map((approval) => (
            <Card key={approval.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{approval.manager_name}</span>
                    <Badge variant="outline">{approval.team_name}</Badge>
                    {approval.approved ? (
                      <Badge variant="default" className="gap-1 bg-green-600">
                        <CheckCircle className="h-3 w-3" />
                        Approved
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                  </div>
                  {approval.approved_at && (
                    <p className="text-sm text-muted-foreground">
                      Approved on {new Date(approval.approved_at).toLocaleString()}
                    </p>
                  )}
                  {approval.comments && (
                    <p className="text-sm mt-2 p-2 bg-muted rounded">
                      {approval.comments}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {approvals.length === 0 && !hasMissingRecords && (
        <Card className="p-4 text-center text-muted-foreground">
          No approval records found. Submit the roster for approval to create records.
        </Card>
      )}

      {myApproval && !myApproval.approved && (
        <Card className="p-4 bg-primary/5">
          <h4 className="font-medium mb-2">Your Approval</h4>
          <div className="space-y-3">
            <Textarea
              placeholder="Add comments (optional for approval, required for requesting changes)"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button onClick={handleApprove} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Approve My Team's Assignments
              </Button>
              <Button
                variant="outline"
                onClick={handleRequestChanges}
                disabled={submitting}
              >
                Request Changes
              </Button>
            </div>
          </div>
        </Card>
      )}

      {allApproved && (
        <Card className="p-4 bg-green-50 dark:bg-green-950 space-y-3">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">
              All managers have approved this roster!
            </span>
          </div>
          <Button
            onClick={handleActivateFromPanel}
            disabled={activating}
            className="w-full gap-2"
          >
            <Rocket className="h-4 w-4" />
            {activating ? "Activating..." : "Activate Roster - Generate Schedule Entries"}
          </Button>
        </Card>
      )}

      {!allApproved && (pendingCount > 0 || hasMissingRecords) && (
        <div className="text-sm text-muted-foreground">
          {pendingCount > 0 && (
            <span>Waiting for {pendingCount} pending approval{pendingCount > 1 ? "s" : ""}</span>
          )}
          {pendingCount > 0 && hasMissingRecords && <span> and </span>}
          {hasMissingRecords && (
            <span>{missingApprovals.length} team{missingApprovals.length > 1 ? "s" : ""} without approval records</span>
          )}
        </div>
      )}
    </div>
  );
}
