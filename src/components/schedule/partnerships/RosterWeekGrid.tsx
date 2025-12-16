import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Filter, Users } from "lucide-react";

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
  include_weekends: boolean;
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
  const [dayByDayMode, setDayByDayMode] = useState(false);
  const [showOnlyMyTeam, setShowOnlyMyTeam] = useState(false);
  const [userTeamIds, setUserTeamIds] = useState<string[]>([]);

  useEffect(() => {
    fetchCurrentUserTeams();
    fetchTeamMembers();
    fetchAssignments();
  }, [rosterId, partnershipId]);

  const fetchCurrentUserTeams = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
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

  // Auto-detect day-by-day mode based on existing assignments
  useEffect(() => {
    if (assignments.length > 0) {
      const hasDayByDayAssignments = assignments.some(a => a.day_of_week !== null);
      if (hasDayByDayAssignments && !dayByDayMode) {
        setDayByDayMode(true);
      }
    }
  }, [assignments]);

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

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    let existingAssignmentId: string | null = null;
    
    // OPTIMISTIC UPDATE - Update UI immediately using functional updates to avoid closure issues
    if (newShiftType === "none" || newShiftType === null) {
      // Remove from state optimistically
      setAssignments((prev) => {
        const existing = prev.find(
          (a) =>
            a.week_number === weekNumber &&
            a.user_id === userId &&
            a.team_id === teamId &&
            a.day_of_week === dayOfWeek
        );
        if (existing) existingAssignmentId = existing.id;
        
        return prev.filter((a) => !(
          a.week_number === weekNumber &&
          a.user_id === userId &&
          a.team_id === teamId &&
          a.day_of_week === dayOfWeek
        ));
      });
    } else {
      // Add/update in state optimistically
      setAssignments((prev) => {
        const existing = prev.find(
          (a) =>
            a.week_number === weekNumber &&
            a.user_id === userId &&
            a.team_id === teamId &&
            a.day_of_week === dayOfWeek
        );

        if (existing) {
          existingAssignmentId = existing.id;
          return prev.map((a) => 
            a.id === existing.id 
              ? { ...a, shift_type: newShiftType }
              : a
          );
        } else {
          return [
            ...prev,
            {
              id: tempId,
              roster_id: rosterId,
              week_number: weekNumber,
              user_id: userId,
              team_id: teamId,
              shift_type: newShiftType,
              day_of_week: dayOfWeek,
              include_weekends: false,
              assigned_by: null,
              notes: null,
              created_at: new Date().toISOString(),
            },
          ];
        }
      });
    }

    // BACKGROUND SAVE - Don't block UI
    try {
      if (newShiftType === "none" || newShiftType === null) {
        if (existingAssignmentId) {
          const { error } = await supabase
            .from("roster_week_assignments")
            .delete()
            .eq("id", existingAssignmentId);

          if (error) throw error;
        }
      } else {
        if (existingAssignmentId) {
          const { error } = await supabase
            .from("roster_week_assignments")
            .update({ shift_type: newShiftType })
            .eq("id", existingAssignmentId);

          if (error) throw error;
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
            if (error.code === '23505') {
              toast.error("Assignment already exists for this day/week");
              fetchAssignments(); // Refetch to sync state
              return;
            }
            throw error;
          }

          // Replace temp ID with real ID
          if (data) {
            setAssignments((prev) => 
              prev.map((a) => a.id === tempId ? data : a)
            );
          }
        }
      }
    } catch (error: any) {
      console.error("Error updating assignment:", error);
      toast.error("Failed to save - reverting changes");
      // Refetch to restore correct state on error
      fetchAssignments();
    }
  }, [rosterId, isReadOnly, fetchAssignments]);

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

  const handleWeekendToggle = useCallback(async (
    weekNumber: number,
    userId: string,
    teamId: string,
    includeWeekends: boolean
  ) => {
    if (isReadOnly) return;

    // Find the existing assignment
    const assignment = getAssignment(userId, teamId, weekNumber, null);
    if (!assignment) return;

    // Optimistic update
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === assignment.id ? { ...a, include_weekends: includeWeekends } : a
      )
    );

    // Background save
    try {
      const { error } = await supabase
        .from("roster_week_assignments")
        .update({ include_weekends: includeWeekends })
        .eq("id", assignment.id);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating weekend toggle:", error);
      toast.error("Failed to save weekend preference");
      fetchAssignments();
    }
  }, [isReadOnly, getAssignment, fetchAssignments]);

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

  // Filter members based on showOnlyMyTeam
  const filteredMembers = useMemo(() => {
    if (!showOnlyMyTeam) return teamMembers;
    return teamMembers.filter(m => userTeamIds.includes(m.team_id));
  }, [teamMembers, showOnlyMyTeam, userTeamIds]);

  // Group members by team for visual separation
  const membersByTeam = useMemo(() => {
    const groups: Record<string, TeamMember[]> = {};
    filteredMembers.forEach(member => {
      if (!groups[member.team_id]) {
        groups[member.team_id] = [];
      }
      groups[member.team_id].push(member);
    });
    return groups;
  }, [filteredMembers]);

  // Check if a member is from user's team
  const isUserTeamMember = useCallback((teamId: string) => {
    return userTeamIds.includes(teamId);
  }, [userTeamIds]);

  // Memoized DayCell component for performance - only re-renders when its own props change
  const DayCell = memo(({ 
    currentValue, 
    onValueChange, 
    isDisabled 
  }: { 
    currentValue: string; 
    onValueChange: (value: string) => void; 
    isDisabled: boolean;
  }) => (
    <select
      value={currentValue}
      onChange={(e) => onValueChange(e.target.value)}
      disabled={isDisabled}
      className="w-full h-8 text-xs border rounded px-1 bg-background hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option value="none">-</option>
      <option value="normal">Normal</option>
      <option value="early">Early</option>
      <option value="late">Late</option>
      <option value="weekend">Weekend</option>
      <option value="off">Off</option>
    </select>
  ));

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
      {/* Controls Card */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="day-mode"
                checked={dayByDayMode}
                onCheckedChange={setDayByDayMode}
                disabled={isReadOnly}
              />
              <Label htmlFor="day-mode" className="text-sm font-medium">
                Day-by-day assignments
              </Label>
            </div>
            
            {/* My Team Filter */}
            {userTeamIds.length > 0 && (
              <div className="flex items-center gap-2 border-l pl-4">
                <Button
                  variant={showOnlyMyTeam ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowOnlyMyTeam(!showOnlyMyTeam)}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  {showOnlyMyTeam ? "Showing My Team Only" : "Show My Team Only"}
                </Button>
              </div>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {showOnlyMyTeam 
              ? `Showing ${filteredMembers.length} members from your team(s)`
              : `${teamMembers.length} members total`
            }
          </div>
        </div>
      </Card>

      {!dayByDayMode ? (
        // Week-based mode (original)
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>• Assign each person's shift type for each week in the rotation cycle</p>
            <p>• Leave as "Not assigned" if the person is not scheduled that week</p>
            <p>• <strong>Your team rows are highlighted</strong> - focus on those first</p>
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
                {Object.entries(membersByTeam).map(([teamId, members]) => {
                  const isMyTeam = isUserTeamMember(teamId);
                  const teamName = members[0]?.team_name || "Unknown Team";
                  
                  return (
                    <>
                      {/* Team header row */}
                      <tr key={`team-header-${teamId}`}>
                        <td 
                          colSpan={cycleLength + 1} 
                          className={`border p-2 font-semibold ${
                            isMyTeam 
                              ? "bg-primary/10 text-primary border-primary/30" 
                              : "bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {teamName}
                            {isMyTeam && (
                              <Badge className="bg-primary text-primary-foreground text-xs">
                                Your Team
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                      {members.map((member) => (
                        <tr 
                          key={`${member.user_id}-${member.team_id}`}
                          className={isMyTeam ? "bg-primary/5" : ""}
                        >
                          <td className={`border p-2 font-medium sticky left-0 z-10 ${
                            isMyTeam ? "bg-primary/5" : "bg-background"
                          }`}>
                            <div>
                              <div className="font-medium">
                                {member.initials || `${member.first_name} ${member.last_name}`}
                              </div>
                            </div>
                          </td>
                          {Array.from({ length: cycleLength }, (_, i) => i + 1).map((weekNumber) => {
                            const assignment = getAssignment(member.user_id, member.team_id, weekNumber, null);
                            const shiftType = assignment?.shift_type || null;
                            const includeWeekends = assignment?.include_weekends || false;
                            const canIncludeWeekend = shiftType && ['normal', 'early', 'late'].includes(shiftType);

                            return (
                              <td key={weekNumber} className={`border p-2 ${isMyTeam ? "bg-primary/5" : ""}`}>
                                <div className="space-y-2">
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
                                    disabled={isReadOnly}
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
                                      <SelectItem value="late">🌙 Late Shift (Mon-Fri)</SelectItem>
                                      <SelectItem value="early">☀️ Early Shift (Mon-Fri)</SelectItem>
                                      <SelectItem value="normal">💼 Normal Shift (Mon-Fri)</SelectItem>
                                      <SelectItem value="weekend">📅 Weekend Only</SelectItem>
                                      <SelectItem value="off">🏖️ Off (entire week)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id={`weekend-${member.user_id}-${weekNumber}`}
                                      checked={includeWeekends}
                                      onCheckedChange={(checked) =>
                                        handleWeekendToggle(weekNumber, member.user_id, member.team_id, !!checked)
                                      }
                                      disabled={isReadOnly || !canIncludeWeekend}
                                    />
                                    <Label
                                      htmlFor={`weekend-${member.user_id}-${weekNumber}`}
                                      className={`text-xs cursor-pointer ${canIncludeWeekend ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}
                                    >
                                      + Weekend
                                    </Label>
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  );
                })}
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
                      {Object.entries(membersByTeam).map(([teamId, members]) => {
                        const isMyTeam = isUserTeamMember(teamId);
                        const teamName = members[0]?.team_name || "Unknown Team";
                        
                        return (
                          <>
                            {/* Team header row */}
                            <tr key={`team-header-${teamId}-${weekNumber}`}>
                              <td 
                                colSpan={dayNames.length + 1} 
                                className={`border p-2 font-semibold ${
                                  isMyTeam 
                                    ? "bg-primary/10 text-primary border-primary/30" 
                                    : "bg-muted/50"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  {teamName}
                                  {isMyTeam && (
                                    <Badge className="bg-primary text-primary-foreground text-xs">
                                      Your Team
                                    </Badge>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {members.map((member) => (
                              <tr 
                                key={`${member.user_id}-${member.team_id}-${weekNumber}`}
                                className={isMyTeam ? "bg-primary/5" : ""}
                              >
                                <td className={`border p-2 sticky left-0 z-10 ${
                                  isMyTeam ? "bg-primary/5" : "bg-background"
                                }`}>
                                  <div>
                                    <div className="font-medium text-xs">
                                      {member.initials || `${member.first_name} ${member.last_name}`}
                                    </div>
                                  </div>
                                </td>
                                {dayValues.map((dayOfWeek, idx) => {
                                  const assignment = getAssignment(member.user_id, member.team_id, weekNumber, dayOfWeek);
                                  const currentValue = assignment?.shift_type || "none";

                                  return (
                                    <td key={idx} className={`border p-1 ${isMyTeam ? "bg-primary/5" : ""}`}>
                                      <DayCell
                                        currentValue={currentValue}
                                        onValueChange={(value) =>
                                          handleAssignmentChange(
                                            weekNumber,
                                            member.user_id,
                                            member.team_id,
                                            value === "none" ? null : value,
                                            dayOfWeek
                                          )
                                        }
                                        isDisabled={isReadOnly}
                                      />
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </>
                        );
                      })}
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
