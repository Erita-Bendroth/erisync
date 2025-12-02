import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Users, AlertCircle } from "lucide-react";
import { RosterBuilderDialog } from "./RosterBuilderDialog";
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

  useEffect(() => {
    fetchRosters();
  }, [partnershipId]);

  const fetchRosters = async () => {
    try {
      const { data, error } = await supabase
        .from("partnership_rotation_rosters")
        .select("*")
        .eq("partnership_id", partnershipId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRosters((data || []) as Roster[]);
    } catch (error) {
      console.error("Error fetching rosters:", error);
      toast.error("Failed to load rotation rosters");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedRoster(null);
    setShowBuilder(true);
  };

  const handleEditRoster = (roster: Roster) => {
    setSelectedRoster(roster);
    setShowBuilder(true);
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
      // If implemented, also delete associated schedule entries
      if (isImplemented) {
        // Find all schedule entries created from this roster
        // They were created with the roster activation, so we need to identify them
        // For now, we'll ask user to manually clean up schedule entries if needed
        // or we could add a roster_id reference to schedule_entries in future
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
    const variants: Record<string, { variant: any; label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      pending_approval: { variant: "default", label: "Pending Approval" },
      approved: { variant: "default", label: "Approved" },
      implemented: { variant: "default", label: "Implemented" },
    };

    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading rosters...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Rotation Schedules</h3>
          <p className="text-sm text-muted-foreground">
            Manage unified weekly rotation schedules for {partnershipName}
          </p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Schedule
        </Button>
      </div>

      {rosters.length === 0 ? (
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
      ) : (
        <div className="grid gap-4">
          {rosters.map((roster) => (
            <Card key={roster.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{roster.roster_name}</h4>
                    {getStatusBadge(roster.status)}
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
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditRoster(roster)}
                  >
                    {roster.status === "draft" ? "Edit" : "View"}
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
            </Card>
          ))}
        </div>
      )}

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
    </div>
  );
}
