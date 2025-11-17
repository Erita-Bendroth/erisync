import React, { useState, useEffect } from "react";
import { WizardData } from "./BulkScheduleWizard";
import { format, eachDayOfInterval, isWeekend as isWeekendDate } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Users } from "lucide-react";

interface SharedPlanningCalendarProps {
  wizardData: WizardData;
}

interface TeamMember {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
  team_name: string;
  team_id: string;
}

interface ScheduleEntry {
  date: string;
  user_id: string;
  availability_status: "available" | "unavailable";
  shift_type?: "early" | "late" | "normal" | "weekend";
  activity_type?: string;
}

export const SharedPlanningCalendar = ({ wizardData }: SharedPlanningCalendarProps) => {
  const [loading, setLoading] = useState(true);
  const [partnerMembers, setPartnerMembers] = useState<TeamMember[]>([]);
  const [partnerSchedules, setPartnerSchedules] = useState<ScheduleEntry[]>([]);
  const [yourTeamMembers, setYourTeamMembers] = useState<TeamMember[]>([]);
  const [dateRange, setDateRange] = useState<Date[]>([]);

  useEffect(() => {
    loadData();
  }, [wizardData]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Calculate date range
      if (wizardData.startDate && wizardData.endDate) {
        const allDays = eachDayOfInterval({
          start: wizardData.startDate,
          end: wizardData.endDate,
        });
        const filteredDays = allDays.filter(day => {
          if (wizardData.excludedDays.includes(day.getDay())) return false;
          return true;
        });
        setDateRange(filteredDays.slice(0, 14)); // First 14 days
      }

      // Fetch your team members
      await fetchYourTeamMembers();

      // Fetch partner teams and their members
      await fetchPartnerTeamsData();
    } finally {
      setLoading(false);
    }
  };

  const fetchYourTeamMembers = async () => {
    if (!wizardData.selectedTeam) return;

    const { data: teamData } = await supabase
      .from("teams")
      .select("name")
      .eq("id", wizardData.selectedTeam)
      .single();

    if (wizardData.mode === "users" && wizardData.selectedUsers.length > 0) {
      const { data } = await supabase
        .rpc('get_multiple_basic_profile_info', { _user_ids: wizardData.selectedUsers });
      
      if (data) {
        setYourTeamMembers(data.map((u: any) => ({
          user_id: u.user_id,
          first_name: u.first_name,
          last_name: u.last_name,
          initials: u.initials || `${u.first_name[0]}${u.last_name[0]}`,
          team_name: teamData?.name || "",
          team_id: wizardData.selectedTeam,
        })));
      }
    } else if (wizardData.mode === "team" && wizardData.selectedTeam) {
      const { data: membersData } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", wizardData.selectedTeam);

      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(m => m.user_id);
        const { data } = await supabase
          .rpc('get_multiple_basic_profile_info', { _user_ids: userIds });
        
        if (data) {
          setYourTeamMembers(data.map((u: any) => ({
            user_id: u.user_id,
            first_name: u.first_name,
            last_name: u.last_name,
            initials: u.initials || `${u.first_name[0]}${u.last_name[0]}`,
            team_name: teamData?.name || "",
            team_id: wizardData.selectedTeam,
          })));
        }
      }
    }
  };

  const fetchPartnerTeamsData = async () => {
    if (!wizardData.selectedTeam) return;

    // Find partnerships
    const { data: partnerships } = await supabase
      .from("team_planning_partners")
      .select("*")
      .contains("team_ids", [wizardData.selectedTeam]);

    if (!partnerships || partnerships.length === 0) return;

    const partnerTeamIds = partnerships.flatMap(p => 
      p.team_ids.filter(id => id !== wizardData.selectedTeam)
    );

    if (partnerTeamIds.length === 0) return;

    // Fetch partner team members
    const { data: partnerTeamMembers } = await supabase
      .from("team_members")
      .select(`
        user_id,
        team_id,
        teams!inner(name)
      `)
      .in("team_id", partnerTeamIds);

    if (partnerTeamMembers && partnerTeamMembers.length > 0) {
      const userIds = partnerTeamMembers.map(m => m.user_id);
      const { data: profiles } = await supabase
        .rpc('get_multiple_basic_profile_info', { _user_ids: userIds });
      
      if (profiles) {
        const members = partnerTeamMembers.map(m => {
          const profile = profiles.find((p: any) => p.user_id === m.user_id);
          return {
            user_id: m.user_id,
            first_name: profile?.first_name || "",
            last_name: profile?.last_name || "",
            initials: profile?.initials || "??",
            team_name: (m.teams as any)?.name || "",
            team_id: m.team_id,
          };
        });
        setPartnerMembers(members);

        // Fetch their schedules
        if (wizardData.startDate && wizardData.endDate) {
          const { data: schedules } = await supabase
            .from("schedule_entries")
            .select("date, user_id, availability_status, shift_type, activity_type")
            .in("user_id", userIds)
            .gte("date", format(wizardData.startDate, "yyyy-MM-dd"))
            .lte("date", format(wizardData.endDate, "yyyy-MM-dd"));

          if (schedules) {
            setPartnerSchedules(schedules as ScheduleEntry[]);
          }
        }
      }
    }
  };

  const getProposedShiftType = (date: Date): string => {
    if (wizardData.mode === "rotation" && wizardData.shiftPattern) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const pattern = wizardData.shiftPattern[dateStr];
      if (pattern?.isDayOff) return "off";
      return pattern?.shiftType || wizardData.shiftType;
    }
    return wizardData.shiftType;
  };

  const getShiftBadgeColor = (shiftType?: string) => {
    switch (shiftType) {
      case "early": return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
      case "late": return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20";
      case "weekend": return "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20";
      case "off": return "bg-muted text-muted-foreground";
      default: return "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20";
    }
  };

  const getPartnerSchedule = (userId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return partnerSchedules.find(s => s.user_id === userId && s.date === dateStr);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (partnerMembers.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No planning partners found for this team.</p>
          <p className="text-sm mt-2">Create a planning partnership to see side-by-side coverage.</p>
        </div>
      </Card>
    );
  }

  const groupedPartners = partnerMembers.reduce((acc, member) => {
    if (!acc[member.team_id]) {
      acc[member.team_id] = {
        team_name: member.team_name,
        members: []
      };
    }
    acc[member.team_id].members.push(member);
    return acc;
  }, {} as Record<string, { team_name: string; members: TeamMember[] }>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-lg">Side-by-Side Planning View</h3>
        <Badge variant="secondary">First {dateRange.length} Days</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Your Team's Proposed Schedule */}
        <Card className="p-4">
          <div className="mb-4 pb-3 border-b">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <h4 className="font-semibold">Your Team (Proposed)</h4>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {yourTeamMembers[0]?.team_name} • {yourTeamMembers.length} members
            </p>
          </div>

          <div className="space-y-3">
            {dateRange.map((date) => (
              <div key={date.toISOString()} className={cn(
                "p-3 rounded-lg border",
                isWeekendDate(date) && "bg-muted/30"
              )}>
                <div className="font-medium text-sm mb-2">
                  {format(date, "EEE, MMM d")}
                </div>
                <div className="space-y-1">
                  {yourTeamMembers.map((member) => {
                    const shiftType = getProposedShiftType(date);
                    return (
                      <div key={member.user_id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{member.initials}</span>
                        <Badge variant="outline" className={cn("text-xs", getShiftBadgeColor(shiftType))}>
                          {shiftType === "off" ? "Off" : shiftType}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Right: Partner Teams' Current Schedule */}
        <Card className="p-4">
          <div className="mb-4 pb-3 border-b">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <h4 className="font-semibold">Partner Teams (Current)</h4>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {Object.keys(groupedPartners).length} team(s) • {partnerMembers.length} members
            </p>
          </div>

          <div className="space-y-3">
            {dateRange.map((date) => (
              <div key={date.toISOString()} className={cn(
                "p-3 rounded-lg border",
                isWeekendDate(date) && "bg-muted/30"
              )}>
                <div className="font-medium text-sm mb-2">
                  {format(date, "EEE, MMM d")}
                </div>
                <div className="space-y-2">
                  {Object.entries(groupedPartners).map(([teamId, group]) => (
                    <div key={teamId} className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {group.team_name}
                      </div>
                      {group.members.map((member) => {
                        const schedule = getPartnerSchedule(member.user_id, date);
                        const isAvailable = schedule?.availability_status === "available";
                        return (
                          <div key={member.user_id} className="flex items-center justify-between text-sm pl-2">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "w-2 h-2 rounded-full",
                                isAvailable ? "bg-green-500" : "bg-red-500"
                              )}></span>
                              <span className="text-muted-foreground">{member.initials}</span>
                            </div>
                            {schedule && (
                              <Badge variant="outline" className={cn("text-xs", getShiftBadgeColor(schedule.shift_type))}>
                                {schedule.shift_type || "work"}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Legend */}
      <Card className="p-4">
        <div className="flex items-center gap-6 text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>Unavailable</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getShiftBadgeColor("early")}>Early</Badge>
            <Badge variant="outline" className={getShiftBadgeColor("late")}>Late</Badge>
            <Badge variant="outline" className={getShiftBadgeColor("normal")}>Normal</Badge>
            <Badge variant="outline" className={getShiftBadgeColor("weekend")}>Weekend</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
};
