import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Team {
  id: string;
  name: string;
}

interface TeamMember {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
}

interface Assignment {
  id?: string;
  week_number: number;
  user_id: string | null;
  team_id: string;
}

interface RosterWeekGridProps {
  rosterId: string;
  teams: Team[];
  cycleLength: number;
  isReadOnly: boolean;
}

export function RosterWeekGrid({
  rosterId,
  teams,
  cycleLength,
  isReadOnly,
}: RosterWeekGridProps) {
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMember[]>>({});
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTeamMembers();
    fetchAssignments();
  }, [rosterId, teams]);

  const fetchTeamMembers = async () => {
    try {
      const membersByTeam: Record<string, TeamMember[]> = {};

      for (const team of teams) {
        const { data, error } = await supabase
          .from("team_members")
          .select(`
            user_id,
            profiles!inner (
              first_name,
              last_name,
              initials
            )
          `)
          .eq("team_id", team.id);

        if (error) throw error;

        membersByTeam[team.id] = data.map((tm: any) => ({
          user_id: tm.user_id,
          first_name: tm.profiles.first_name,
          last_name: tm.profiles.last_name,
          initials: tm.profiles.initials,
        }));
      }

      setTeamMembers(membersByTeam);
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast.error("Failed to load team members");
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from("roster_week_assignments")
        .select("*")
        .eq("roster_id", rosterId);

      if (error) throw error;

      const assignmentMap: Record<string, Assignment> = {};
      data?.forEach((assignment) => {
        const key = `${assignment.week_number}-${assignment.team_id}`;
        assignmentMap[key] = assignment;
      });

      setAssignments(assignmentMap);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      toast.error("Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignmentChange = async (
    weekNumber: number,
    teamId: string,
    userId: string | null
  ) => {
    if (isReadOnly) return;

    const key = `${weekNumber}-${teamId}`;
    const existingAssignment = assignments[key];

    setSaving(true);
    try {
      if (userId === "empty") {
        // Empty week - delete assignment if exists
        if (existingAssignment) {
          const { error } = await supabase
            .from("roster_week_assignments")
            .delete()
            .eq("id", existingAssignment.id);

          if (error) throw error;

          const newAssignments = { ...assignments };
          delete newAssignments[key];
          setAssignments(newAssignments);
        }
      } else {
        const assignmentData = {
          roster_id: rosterId,
          week_number: weekNumber,
          team_id: teamId,
          user_id: userId,
        };

        if (existingAssignment) {
          // Update existing
          const { error } = await supabase
            .from("roster_week_assignments")
            .update(assignmentData)
            .eq("id", existingAssignment.id);

          if (error) throw error;
        } else {
          // Create new
          const { data, error } = await supabase
            .from("roster_week_assignments")
            .insert(assignmentData)
            .select()
            .single();

          if (error) throw error;

          setAssignments({
            ...assignments,
            [key]: data,
          });
        }
      }

      toast.success("Assignment updated");
      fetchAssignments();
    } catch (error) {
      console.error("Error updating assignment:", error);
      toast.error("Failed to update assignment");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2 bg-muted font-medium text-left">Week</th>
              {teams.map((team) => (
                <th key={team.id} className="border p-2 bg-muted font-medium text-left min-w-[200px]">
                  {team.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: cycleLength }, (_, i) => i + 1).map((weekNumber) => (
              <tr key={weekNumber}>
                <td className="border p-2 font-medium">Week {weekNumber}</td>
                {teams.map((team) => {
                  const key = `${weekNumber}-${team.id}`;
                  const assignment = assignments[key];
                  const members = teamMembers[team.id] || [];

                  return (
                    <td key={team.id} className="border p-2">
                      <Select
                        value={assignment?.user_id || "empty"}
                        onValueChange={(value) =>
                          handleAssignmentChange(
                            weekNumber,
                            team.id,
                            value === "empty" ? null : value
                          )
                        }
                        disabled={isReadOnly || saving}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select person" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="empty">
                            <span className="text-muted-foreground italic">
                              Empty (no coverage)
                            </span>
                          </SelectItem>
                          {members.map((member) => (
                            <SelectItem key={member.user_id} value={member.user_id}>
                              {member.initials || `${member.first_name} ${member.last_name}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isReadOnly && (
        <div className="text-sm text-muted-foreground">
          <p>• Select a team member for each week to assign them the duty shift</p>
          <p>• Select "Empty (no coverage)" for weeks without coverage</p>
          <p>• Each manager can only assign members from their own team</p>
        </div>
      )}
    </div>
  );
}
