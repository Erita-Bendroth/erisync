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

  useEffect(() => {
    fetchTeamMembers();
    calculateWeekDates();
    fetchAssignments();
  }, [teamId, weekNumber, year]);

  const calculateWeekDates = () => {
    const firstDayOfYear = new Date(year, 0, 1);
    const daysToFirstMonday = (8 - firstDayOfYear.getDay()) % 7;
    const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
    const weekStart = new Date(firstMonday.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
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
                <th className="p-2 text-left">Primary Assignment</th>
                <th className="p-2 text-left">Region/Country</th>
                <th className="p-2 text-left">Substitute</th>
              </tr>
            </thead>
            <tbody>
              {dates.map(date => {
                const assignment = getAssignment(date, dutyType);
                return (
                  <tr key={date.toISOString()} className="border-b">
                    <td className="p-2">{date.toLocaleDateString('en-GB')}</td>
                    <td className="p-2">{dayNames[date.getDay()]}</td>
                    <td className="p-2">
                      <Select
                        value={assignment?.user_id || "none"}
                        onValueChange={(value) =>
                          updateAssignment(date, dutyType, value === "none" ? null : value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {teamMembers.map(member => (
                            <SelectItem key={member.user_id} value={member.user_id}>
                              {member.initials || `${member.first_name} ${member.last_name}`}
                            </SelectItem>
                          ))}
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

  return (
    <div className="space-y-4">
      {includeWeekend && renderDutySection('Weekend/Holiday Duty', 'weekend', weekendDates)}
      {includeLateshift && renderDutySection('Lateshift (14:00-20:00)', 'lateshift', weekDates)}
      {includeEarlyshift && renderDutySection('Earlyshift (06:00-14:00)', 'earlyshift', weekDates)}
    </div>
  );
}
