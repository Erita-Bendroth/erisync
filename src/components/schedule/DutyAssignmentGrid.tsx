import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { X, Plus, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DutyAssignmentGridProps {
  teamIds: string[];
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
  id?: string;
  date: string;
  dutyType: 'weekend' | 'lateshift' | 'earlyshift';
  userId: string | null;
  responsibilityRegion: string | null;
  isSubstitute: boolean;
}

interface ScheduledUser {
  date: string;
  user_id: string;
  shift_type: string;
}

export function DutyAssignmentGrid({
  teamIds,
  weekNumber,
  year,
  includeWeekend,
  includeLateshift,
  includeEarlyshift,
}: DutyAssignmentGridProps) {
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>({});
  const [loading, setLoading] = useState(false);
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [scheduledUsers, setScheduledUsers] = useState<Record<string, ScheduledUser[]>>({});
  const [availableShiftTypes, setAvailableShiftTypes] = useState<Set<string>>(new Set());
  const [shiftTimeDefinitions, setShiftTimeDefinitions] = useState<any[]>([]);

  useEffect(() => {
    console.log('[DutyAssignmentGrid] teamIds changed:', teamIds, 'weekNumber:', weekNumber, 'year:', year);
    fetchTeamMembers();
    fetchShiftTimeDefinitions();
    calculateWeekDates();
  }, [teamIds, weekNumber, year]);

  useEffect(() => {
    if (weekDates.length > 0) {
      fetchScheduledUsers();
      fetchAssignments();
    }
  }, [weekDates, teamIds]);

  const calculateWeekDates = () => {
    // Use ISO week calculation (same as edge function)
    const jan4 = new Date(Date.UTC(year, 0, 4)); // January 4th is always in week 1
    const jan4Day = jan4.getUTCDay() || 7; // Sunday is 7, not 0
    const weekStart = new Date(jan4);
    weekStart.setUTCDate(jan4.getUTCDate() - (jan4Day - 1)); // Go back to Monday of week 1
    weekStart.setUTCDate(weekStart.getUTCDate() + (weekNumber - 1) * 7); // Add weeks

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setUTCDate(weekStart.getUTCDate() + i);
      dates.push(date);
    }
    setWeekDates(dates);
  };

  const fetchTeamMembers = async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('user_id, profiles!inner(first_name, last_name, initials)')
      .in('team_id', teamIds);

    if (!error && data) {
      // Deduplicate users who might be in multiple teams
      const uniqueMembers = Array.from(
        new Map(
          data.map((tm: any) => [
            tm.user_id,
            {
              user_id: tm.user_id,
              first_name: tm.profiles.first_name,
              last_name: tm.profiles.last_name,
              initials: tm.profiles.initials || `${tm.profiles.first_name?.charAt(0) || ''}${tm.profiles.last_name?.charAt(0) || ''}`,
            }
          ])
        ).values()
      );
      console.log('[DutyAssignmentGrid] Fetched team members:', uniqueMembers.length, 'unique members');
      setTeamMembers(uniqueMembers);
    } else if (error) {
      console.error('[DutyAssignmentGrid] Error fetching team members:', error);
    }
  };

  const fetchShiftTimeDefinitions = async () => {
    const orConditions = teamIds.map(id => `team_id.eq.${id},team_ids.cs.{${id}}`).join(',');
    const { data, error } = await supabase
      .from('shift_time_definitions')
      .select('*')
      .or(`${orConditions},team_id.is.null`)
      .order('shift_type');
      
    if (!error && data) {
      setShiftTimeDefinitions(data);
    }
  };

  const fetchScheduledUsers = async () => {
    if (weekDates.length === 0) return;
    
    const startDate = weekDates[0].toISOString().split('T')[0];
    const endDate = weekDates[6].toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('schedule_entries')
      .select('date, user_id, shift_type, availability_status, activity_type')
      .in('team_id', teamIds)
      .gte('date', startDate)
      .lte('date', endDate);
      
    if (!error && data) {
      const workEntries = data.filter(entry => 
        entry.availability_status === 'available' && 
        entry.activity_type === 'work'
      );
      
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
        
        shiftTypes.add(shiftType);
      });
      
      console.log('[DutyAssignmentGrid] Fetching scheduled users:', {
        teamIds,
        startDate,
        endDate,
        dataLength: data?.length,
        workEntriesLength: workEntries.length,
        scheduledUsersMap: Object.keys(map).length,
        map
      });
      
      setScheduledUsers(map);
      setAvailableShiftTypes(shiftTypes);
    }
  };

  const fetchAssignments = async () => {
    const { data, error } = await supabase
      .from('duty_assignments')
      .select(`
        id,
        date,
        duty_type,
        user_id,
        team_id,
        responsibility_region,
        is_substitute
      `)
      .in('team_id', teamIds)
      .eq('week_number', weekNumber)
      .eq('year', year);

    if (error) {
      console.error('[DutyAssignmentGrid] Error fetching assignments:', error);
      toast({ title: "Error", description: "Failed to load assignments", variant: "destructive" });
      return;
    }

    if (data) {
      const assignmentsMap: Record<string, Assignment[]> = {};
      data.forEach((item: any) => {
        const key = `${item.date}-${item.duty_type}`;
        if (!assignmentsMap[key]) {
          assignmentsMap[key] = [];
        }
        assignmentsMap[key].push({
          id: item.id,
          date: item.date,
          dutyType: item.duty_type,
          userId: item.user_id,
          responsibilityRegion: item.responsibility_region,
          isSubstitute: item.is_substitute || false,
        });
      });
      setAssignments(assignmentsMap);
    }
  };

  const getAssignments = (date: Date, dutyType: 'weekend' | 'lateshift' | 'earlyshift'): Assignment[] => {
    const dateStr = date.toISOString().split('T')[0];
    const key = `${dateStr}-${dutyType}`;
    return assignments[key] || [];
  };

  const getScheduledUsersForDate = (date: Date, dutyType: 'weekend' | 'lateshift' | 'earlyshift') => {
    const dateStr = date.toISOString().split('T')[0];
    const scheduled = scheduledUsers[dateStr] || [];
    
    if (dutyType === 'lateshift') {
      return scheduled.filter(s => s.shift_type === 'late');
    } else if (dutyType === 'earlyshift') {
      return scheduled.filter(s => s.shift_type === 'early');
    }
    
    return scheduled.filter(s => s.shift_type === 'normal' || s.shift_type === 'weekend');
  };

  const getShiftTimeRange = (shiftType: 'weekend' | 'lateshift' | 'earlyshift'): string => {
    const typeMap = {
      'weekend': 'weekend',
      'lateshift': 'late',
      'earlyshift': 'early'
    };
    
    const matchingDefs = shiftTimeDefinitions.filter(def => 
      def.shift_type === typeMap[shiftType] &&
      (teamIds.includes(def.team_id) || def.team_ids?.some((id: string) => teamIds.includes(id)) || !def.team_id)
    );
    
    if (matchingDefs.length > 0) {
      const specific = matchingDefs.find(d => teamIds.includes(d.team_id) || d.team_ids?.some((id: string) => teamIds.includes(id)));
      const def = specific || matchingDefs[0];
      return `${def.start_time.substring(0, 5)}-${def.end_time.substring(0, 5)}`;
    }
    
    if (shiftType === 'lateshift') return '14:00-20:00';
    if (shiftType === 'earlyshift') return '06:00-14:00';
    return '07:00-13:00';
  };

  const addAssignment = async (date: Date, dutyType: 'weekend' | 'lateshift' | 'earlyshift') => {
    const dateStr = date.toISOString().split('T')[0];
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
        return;
      }

      const newAssignment: any = {
        team_id: teamIds[0],
        date: dateStr,
        duty_type: dutyType,
        week_number: weekNumber,
        year: year,
        user_id: null,
        responsibility_region: null,
        is_substitute: false,
        created_by: userData.user.id,
      };

      const { data, error } = await supabase
        .from('duty_assignments')
        .insert(newAssignment)
        .select()
        .single();

      if (error) {
        toast({ title: "Error", description: "Failed to add assignment", variant: "destructive" });
        return;
      }

      const key = `${dateStr}-${dutyType}`;
      setAssignments(prev => ({
        ...prev,
        [key]: [...(prev[key] || []), {
          id: data.id,
          date: dateStr,
          dutyType,
          userId: data.user_id,
          responsibilityRegion: data.responsibility_region,
          isSubstitute: data.is_substitute,
        }]
      }));

      toast({ title: "Success", description: "Assignment added" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to add assignment", variant: "destructive" });
    }
  };

  const updateAssignment = async (
    assignmentId: string,
    field: 'userId' | 'responsibilityRegion' | 'isSubstitute',
    value: string | boolean | null
  ) => {
    try {
      const updateData: any = {
        [field === 'userId' ? 'user_id' : field === 'isSubstitute' ? 'is_substitute' : 'responsibility_region']: value,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('duty_assignments')
        .update(updateData)
        .eq('id', assignmentId);

      if (error) {
        toast({ title: "Error", description: "Failed to update assignment", variant: "destructive" });
        return;
      }

      setAssignments(prev => {
        const updated = { ...prev };
        for (const key in updated) {
          updated[key] = updated[key].map(a => 
            a.id === assignmentId 
              ? { ...a, [field]: value } 
              : a
          );
        }
        return updated;
      });

      toast({ title: "Success", description: "Assignment updated" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update assignment", variant: "destructive" });
    }
  };

  const removeAssignment = async (assignmentId: string, date: Date, dutyType: string) => {
    try {
      const { error } = await supabase
        .from('duty_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) {
        toast({ title: "Error", description: "Failed to remove assignment", variant: "destructive" });
        return;
      }

      const dateStr = date.toISOString().split('T')[0];
      const key = `${dateStr}-${dutyType}`;
      setAssignments(prev => ({
        ...prev,
        [key]: (prev[key] || []).filter(a => a.id !== assignmentId)
      }));

      toast({ title: "Success", description: "Assignment removed" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove assignment", variant: "destructive" });
    }
  };

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
                <th className="p-2 text-left text-sm font-semibold">Date</th>
                <th className="p-2 text-left text-sm font-semibold">Day</th>
                <th className="p-2 text-left text-sm font-semibold">Scheduled</th>
                <th className="p-2 text-left text-sm font-semibold" colSpan={3}>Assigned Personnel</th>
              </tr>
            </thead>
            <tbody>
              {dates.map(date => {
                const scheduled = getScheduledUsersForDate(date, dutyType);
                const scheduledInitials = scheduled
                  .map(s => {
                    const member = teamMembers.find(m => m.user_id === s.user_id);
                    if (!member) {
                      console.warn('[DutyAssignmentGrid] User not in teamMembers:', s.user_id, 'for date', date.toISOString().split('T')[0], 'duty:', dutyType);
                      return null;
                    }
                    return member.initials || `${member.first_name?.charAt(0) || ''}${member.last_name?.charAt(0) || ''}`;
                  })
                  .filter(Boolean)
                  .join(', ');
                const currentAssignments = getAssignments(date, dutyType);
                
                return (
                  <tr key={date.toISOString()} className="border-b hover:bg-muted/50">
                    <td className="p-2 text-sm">{date.toLocaleDateString('en-GB')}</td>
                    <td className="p-2 text-sm">{dayNames[(date.getDay() + 6) % 7]}</td>
                    <td className="p-2 text-sm">
                      <div className="font-medium text-primary">
                        {scheduledInitials || <span className="text-muted-foreground">-</span>}
                      </div>
                    </td>
                    <td className="p-2" colSpan={3}>
                      <div className="space-y-2">
                        {currentAssignments.map((assignment) => (
                          <div key={assignment.id} className="flex items-center gap-2 p-2 border rounded-lg bg-card">
                            <Select
                              value={assignment.userId || 'none'}
                              onValueChange={(value) => updateAssignment(assignment.id!, 'userId', value === 'none' ? null : value)}
                            >
                              <SelectTrigger className="w-[140px] h-8 text-sm">
                                <SelectValue placeholder="Select user" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {teamMembers.map((member) => {
                                  const isScheduled = scheduled.some(s => s.user_id === member.user_id);
                                  return (
                                    <SelectItem key={member.user_id} value={member.user_id}>
                                      {member.initials || `${member.first_name} ${member.last_name}`}
                                      {isScheduled && " ✓"}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            <Input
                              type="text"
                              placeholder="Region (e.g., South, AT)"
                              value={assignment.responsibilityRegion || ''}
                              onChange={(e) => updateAssignment(assignment.id!, 'responsibilityRegion', e.target.value || null)}
                              className="flex-1 h-8 text-sm"
                            />
                            <Select
                              value={assignment.isSubstitute ? 'substitute' : 'primary'}
                              onValueChange={(value) => updateAssignment(assignment.id!, 'isSubstitute', value === 'substitute')}
                            >
                              <SelectTrigger className="w-[100px] h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="primary">Primary</SelectItem>
                                <SelectItem value="substitute">Backup</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAssignment(assignment.id!, date, dutyType)}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addAssignment(date, dutyType)}
                          className="w-full h-8 text-sm"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Assignment
                        </Button>
                      </div>
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
  
  const shouldShowWeekend = includeWeekend && (
    availableShiftTypes.has('normal') || 
    availableShiftTypes.has('weekend') ||
    availableShiftTypes.size === 0
  );

  const shouldShowLateshift = includeLateshift && (
    availableShiftTypes.has('late') ||
    availableShiftTypes.size === 0
  );

  const shouldShowEarlyshift = includeEarlyshift && (
    availableShiftTypes.has('early') ||
    availableShiftTypes.size === 0
  );

  // Show proper empty state if teams selected but no data
  if (teamIds.length > 0 && weekDates.length > 0 && Object.keys(scheduledUsers).length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          No scheduled team members found for week {weekNumber}, {year}. 
          Make sure team members are scheduled in the main schedule view for the selected teams.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {shouldShowWeekend && renderDutySection(`Weekend/Holiday Duty (${getShiftTimeRange('weekend')})`, 'weekend', weekendDates)}
      {includeLateshift && !availableShiftTypes.has('late') && availableShiftTypes.size > 0 && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground italic">
              No late shift schedules found for this team this week.
            </div>
          </CardContent>
        </Card>
      )}
      {shouldShowLateshift && renderDutySection(`Lateshift (${getShiftTimeRange('lateshift')})`, 'lateshift', weekDates)}
      {includeEarlyshift && !availableShiftTypes.has('early') && availableShiftTypes.size > 0 && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground italic">
              No early shift schedules found for this team this week.
            </div>
          </CardContent>
        </Card>
      )}
      {shouldShowEarlyshift && renderDutySection(`Earlyshift (${getShiftTimeRange('earlyshift')})`, 'earlyshift', weekDates)}
    </div>
  );
}