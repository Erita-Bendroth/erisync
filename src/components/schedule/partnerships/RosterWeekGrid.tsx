import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface TeamMember {
  user_id: string;
  team_id: string;
  team_name: string;
  first_name: string;
  last_name: string;
  initials: string;
  country_code: string;
  region_code: string;
}

interface Assignment {
  id?: string;
  week_number: number;
  user_id: string;
  shift_type: string | null;
}

interface RosterWeekGridProps {
  rosterId: string;
  partnershipId: string;
  cycleLength: number;
  isReadOnly: boolean;
}

export function RosterWeekGrid({
  rosterId,
  partnershipId,
  cycleLength,
  isReadOnly,
}: RosterWeekGridProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTeamMembers();
    fetchAssignments();
  }, [rosterId, partnershipId]);

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase.rpc("get_partnership_team_members", {
        p_partnership_id: partnershipId,
      });

      if (error) throw error;
      setTeamMembers(data || []);
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
        const key = `${assignment.user_id}-${assignment.week_number}`;
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
    userId: string,
    teamId: string,
    weekNumber: number,
    shiftType: string | null
  ) => {
    if (isReadOnly) return;

    const key = `${userId}-${weekNumber}`;
    const existingAssignment = assignments[key];

    setSaving(true);
    try {
      if (shiftType === "none" || !shiftType) {
        // Remove assignment if exists
        if (existingAssignment?.id) {
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
          shift_type: shiftType,
        };

        if (existingAssignment?.id) {
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

      fetchAssignments();
    } catch (error) {
      console.error("Error updating assignment:", error);
      toast.error("Failed to update assignment");
    } finally {
      setSaving(false);
    }
  };

  const getShiftTypeLabel = (shiftType: string | null) => {
    if (!shiftType) return "Not assigned";
    const labels: Record<string, string> = {
      late: "Late Shift (Mon-Fri)",
      early: "Early Shift (Mon-Fri)",
      weekend: "Weekend Only",
      normal: "Normal Shift (Mon-Fri)",
      weekend_normal: "Weekend + Normal weekdays",
      weekend_early: "Weekend + Early weekdays",
      weekend_late: "Weekend + Late weekdays",
      off: "Off",
    };
    return labels[shiftType] || shiftType;
  };

  const getShiftTypeBadgeColor = (shiftType: string | null) => {
    if (!shiftType) return "text-muted-foreground";
    const colors: Record<string, string> = {
      late: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
      early: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      weekend: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
      weekend_normal: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
      weekend_early: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
      weekend_late: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
      normal: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
      off: "bg-muted text-muted-foreground",
    };
    return colors[shiftType] || "";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (teamMembers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No team members found in this partnership
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        <p>• Assign each person's shift type for each week in the rotation cycle</p>
        <p>• Leave as "Not assigned" if the person is not scheduled that week</p>
        <p>• All managers can see all assignments to coordinate coverage</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border p-2 bg-muted font-medium text-left sticky left-0 z-10 min-w-[180px]">
                Person (Team)
              </th>
              {Array.from({ length: cycleLength }, (_, i) => i + 1).map((weekNumber) => (
                <th
                  key={weekNumber}
                  className="border p-2 bg-muted font-medium text-center min-w-[140px]"
                >
                  Week {weekNumber}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teamMembers.map((member) => (
              <tr key={member.user_id}>
                <td className="border p-2 font-medium sticky left-0 bg-background z-10">
                  <div>
                    <div className="font-medium">
                      {member.initials || `${member.first_name} ${member.last_name}`}
                    </div>
                    <div className="text-xs text-muted-foreground">{member.team_name}</div>
                  </div>
                </td>
                {Array.from({ length: cycleLength }, (_, i) => i + 1).map((weekNumber) => {
                  const key = `${member.user_id}-${weekNumber}`;
                  const assignment = assignments[key];
                  const shiftType = assignment?.shift_type || null;

                  return (
                    <td key={weekNumber} className="border p-2">
                      <Select
                        value={shiftType || "none"}
                        onValueChange={(value) =>
                          handleAssignmentChange(
                            member.user_id,
                            member.team_id,
                            weekNumber,
                            value === "none" ? null : value
                          )
                        }
                        disabled={isReadOnly || saving}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            <span className={getShiftTypeBadgeColor(shiftType)}>
                              {getShiftTypeLabel(shiftType)}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground italic">Not assigned</span>
                          </SelectItem>
                          <SelectItem value="late">🌙 Late Shift (Mon-Fri only)</SelectItem>
                          <SelectItem value="early">☀️ Early Shift (Mon-Fri only)</SelectItem>
                          <SelectItem value="normal">💼 Normal Shift (Mon-Fri only)</SelectItem>
                          <SelectItem value="weekend">📅 Weekend Only</SelectItem>
                          <SelectItem value="weekend_normal">📅 Weekend + Normal weekdays</SelectItem>
                          <SelectItem value="weekend_early">📅 Weekend + Early weekdays</SelectItem>
                          <SelectItem value="weekend_late">📅 Weekend + Late weekdays</SelectItem>
                          <SelectItem value="off">🏖️ Off (entire week)</SelectItem>
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
    </div>
  );
}
