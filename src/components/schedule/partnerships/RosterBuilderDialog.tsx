import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RosterWeekGrid } from "./RosterWeekGrid";
import { RosterApprovalPanel } from "./RosterApprovalPanel";
import { RosterProgressStepper } from "./RosterProgressStepper";
import { RosterCalendarView } from "./RosterCalendarView";
import { generateRosterSchedules } from "@/lib/rosterGenerationUtils";
import { Rocket, Key, AlertTriangle, Users, HelpCircle, Calendar } from "lucide-react";
import { toast } from "sonner";
import { RosterValidationPanel } from "./RosterValidationPanel";
import { addWeeks, format } from "date-fns";

interface Team {
  id: string;
  name: string;
}

interface RosterBuilderDialogProps {
  partnershipId: string;
  partnershipName: string;
  roster: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RosterBuilderDialog({
  partnershipId,
  partnershipName,
  roster,
  open,
  onOpenChange,
  onSuccess,
}: RosterBuilderDialogProps) {
  const [rosterName, setRosterName] = useState(roster?.roster_name || "");
  const [cycleLength, setCycleLength] = useState(roster?.cycle_length_weeks || 5);
  const [startDate, setStartDate] = useState(
    roster?.start_date || new Date().toISOString().split("T")[0]
  );
  const [teams, setTeams] = useState<Team[]>([]);
  const [rosterId, setRosterId] = useState(roster?.id || null);
  const [status, setStatus] = useState(roster?.status || "draft");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("build");
  const [isAdmin, setIsAdmin] = useState(false);
  const [activating, setActivating] = useState(false);
  const [showActivationDialog, setShowActivationDialog] = useState(false);
  const [activationMode, setActivationMode] = useState<"normal" | "admin">("normal");
  const [myTeamProgress, setMyTeamProgress] = useState({ completed: 0, total: 0 });
  const [allTeamsProgress, setAllTeamsProgress] = useState({ completed: 0, total: 0 });

  // Track progress updates from RosterWeekGrid
  const handleProgressChange = useCallback((completed: number, total: number) => {
    setMyTeamProgress({ completed, total });
  }, []);

  // Calculate all teams progress
  useEffect(() => {
    const fetchAllTeamsProgress = async () => {
      if (!rosterId) return;
      
      try {
        // Get all team members count
        const { data: members } = await supabase.rpc("get_partnership_team_members", {
          p_partnership_id: partnershipId,
        });
        
        if (!members) return;
        
        // Get unique users with assignments
        const { data: assignments } = await supabase
          .from("roster_week_assignments")
          .select("user_id, team_id")
          .eq("roster_id", rosterId);
        
        const uniqueAssigned = new Set(assignments?.map(a => `${a.user_id}_${a.team_id}`) || []);
        
        setAllTeamsProgress({
          completed: uniqueAssigned.size,
          total: members.length,
        });
      } catch (error) {
        console.error("Error fetching progress:", error);
      }
    };
    
    if (open && rosterId) {
      fetchAllTeamsProgress();
    }
  }, [open, rosterId, partnershipId]);

  useEffect(() => {
    if (open) {
      fetchTeams();
      checkAdminStatus();
      if (roster) {
        setRosterId(roster.id);
        setStatus(roster.status);
      }
    }
  }, [open, partnershipId, roster]);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "planner"]);

    setIsAdmin((roles?.length || 0) > 0);
  };

  const fetchTeams = async () => {
    try {
      const { data: partnership, error: partnershipError } = await supabase
        .from("team_planning_partners")
        .select("team_ids")
        .eq("id", partnershipId)
        .single();

      if (partnershipError) throw partnershipError;

      if (partnership?.team_ids) {
        const { data: teamsData, error: teamsError } = await supabase
          .from("teams")
          .select("id, name")
          .in("id", partnership.team_ids);

        if (teamsError) throw teamsError;
        setTeams(teamsData || []);
      }
    } catch (error) {
      console.error("Error fetching teams:", error);
      toast.error("Failed to load teams");
    }
  };

  const handleSaveDraft = async () => {
    if (!rosterName.trim()) {
      toast.error("Please enter a roster name");
      return;
    }

    setSaving(true);
    try {
      const rosterData = {
        partnership_id: partnershipId,
        roster_name: rosterName,
        shift_type: "normal", // Default since we do per-person assignments
        cycle_length_weeks: cycleLength,
        start_date: startDate,
        end_date: null,
        default_shift_for_non_duty: "normal",
        status: "draft",
      };

      if (rosterId) {
        const { error } = await supabase
          .from("partnership_rotation_rosters")
          .update(rosterData)
          .eq("id", rosterId);

        if (error) throw error;
        toast.success("Roster updated");
      } else {
        const { data, error } = await supabase
          .from("partnership_rotation_rosters")
          .insert(rosterData)
          .select()
          .single();

        if (error) throw error;
        setRosterId(data.id);
        toast.success("Roster created");
      }
    } catch (error) {
      console.error("Error saving roster:", error);
      toast.error("Failed to save roster");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!rosterId) {
      toast.error("Please save the roster first");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update roster status
      const { error: updateError } = await supabase
        .from("partnership_rotation_rosters")
        .update({ status: "pending_approval" })
        .eq("id", rosterId);

      if (updateError) throw updateError;

      // Create approval records for all team managers
      const { data: teamMembers, error: membersError } = await supabase
        .from("team_members")
        .select("team_id, user_id")
        .in("team_id", teams.map(t => t.id))
        .eq("is_manager", true);

      if (membersError) throw membersError;

      // Auto-approve the current user's approval (the submitting manager)
      const approvals = teamMembers.map(tm => ({
        roster_id: rosterId,
        manager_id: tm.user_id,
        team_id: tm.team_id,
        approved: tm.user_id === user.id, // Auto-approve for submitter
        approved_at: tm.user_id === user.id ? new Date().toISOString() : null,
      }));

      const { error: approvalsError } = await supabase
        .from("roster_manager_approvals")
        .upsert(approvals, { onConflict: "roster_id,manager_id,team_id" });

      if (approvalsError) throw approvalsError;

      setStatus("pending_approval");
      toast.success("Your planning is submitted. Waiting for other team managers to complete their assignments.");
      onSuccess();
    } catch (error) {
      console.error("Error submitting for approval:", error);
      toast.error("Failed to submit for approval");
    }
  };

  // Allow editing during draft and pending_approval, lock only after approved/implemented
  const isReadOnly = status === "approved" || status === "implemented";

  const handleRequestActivation = (mode: "normal" | "admin") => {
    setActivationMode(mode);
    setShowActivationDialog(true);
  };

  const handleConfirmActivation = async () => {
    if (!rosterId) return;

    setShowActivationDialog(false);
    setActivating(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const result = await generateRosterSchedules(rosterId, user.id);

      if (result.success) {
        const deletedMsg = result.entriesDeleted && result.entriesDeleted > 0 
          ? `Replaced ${result.entriesDeleted} existing entries. ` 
          : "";
        toast.success(`Roster activated! ${deletedMsg}Created ${result.entriesCreated} schedule entries.`);
        setStatus("implemented");
        onSuccess();
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

  // Calculate display dates for confirmation dialog
  const getDateRangeDisplay = () => {
    const start = new Date(startDate);
    const end = addWeeks(start, 52);
    return {
      startDisplay: format(start, "MMM d, yyyy"),
      endDisplay: format(end, "MMM d, yyyy"),
    };
  };

  const dateRange = getDateRangeDisplay();

  return (
    <TooltipProvider>
      <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {roster ? "Edit" : "Create"} Rotation Schedule - {partnershipName}
              </DialogTitle>
            </DialogHeader>

            {/* Progress Stepper + Guidance Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Progress Stepper */}
              <RosterProgressStepper
                rosterName={rosterName}
                rosterId={rosterId}
                status={status}
                myTeamProgress={myTeamProgress}
                allTeamsProgress={allTeamsProgress}
              />

              {/* Workflow Guidance Banner */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-2 shrink-0">
                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                      📋 Shared roster for all teams
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Edit <strong>your team's rows</strong> (highlighted in blue). 
                      Other team managers will complete their sections.
                    </p>
                    {teams.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {teams.map(team => (
                          <span 
                            key={team.id}
                            className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                          >
                            {team.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rosterName">Roster Name</Label>
                  <Input
                    id="rosterName"
                    value={rosterName}
                    onChange={(e) => setRosterName(e.target.value)}
                    placeholder="e.g., Q1 2025 Rotation Schedule"
                    disabled={isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cycleLength" className="flex items-center gap-1">
                    How many weeks before pattern repeats?
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>If you have 5 people taking turns on late shift, set this to 5 weeks. The pattern will repeat every 5 weeks for the whole year.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="cycleLength"
                    type="number"
                    min="1"
                    max="52"
                    value={cycleLength}
                    onChange={(e) => setCycleLength(parseInt(e.target.value))}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="flex items-center gap-1">
                    When should this schedule start?
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>The date when this rotation schedule becomes active. Usually the start of a quarter or year.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="build">Weekly Assignments</TabsTrigger>
              <TabsTrigger value="calendar" className="gap-1">
                <Calendar className="h-4 w-4" />
                Calendar Preview
              </TabsTrigger>
              <TabsTrigger value="approvals">Manager Approvals</TabsTrigger>
            </TabsList>

            <TabsContent value="build" className="space-y-4">
              {rosterId && (
                <RosterValidationPanel
                  rosterId={rosterId}
                  partnershipId={partnershipId}
                  cycleLength={cycleLength}
                />
              )}
              {rosterId ? (
                <RosterWeekGrid
                  rosterId={rosterId}
                  partnershipId={partnershipId}
                  cycleLength={cycleLength}
                  isReadOnly={isReadOnly}
                  onProgressChange={handleProgressChange}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Please save the roster draft first to build assignments
                </div>
              )}
            </TabsContent>

            <TabsContent value="calendar">
              {rosterId ? (
                <RosterCalendarView
                  rosterId={rosterId}
                  startDate={startDate}
                  cycleLength={cycleLength}
                  partnershipId={partnershipId}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Please save the roster draft first to preview the calendar
                </div>
              )}
            </TabsContent>

            <TabsContent value="approvals">
              {rosterId ? (
                <RosterApprovalPanel 
                  rosterId={rosterId} 
                  teams={teams}
                  onRosterActivated={() => {
                    setStatus("implemented");
                    onSuccess();
                  }}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Save and submit roster to manage approvals
                </div>
              )}
            </TabsContent>
            </Tabs>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <div className="flex gap-2">
                {(status === "draft" || status === "pending_approval") && (
                  <Button
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={saving}
                  >
                    Save Draft
                  </Button>
                )}
                {status === "draft" && rosterId && (
                  <Button onClick={handleSubmitForApproval}>
                    Submit for Approval
                  </Button>
                )}
                {isAdmin && (status === "draft" || status === "pending_approval") && rosterId && (
                  <Button
                    onClick={() => handleRequestActivation("admin")}
                    disabled={activating}
                    variant="secondary"
                    className="gap-2"
                  >
                    <Key className="h-4 w-4" />
                    {activating ? "Activating..." : "Admin: Activate Now"}
                  </Button>
                )}
                {status === "approved" && rosterId && (
                  <Button
                    onClick={() => handleRequestActivation("normal")}
                    disabled={activating}
                    className="gap-2"
                  >
                    <Rocket className="h-4 w-4" />
                    {activating ? "Activating..." : "Activate Roster"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showActivationDialog} onOpenChange={setShowActivationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {activationMode === "admin" ? "Admin Override: " : ""}Activate Roster
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will <strong>REPLACE all existing work schedules</strong> for partnership 
                members from <strong>{dateRange.startDisplay}</strong> to <strong>{dateRange.endDisplay}</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                Vacations, training, and other non-work entries will be preserved.
              </p>
              {activationMode === "admin" && (
                <p className="text-amber-600 font-medium">
                  Admin mode: This will skip approval requirements.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmActivation}>
              Yes, Replace & Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
    </TooltipProvider>
  );
}
