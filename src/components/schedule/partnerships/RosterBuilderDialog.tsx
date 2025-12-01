import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RosterWeekGrid } from "./RosterWeekGrid";
import { RosterApprovalPanel } from "./RosterApprovalPanel";
import { RosterCalendarPreview } from "./RosterCalendarPreview";
import { generateRosterSchedules } from "@/lib/rosterGenerationUtils";
import { Rocket, Key } from "lucide-react";
import { toast } from "sonner";

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

      const approvals = teamMembers.map(tm => ({
        roster_id: rosterId,
        manager_id: tm.user_id,
        team_id: tm.team_id,
        approved: false,
      }));

      const { error: approvalsError } = await supabase
        .from("roster_manager_approvals")
        .upsert(approvals, { onConflict: "roster_id,manager_id,team_id" });

      if (approvalsError) throw approvalsError;

      setStatus("pending_approval");
      toast.success("Roster submitted for approval");
      onSuccess();
    } catch (error) {
      console.error("Error submitting for approval:", error);
      toast.error("Failed to submit for approval");
    }
  };

  // Allow editing during draft and pending_approval, lock only after approved/implemented
  const isReadOnly = status === "approved" || status === "implemented";

  const handleAdminActivate = async () => {
    if (!rosterId) return;

    const confirmed = confirm(
      "Admin Override: This will skip all approvals and immediately activate the roster. Continue?"
    );
    if (!confirmed) return;

    setActivating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Directly generate schedules
      const result = await generateRosterSchedules(rosterId, user.id);

      if (result.success) {
        toast.success(`Roster activated! Created ${result.entriesCreated} schedule entries.`);
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

  const handleActivateRoster = async () => {
    if (!rosterId) return;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {roster ? "Edit" : "Create"} Rotation Schedule - {partnershipName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="cycleLength">Cycle Length (weeks)</Label>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="build">Weekly Assignments</TabsTrigger>
            <TabsTrigger value="approvals">Manager Approvals</TabsTrigger>
          </TabsList>

          <TabsContent value="build" className="space-y-4">
            {rosterId ? (
              <RosterWeekGrid
                rosterId={rosterId}
                partnershipId={partnershipId}
                cycleLength={cycleLength}
                isReadOnly={isReadOnly}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Please save the roster draft first to build assignments
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
                  onClick={handleAdminActivate}
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
                  onClick={handleActivateRoster}
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
  );
}
