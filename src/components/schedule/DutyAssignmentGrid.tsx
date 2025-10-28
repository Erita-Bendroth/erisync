import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

interface DutyAssignmentGridProps {
  teamId: string;
  weekNumber: number;
  year: number;
  includeWeekend: boolean;
  includeLateshift: boolean;
  includeEarlyshift: boolean;
}

interface TeamMember {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
}

interface Assignment {
  date: string;
  duty_type: 'weekend' | 'lateshift' | 'earlyshift';
  user_id: string | null;
  substitute_user_id: string | null;
  responsibility_region: string | null;
}

interface ScheduledUser {
  date: string;
  user_id: string;
  shift_type: string;
}

export function DutyAssignmentGrid({
  teamId,
  weekNumber,
  year,
  includeWeekend,
  includeLateshift,
  includeEarlyshift,
}: DutyAssignmentGridProps) {
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [scheduledUsers, setScheduledUsers] = useState<Record<string, ScheduledUser[]>>({});
  const [availableShiftTypes, setAvailableShiftTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTeamMembers();
    calculateWeekDates();
  }, [teamId, weekNumber, year]);

  useEffect(() => {
    if (weekDates.length > 0) {
      fetchScheduledUsers();
      fetchAssignments();
    }
  }, [weekDates, teamId]);

  const calculateWeekDates = () => {
    // Use ISO 8601 week date calculation (same as parent component)
    // Find the Monday of the specified ISO week
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7; // Convert Sunday (0) to 7
    jan4.setDate(jan4.getDate() + 4 - jan4Day); // Get to Thursday of week 1
    
    const weekStart = new Date(jan4);
    weekStart.setDate(jan4.getDate() + (weekNumber - 1) * 7 - 3); // Go back to Monday

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push(date);
    }
    setWeekDates(dates);
  };

  const fetchTeamMembers = async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('user_id, profiles!inner(first_name, last_name, initials)')
      .eq('team_id', teamId);

    if (!error && data) {
      setTeamMembers(
        data.map((tm: any) => ({
          user_id: tm.user_id,
          first_name: tm.profiles.first_name,
          last_name: tm.profiles.last_name,
          initials: tm.profiles.initials,
        }))
      );
    }
  };

  const fetchScheduledUsers = async () => {
    if (weekDates.length === 0) return;
    
    const startDate = weekDates[0].toISOString().split('T')[0];
    const endDate = weekDates[6].toISOString().split('T')[0];
    
    console.log('[DutyAssignmentGrid] Fetching scheduled users for team:', teamId, 'dates:', startDate, 'to', endDate);
    
    const { data, error } = await supabase
      .from('schedule_entries')
      .select('date, user_id, shift_type, availability_status, activity_type')
      .eq('team_id', teamId)
      .gte('date', startDate)
      .lte('date', endDate);
      
    console.log('[DutyAssignmentGrid] Schedule entries query result:', { data, error, count: data?.length });
      
    if (!error && data) {
      // Filter for work entries only
      const workEntries = data.filter(entry => 
        entry.availability_status === 'available' && 
        entry.activity_type === 'work'
      );
      
      console.log('[DutyAssignmentGrid] Filtered work entries:', workEntries.length, 'of', data.length);
      
      // Collect unique shift types from the schedule
      const shiftTypes = new Set<string>();
      const map: Record<string, ScheduledUser[]> = {};
      workEntries.forEach((entry: any) => {
        const dateStr = entry.date;
        const shiftType = entry.shift_type || 'normal';
        
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push({
          date: dateStr,
          user_id: entry.user_id,
          shift_type: shiftType
        });
        
        // Track available shift types
        shiftTypes.add(shiftType);
      });
      
      console.log('[DutyAssignmentGrid] Scheduled users map:', map);
      console.log('[DutyAssignmentGrid] Available shift types:', Array.from(shiftTypes));
      setScheduledUsers(map);
      setAvailableShiftTypes(shiftTypes);
    } else if (error) {
      console.error('[DutyAssignmentGrid] Error fetching scheduled users:', error);
    }
  };

  const fetchAssignments = async () => {
    const { data, error } = await supabase
      .from('duty_assignments')
      .select('*')
      .eq('team_id', teamId)
      .eq('year', year)
      .eq('week_number', weekNumber);

    if (!error && data) {
      setAssignments(data);
    }
  };

  const getAssignment = (date: Date, dutyType: 'weekend' | 'lateshift' | 'earlyshift') => {
    const dateStr = date.toISOString().split('T')[0];
    return assignments.find(a => a.date === dateStr && a.duty_type === dutyType);
  };

  const getScheduledUsersForDate = (date: Date, dutyType: 'weekend' | 'lateshift' | 'earlyshift') => {
    const dateStr = date.toISOString().split('T')[0];
    const scheduled = scheduledUsers[dateStr] || [];
    
    if (dutyType === 'lateshift') {
      return scheduled.filter(s => s.shift_type === 'late');
    } else if (dutyType === 'earlyshift') {
      return scheduled.filter(s => s.shift_type === 'early');
    }
    
    return scheduled;
  };

  const getDefaultUserId = (date: Date, dutyType: 'weekend' | 'lateshift' | 'earlyshift'): string => {
    const scheduled = getScheduledUsersForDate(date, dutyType);
    return scheduled.length > 0 ? scheduled[0].user_id : "none";
  };

  const updateAssignment = async (
    date: Date,
    dutyType: 'weekend' | 'lateshift' | 'earlyshift',
    userId: string | null,
    isSubstitute: boolean = false,
    region: string | null = null
  ) => {
    const dateStr = date.toISOString().split('T')[0];
    const existing = getAssignment(date, dutyType);
    const { data: { user } } = await supabase.auth.getUser();

    const assignmentData = {
      team_id: teamId,
      user_id: isSubstitute ? (existing?.user_id || null) : userId,
      substitute_user_id: isSubstitute ? userId : (existing?.substitute_user_id || null),
      duty_type: dutyType,
      week_number: weekNumber,
      year: year,
      date: dateStr,
      created_by: user?.id,
      responsibility_region: region !== undefined ? region : (existing?.responsibility_region || null),
    };

    let error;
    if (existing) {
      ({ error } = await supabase
        .from('duty_assignments')
        .update(assignmentData)
        .eq('id', (existing as any).id));
    } else {
      ({ error } = await supabase.from('duty_assignments').insert(assignmentData));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      fetchAssignments();
    }
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const renderDutySection = (title: string, dutyType: 'weekend' | 'lateshift' | 'earlyshift', dates: Date[]) => (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Day</th>
                <th className="p-2 text-left">Scheduled</th>
                <th className="p-2 text-left">Primary Assignment</th>
                <th className="p-2 text-left">Region/Country</th>
                <th className="p-2 text-left">Substitute</th>
              </tr>
            </thead>
            <tbody>
              {dates.map(date => {
                const assignment = getAssignment(date, dutyType);
                const scheduled = getScheduledUsersForDate(date, dutyType);
                const scheduledInitials = scheduled
                  .map(s => teamMembers.find(m => m.user_id === s.user_id)?.initials)
                  .filter(Boolean)
                  .join(', ');
                const defaultValue = assignment?.user_id || getDefaultUserId(date, dutyType);
                
                return (
                  <tr key={date.toISOString()} className="border-b">
                    <td className="p-2">{date.toLocaleDateString('en-GB')}</td>
                    <td className="p-2">{dayNames[date.getDay()]}</td>
                    <td className="p-2">
                      <div className="text-sm font-medium">
                        {scheduledInitials || <span className="text-muted-foreground">No one scheduled</span>}
                      </div>
                    </td>
                    <td className="p-2">
                      <Select
                        value={defaultValue}
                        onValueChange={(value) =>
                          updateAssignment(date, dutyType, value === "none" ? null : value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {teamMembers.map(member => {
                            const isScheduled = scheduled.some(s => s.user_id === member.user_id);
                            return (
                              <SelectItem 
                                key={member.user_id} 
                                value={member.user_id}
                                className={isScheduled ? "font-semibold bg-primary/5" : ""}
                              >
                                {member.initials || `${member.first_name} ${member.last_name}`}
                                {isScheduled && " ✓"}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="e.g., South, AT, North West"
                        value={assignment?.responsibility_region || ""}
                        onChange={(e) => {
                          const value = e.target.value.trim() || null;
                          updateAssignment(date, dutyType, assignment?.user_id || null, false, value);
                        }}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </td>
                    <td className="p-2">
                      <Select
                        value={assignment?.substitute_user_id || "none"}
                        onValueChange={(value) =>
                          updateAssignment(date, dutyType, value === "none" ? null : value, true)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {teamMembers.map(member => (
                            <SelectItem key={member.user_id} value={member.user_id}>
                              {member.initials || `${member.first_name} ${member.last_name}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  const weekendDates = weekDates.filter(d => d.getDay() === 0 || d.getDay() === 6);
  
  // Determine which sections to show based on both template config and actual schedule data
  const shouldShowWeekend = includeWeekend && (
    availableShiftTypes.has('normal') || 
    availableShiftTypes.has('weekend') ||
    availableShiftTypes.size === 0 // Show if no data loaded yet
  );

  const shouldShowLateshift = includeLateshift && (
    availableShiftTypes.has('late') ||
    availableShiftTypes.size === 0
  );

  const shouldShowEarlyshift = includeEarlyshift && (
    availableShiftTypes.has('early') ||
    availableShiftTypes.size === 0
  );

  return (
    <div className="space-y-4">
      {shouldShowWeekend && renderDutySection('Weekend/Holiday Duty', 'weekend', weekendDates)}
      {includeLateshift && !availableShiftTypes.has('late') && availableShiftTypes.size > 0 && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground italic">
              No late shift schedules found for this team this week.
            </div>
          </CardContent>
        </Card>
      )}
      {shouldShowLateshift && renderDutySection('Lateshift (14:00-20:00)', 'lateshift', weekDates)}
      {includeEarlyshift && !availableShiftTypes.has('early') && availableShiftTypes.size > 0 && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground italic">
              No early shift schedules found for this team this week.
            </div>
          </CardContent>
        </Card>
      )}
      {shouldShowEarlyshift && renderDutySection('Earlyshift (06:00-14:00)', 'earlyshift', weekDates)}
    </div>
  );
}
