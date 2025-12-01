import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Team {
  id: string;
  name: string;
  min_staff_required: number;
  eligible_count: number;
}

interface HotlineGenerationStepProps {
  selectedTeams: string[];
  onTeamsChange: (teams: string[]) => void;
}

export const HotlineGenerationStep = ({ selectedTeams, onTeamsChange }: HotlineGenerationStepProps) => {
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfiguredTeams();
  }, []);

  const fetchConfiguredTeams = async () => {
    try {
      setLoading(true);

      // Fetch teams with hotline config
      const { data: configs, error } = await supabase
        .from("hotline_team_config")
        .select("team_id, min_staff_required");

      if (error) throw error;

      if (!configs || configs.length === 0) {
        setAvailableTeams([]);
        return;
      }

      // Fetch team details
      const teamIds = configs.map(c => c.team_id);
      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", teamIds);

      if (teamsError) throw teamsError;

      // Fetch eligible counts
      const { data: eligibleCounts, error: eligibleError } = await supabase
        .from("hotline_eligible_members")
        .select("team_id")
        .eq("is_active", true)
        .in("team_id", teamIds);

      if (eligibleError) throw eligibleError;

      // Count eligible members per team
      const eligibleMap = new Map<string, number>();
      eligibleCounts?.forEach(e => {
        eligibleMap.set(e.team_id, (eligibleMap.get(e.team_id) || 0) + 1);
      });

      // Combine data
      const teamsWithConfig: Team[] = (teams || []).map(t => {
        const config = configs.find(c => c.team_id === t.id);
        return {
          id: t.id,
          name: t.name,
          min_staff_required: config?.min_staff_required || 1,
          eligible_count: eligibleMap.get(t.id) || 0,
        };
      });

      setAvailableTeams(teamsWithConfig);
    } catch (error) {
      console.error("Error fetching configured teams:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTeam = (teamId: string) => {
    if (selectedTeams.includes(teamId)) {
      onTeamsChange(selectedTeams.filter(id => id !== teamId));
    } else {
      onTeamsChange([...selectedTeams, teamId]);
    }
  };

  const selectAll = () => {
    onTeamsChange(availableTeams.map(t => t.id));
  };

  const clearAll = () => {
    onTeamsChange([]);
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading teams...</div>;
  }

  if (availableTeams.length === 0) {
    return (
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          No teams have been configured for hotline scheduling yet. Please configure at least one team in the Teams tab first.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Select Teams for Hotline Schedule</h2>
        <p className="text-muted-foreground">
          Choose which teams to include in the hotline rotation
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={selectAll}
          className="text-sm text-primary hover:underline"
        >
          Select All
        </button>
        <button
          onClick={clearAll}
          className="text-sm text-primary hover:underline"
        >
          Clear All
        </button>
      </div>

      <div className="space-y-3">
        {availableTeams.map((team) => (
          <div
            key={team.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer"
            onClick={() => toggleTeam(team.id)}
          >
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedTeams.includes(team.id)}
                onCheckedChange={() => toggleTeam(team.id)}
              />
              <div>
                <Label className="cursor-pointer font-medium">{team.name}</Label>
                <p className="text-sm text-muted-foreground">
                  {team.eligible_count} eligible members
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">
                {team.min_staff_required} per day
              </Badge>
              {team.eligible_count === 0 && (
                <Badge variant="destructive">No eligible members</Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedTeams.length > 0 && (
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            Selected {selectedTeams.length} team{selectedTeams.length > 1 ? "s" : ""}. The schedule will assign staff based on least recent hotline duty and automatically substitute when needed.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
