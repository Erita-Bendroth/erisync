import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  id: string;
  week_number: number;
  user_id: string;
  team_id: string;
  shift_type: string | null;
  day_of_week: number | null;
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
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dayByDayMode, setDayByDayMode] = useState(false);

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
      setAssignments(data || []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      toast.error("Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignmentChange = useCallback(async (
    weekNumber: number,
    userId: string,
    teamId: string,
    newShiftType: string | null,
    dayOfWeek: number | null = null
  ) => {
    if (isReadOnly) return;

    setSaving(true);
    try {
      const existingAssignment = assignments.find(
        (a) =>
          a.week_number === weekNumber &&
          a.user_id === userId &&
          a.team_id === teamId &&
          a.day_of_week === dayOfWeek
      );

      if (newShiftType === "none" || newShiftType === null) {
        // Delete assignment
        if (existingAssignment) {
          const { error } = await supabase
            .from("roster_week_assignments")
            .delete()
            .eq("id", existingAssignment.id);

          if (error) throw error;

          setAssignments((prev) =>
            prev.filter((a) => a.id !== existingAssignment.id)
          );
        }
      } else {
        // Update or insert assignment
        if (existingAssignment) {
          const { error } = await supabase
            .from("roster_week_assignments")
            .update({ shift_type: newShiftType })
            .eq("id", existingAssignment.id);

          if (error) throw error;

          setAssignments((prev) =>
            prev.map((a) =>
              a.id === existingAssignment.id
                ? { ...a, shift_type: newShiftType }
                : a
            )
          );
        } else {
          const { data, error } = await supabase
            .from("roster_week_assignments")
            .insert({
              roster_id: rosterId,
              week_number: weekNumber,
              user_id: userId,
              team_id: teamId,
              shift_type: newShiftType,
              day_of_week: dayOfWeek,
            })
            .select()
            .single();

          if (error) {
            // Handle duplicate key constraint violation
            if (error.code === '23505') {
              toast.error("Assignment already exists for this day/week");
              return;
            }
            throw error;
          }

          if (data) {
            setAssignments((prev) => [...prev, data]);
          }
        }
      }

      toast.success("Assignment updated");
    } catch (error: any) {
      console.error("Error updating assignment:", error);
      const errorMessage = error.message || "Failed to update assignment";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  }, [assignments, rosterId, isReadOnly]);

  // Memoized assignment lookup map for better performance
  const assignmentMap = useMemo(() => {
    const map = new Map<string, Assignment>();
    assignments.forEach((assignment) => {
      const key = `${assignment.user_id}_${assignment.team_id}_${assignment.week_number}_${assignment.day_of_week ?? 'null'}`;
      map.set(key, assignment);
    });
    return map;
  }, [assignments]);

  const getAssignment = useCallback((userId: string, teamId: string, weekNumber: number, dayOfWeek: number | null) => {
    const key = `${userId}_${teamId}_${weekNumber}_${dayOfWeek ?? 'null'}`;
    return assignmentMap.get(key);
  }, [assignmentMap]);

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

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayValues = [1, 2, 3, 4, 5, 6, 0]; // ISO day of week

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
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              id="day-mode"
              checked={dayByDayMode}
              onCheckedChange={setDayByDayMode}
              disabled={isReadOnly}
            />
            <Label htmlFor="day-mode" className="text-sm font-medium">
              Day-by-day assignments (Mon-Sun per week)
            </Label>
          </div>
          <div className="text-sm text-muted-foreground">
            {dayByDayMode ? "Assign shifts per day" : "Assign shifts per week"}
          </div>
        </div>
      </Card>

      {!dayByDayMode ? (
        // Week-based mode (original)
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
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
                  <tr key={`${member.user_id}-${member.team_id}`}>
                    <td className="border p-2 font-medium sticky left-0 bg-background z-10">
                      <div>
                        <div className="font-medium">
                          {member.initials || `${member.first_name} ${member.last_name}`}
                        </div>
                        <div className="text-xs text-muted-foreground">{member.team_name}</div>
                      </div>
                    </td>
                    {Array.from({ length: cycleLength }, (_, i) => i + 1).map((weekNumber) => {
                      const assignment = getAssignment(member.user_id, member.team_id, weekNumber, null);
                      const shiftType = assignment?.shift_type || null;

                      return (
                        <td key={weekNumber} className="border p-2">
                          <Select
                            value={shiftType || "none"}
                            onValueChange={(value) =>
                              handleAssignmentChange(
                                weekNumber,
                                member.user_id,
                                member.team_id,
                                value === "none" ? null : value,
                                null
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
      ) : (
        // Day-by-day mode
        <div className="space-y-6">
          {Array.from({ length: cycleLength }, (_, weekIndex) => {
            const weekNumber = weekIndex + 1;
            return (
              <Card key={weekNumber} className="p-4">
                <h4 className="font-semibold mb-3">Week {weekNumber}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="border p-2 bg-muted font-medium text-left sticky left-0 z-10 min-w-[150px]">
                          Person (Team)
                        </th>
                        {dayNames.map((day, idx) => (
                          <th key={idx} className="border p-2 bg-muted font-medium text-center min-w-[100px]">
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map((member) => (
                        <tr key={`${member.user_id}-${member.team_id}-${weekNumber}`}>
                          <td className="border p-2 sticky left-0 bg-background z-10">
                            <div>
                              <div className="font-medium text-xs">
                                {member.initials || `${member.first_name} ${member.last_name}`}
                              </div>
                              <div className="text-[10px] text-muted-foreground">{member.team_name}</div>
                            </div>
                          </td>
                          {dayValues.map((dayOfWeek, idx) => {
                            const assignment = getAssignment(member.user_id, member.team_id, weekNumber, dayOfWeek);
                            const currentValue = assignment?.shift_type || "none";

                            return (
                              <td key={idx} className="border p-1">
                                <Select
                                  value={currentValue}
                                  onValueChange={(value) =>
                                    handleAssignmentChange(
                                      weekNumber,
                                      member.user_id,
                                      member.team_id,
                                      value === "none" ? null : value,
                                      dayOfWeek
                                    )
                                  }
                                  disabled={isReadOnly || saving}
                                >
                                  <SelectTrigger className="w-full h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">-</SelectItem>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="early">Early</SelectItem>
                                    <SelectItem value="late">Late</SelectItem>
                                    <SelectItem value="weekend">Weekend</SelectItem>
                                    <SelectItem value="off">Off</SelectItem>
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
