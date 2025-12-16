import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Calendar, Copy, AlertCircle, CheckCircle2, Clock, Users } from "lucide-react";
import { RosterBuilderDialog } from "./RosterBuilderDialog";
import { CloneRosterDialog } from "./CloneRosterDialog";
import { toast } from "sonner";

interface Roster {
  id: string;
  roster_name: string;
  shift_type: string;
  cycle_length_weeks: number;
  start_date: string;
  end_date: string | null;
  status: "draft" | "pending_approval" | "approved" | "implemented";
  default_shift_for_non_duty: string;
  created_at: string;
}

interface TeamProgress {
  teamId: string;
  teamName: string;
  hasAssignments: boolean;
  isUserTeam: boolean;
}

interface RosterProgress {
  rosterId: string;
  teams: TeamProgress[];
  teamsComplete: number;
  teamsTotal: number;
  needsUserAction: boolean;
}

interface PartnershipRotationManagerProps {
  partnershipId: string;
  partnershipName: string;
}

export function PartnershipRotationManager({
  partnershipId,
  partnershipName,
}: PartnershipRotationManagerProps) {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoster, setSelectedRoster] = useState<Roster | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [rosterToClone, setRosterToClone] = useState<Roster | null>(null);
  const [rosterProgress, setRosterProgress] = useState<Record<string, RosterProgress>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userTeamIds, setUserTeamIds] = useState<string[]>([]);

  useEffect(() => {
    fetchCurrentUser();
    fetchRosters();
  }, [partnershipId]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      // Fetch user's teams where they are a manager
      const { data: memberships } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id)
        .eq("is_manager", true);
      
      if (memberships) {
        setUserTeamIds(memberships.map(m => m.team_id));
      }
    }
  };

  const fetchRosters = async () => {
    try {
      const { data, error } = await supabase
        .from("partnership_rotation_rosters")
        .select("*")
        .eq("partnership_id", partnershipId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rostersData = (data || []) as Roster[];
      setRosters(rostersData);
      
      // Fetch progress for each non-implemented roster
      for (const roster of rostersData) {
        if (roster.status !== "implemented") {
          fetchRosterProgress(roster.id);
        }
      }
    } catch (error) {
      console.error("Error fetching rosters:", error);
      toast.error("Failed to load rotation rosters");
    } finally {
      setLoading(false);
    }
  };

  const fetchRosterProgress = async (rosterId: string) => {
    try {
      // Get partnership teams
      const { data: partnership } = await supabase
        .from("team_planning_partners")
        .select("team_ids")
        .eq("id", partnershipId)
        .single();

      if (!partnership?.team_ids) return;

      // Get team names
      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", partnership.team_ids);

      // Get assignments for this roster
      const { data: assignments } = await supabase
        .from("roster_week_assignments")
        .select("team_id")
        .eq("roster_id", rosterId);

      const teamsWithAssignments = new Set(assignments?.map(a => a.team_id) || []);

      const teams: TeamProgress[] = (teamsData || []).map(team => ({
        teamId: team.id,
        teamName: team.name,
        hasAssignments: teamsWithAssignments.has(team.id),
        isUserTeam: userTeamIds.includes(team.id),
      }));

      const teamsComplete = teams.filter(t => t.hasAssignments).length;
      const needsUserAction = teams.some(t => t.isUserTeam && !t.hasAssignments);

      setRosterProgress(prev => ({
        ...prev,
        [rosterId]: {
          rosterId,
          teams,
          teamsComplete,
          teamsTotal: teams.length,
          needsUserAction,
        },
      }));
    } catch (error) {
      console.error("Error fetching roster progress:", error);
    }
  };

  // Re-fetch progress when userTeamIds changes
  useEffect(() => {
    if (userTeamIds.length > 0 && rosters.length > 0) {
      for (const roster of rosters) {
        if (roster.status !== "implemented") {
          fetchRosterProgress(roster.id);
        }
      }
    }
  }, [userTeamIds]);

  const handleCreateNew = () => {
    setSelectedRoster(null);
    setShowBuilder(true);
  };

  const handleEditRoster = (roster: Roster) => {
    setSelectedRoster(roster);
    setShowBuilder(true);
  };

  const handleCloneRoster = (roster: Roster) => {
    setRosterToClone(roster);
    setShowCloneDialog(true);
  };

  const handleConfirmClone = async (newName: string, newStartDate: string) => {
    if (!rosterToClone) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in to clone a roster");
        return;
      }

      // Create new roster record
      const { data: newRoster, error: rosterError } = await supabase
        .from("partnership_rotation_rosters")
        .insert({
          partnership_id: partnershipId,
          roster_name: newName,
          shift_type: rosterToClone.shift_type,
          cycle_length_weeks: rosterToClone.cycle_length_weeks,
          start_date: newStartDate,
          default_shift_for_non_duty: rosterToClone.default_shift_for_non_duty,
          status: "draft",
          created_by: user.id,
        })
        .select()
        .single();

      if (rosterError) throw rosterError;

      // Fetch all assignments from source roster
      const { data: sourceAssignments, error: assignmentsError } = await supabase
        .from("roster_week_assignments")
        .select("*")
        .eq("roster_id", rosterToClone.id);

      if (assignmentsError) throw assignmentsError;

      // Clone all assignments to new roster
      if (sourceAssignments && sourceAssignments.length > 0) {
        const clonedAssignments = sourceAssignments.map((assignment) => ({
          roster_id: newRoster.id,
          week_number: assignment.week_number,
          team_id: assignment.team_id,
          user_id: assignment.user_id,
          shift_type: assignment.shift_type,
          day_of_week: assignment.day_of_week,
          include_weekends: assignment.include_weekends,
          notes: assignment.notes,
          assigned_by: user.id,
        }));

        const { error: insertError } = await supabase
          .from("roster_week_assignments")
          .insert(clonedAssignments);

        if (insertError) throw insertError;
      }

      toast.success(
        `Roster cloned successfully with ${sourceAssignments?.length || 0} assignments`
      );
      
      fetchRosters();
      
      // Open the cloned roster in edit mode
      setSelectedRoster(newRoster as Roster);
      setShowBuilder(true);
    } catch (error) {
      console.error("Error cloning roster:", error);
      toast.error("Failed to clone roster");
    }
  };

  const handleDeleteRoster = async (roster: Roster) => {
    const isImplemented = roster.status === "implemented";
    
    let confirmMessage = "Are you sure you want to delete this rotation roster?";
    if (isImplemented) {
      confirmMessage = "⚠️ This roster has been implemented and schedule entries exist.\n\nDo you want to:\n- Delete roster AND all associated schedule entries? (Click OK)\n- Cancel? (Click Cancel)";
    }
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      if (isImplemented) {
        toast.warning("Roster deleted. Note: Existing schedule entries were not automatically removed.");
      }

      const { error } = await supabase
        .from("partnership_rotation_rosters")
        .delete()
        .eq("id", roster.id);

      if (error) throw error;
      
      toast.success("Rotation roster deleted successfully");
      fetchRosters();
    } catch (error) {
      console.error("Error deleting roster:", error);
      toast.error("Failed to delete rotation roster");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string; className?: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      pending_approval: { variant: "default", label: "Pending Approval", className: "bg-amber-500 hover:bg-amber-600" },
      approved: { variant: "default", label: "Approved", className: "bg-green-500 hover:bg-green-600" },
      implemented: { variant: "default", label: "Implemented", className: "bg-blue-500 hover:bg-blue-600" },
    };

    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  // Separate rosters into action-needed and others
  const actionNeededRosters = rosters.filter(r => 
    (r.status === "draft" || r.status === "pending_approval") && 
    rosterProgress[r.id]?.needsUserAction
  );
  const otherRosters = rosters.filter(r => 
    !actionNeededRosters.includes(r)
  );

  if (loading) {
    return <div className="text-muted-foreground">Loading rosters...</div>;
  }

  const renderRosterCard = (roster: Roster, isActionNeeded: boolean = false) => {
    const progress = rosterProgress[roster.id];
    const isEditable = roster.status === "draft" || roster.status === "pending_approval";

    return (
      <Card 
        key={roster.id} 
        className={`p-4 ${isActionNeeded ? 'border-amber-500 border-2 bg-amber-50/50 dark:bg-amber-950/20' : ''}`}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium">{roster.roster_name}</h4>
                {getStatusBadge(roster.status)}
                {isActionNeeded && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/50">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Needs Your Input
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{roster.cycle_length_weeks} week cycle</span>
                </div>
                <div>
                  Starts: {new Date(roster.start_date).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={isActionNeeded ? "default" : "outline"}
                size="sm"
                onClick={() => handleEditRoster(roster)}
                className={isActionNeeded ? "bg-amber-600 hover:bg-amber-700" : ""}
              >
                {isActionNeeded ? "Complete Your Planning" : (isEditable ? "Edit" : "View")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCloneRoster(roster)}
              >
                <Copy className="h-4 w-4 mr-1" />
                Clone
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteRoster(roster)}
              >
                Delete
              </Button>
            </div>
          </div>

          {/* Team Progress Section */}
          {progress && isEditable && (
            <div className="pt-3 border-t space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Team Progress
                </span>
                <span className="font-medium">
                  {progress.teamsComplete} / {progress.teamsTotal} teams
                </span>
              </div>
              <Progress 
                value={(progress.teamsComplete / progress.teamsTotal) * 100} 
                className="h-2"
              />
              <div className="flex flex-wrap gap-2">
                {progress.teams.map(team => (
                  <Badge 
                    key={team.teamId} 
                    variant={team.hasAssignments ? "secondary" : "outline"}
                    className={`text-xs ${
                      team.isUserTeam 
                        ? team.hasAssignments 
                          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-300" 
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-500 border-dashed"
                        : ""
                    }`}
                  >
                    {team.hasAssignments ? (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    ) : (
                      <Clock className="h-3 w-3 mr-1" />
                    )}
                    {team.teamName}
                    {team.isUserTeam && " (Your Team)"}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Action Needed Section */}
      {actionNeededRosters.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-amber-600 dark:text-amber-400">
              Action Needed
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            These rosters are waiting for your team's assignments. Click to add your planning.
          </p>
          <div className="grid gap-4">
            {actionNeededRosters.map((roster) => renderRosterCard(roster, true))}
          </div>
        </div>
      )}

      {/* Other Rosters Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {actionNeededRosters.length > 0 ? "Other Rotation Schedules" : "Rotation Schedules"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Manage unified weekly rotation schedules for {partnershipName}
            </p>
          </div>
          <Button variant={actionNeededRosters.length > 0 ? "outline" : "default"} onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create New Schedule
          </Button>
        </div>

        {otherRosters.length === 0 && actionNeededRosters.length === 0 ? (
          <Card className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h4 className="text-lg font-medium mb-2">No Rotation Schedules</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first rotation schedule to assign shifts to team members across the partnership
            </p>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create Schedule
            </Button>
          </Card>
        ) : otherRosters.length > 0 ? (
          <div className="grid gap-4">
            {otherRosters.map((roster) => renderRosterCard(roster, false))}
          </div>
        ) : null}
      </div>

      {showBuilder && (
        <RosterBuilderDialog
          partnershipId={partnershipId}
          partnershipName={partnershipName}
          roster={selectedRoster}
          open={showBuilder}
          onOpenChange={setShowBuilder}
          onSuccess={() => {
            fetchRosters();
            setShowBuilder(false);
          }}
        />
      )}

      {showCloneDialog && rosterToClone && (
        <CloneRosterDialog
          open={showCloneDialog}
          onOpenChange={setShowCloneDialog}
          sourceRosterName={rosterToClone.roster_name}
          sourceStartDate={rosterToClone.start_date}
          onConfirm={handleConfirmClone}
        />
      )}
    </div>
  );
}
