import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Download, BarChart3 } from "lucide-react";
import { getShiftTypeColor, getShiftTypeCode } from "@/lib/shiftTimeUtils";
import { format, startOfWeek, addDays, getWeek, getYear, endOfWeek } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TeamFavoritesManager } from "./TeamFavoritesManager";
import { CoverageOverview } from "./CoverageOverview";
import { CoverageAlerts } from "./CoverageAlerts";
import { CoverageHeatmap } from "./CoverageHeatmap";
import { TeamCoverageGrid } from "./TeamCoverageGrid";
import { useCoverageAnalysis } from "@/hooks/useCoverageAnalysis";
import { useHolidayVisibility } from "@/hooks/useHolidayVisibility";
import { HolidayBadge } from "./HolidayBadge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/AuthProvider";
import * as XLSX from "xlsx";

interface TeamMember {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
  country_code?: string;
}

interface ScheduleEntry {
  date: string;
  user_id: string;
  shift_type: string;
  activity_type: string;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  country_code: string;
  region_code?: string;
  is_public: boolean;
}

export function MultiTeamScheduleView() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMember[]>>({});
  const [scheduleData, setScheduleData] = useState<Record<string, ScheduleEntry[]>>({});
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"schedule" | "coverage" | "grid">("schedule");
  const { showHolidays, toggleHolidays } = useHolidayVisibility(user?.id);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekNumber = getWeek(currentDate, { weekStartsOn: 1 });
  const year = getYear(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Coverage analysis hook
  const coverageAnalysis = useCoverageAnalysis({
    teamIds: selectedTeams,
    startDate: weekStart,
    endDate: weekEnd,
    threshold: 90,
  });

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    if (selectedTeams.length > 0) {
      fetchTeamData();
      fetchHolidays();
    }
  }, [selectedTeams, currentDate]);

  const fetchTeams = async () => {
    const { data } = await supabase.from("teams").select("id, name").order("name");
    if (data) setTeams(data);
  };

  const fetchHolidays = async () => {
    try {
      const startDate = format(weekDays[0], "yyyy-MM-dd");
      const endDate = format(weekDays[6], "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .eq("is_public", true);

      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error("Error fetching holidays:", error);
    }
  };

  const getHolidayForDate = (date: Date): Holiday | undefined => {
    const dateStr = format(date, "yyyy-MM-dd");
    return holidays.find((h) => h.date === dateStr);
  };

  const fetchTeamData = async () => {
    setLoading(true);

    // Fetch team members
    const membersPromises = selectedTeams.map(async (teamId) => {
      const { data } = await supabase
        .from("team_members")
        .select(`
          user_id,
          profiles:user_id (
            first_name,
            last_name,
            initials,
            country_code
          )
        `)
        .eq("team_id", teamId);

      return {
        teamId,
        members: data?.filter((m: any) => m.profiles).map((m: any) => ({
          user_id: m.user_id,
          first_name: m.profiles.first_name,
          last_name: m.profiles.last_name,
          initials: m.profiles.initials || `${m.profiles.first_name[0]}${m.profiles.last_name[0]}`,
          country_code: m.profiles.country_code,
        })) || [],
      };
    });

    const membersResults = await Promise.all(membersPromises);
    const membersMap: Record<string, TeamMember[]> = {};
    membersResults.forEach(({ teamId, members }) => {
      membersMap[teamId] = members;
    });
    setTeamMembers(membersMap);

    // Fetch schedule entries
    const userIds = Object.values(membersMap)
      .flat()
      .map((m) => m.user_id);

    const { data: schedules } = await supabase
      .from("schedule_entries")
      .select("date, user_id, shift_type, activity_type")
      .in("user_id", userIds)
      .gte("date", format(weekDays[0], "yyyy-MM-dd"))
      .lte("date", format(weekDays[6], "yyyy-MM-dd"));

    const scheduleMap: Record<string, ScheduleEntry[]> = {};
    schedules?.forEach((entry) => {
      const key = `${entry.date}-${entry.user_id}`;
      scheduleMap[key] = scheduleMap[key] || [];
      scheduleMap[key].push(entry);
    });
    setScheduleData(scheduleMap);
    setLoading(false);
  };

  const changeWeek = (delta: number) => {
    setCurrentDate(addDays(currentDate, delta * 7));
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeams((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const handleApplyFavorite = (teamIds: string[], name: string) => {
    setSelectedTeams(teamIds);
  };

  const exportToExcel = () => {
    const exportData: any[] = [];
    
    // Header row
    const headerRow = ["Date/Day"];
    selectedTeams.forEach((teamId) => {
      const team = teams.find((t) => t.id === teamId);
      const members = teamMembers[teamId] || [];
      members.forEach((member) => {
        headerRow.push(`${team?.name} - ${member.first_name} ${member.last_name}`);
      });
    });
    exportData.push(headerRow);

    // Data rows
    weekDays.forEach((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayName = format(day, "EEE");
      const row = [`${dayName} ${format(day, "dd.MM")}`];

      selectedTeams.forEach((teamId) => {
        const members = teamMembers[teamId] || [];
        members.forEach((member) => {
          const key = `${dateStr}-${member.user_id}`;
          const entries = scheduleData[key] || [];
          const entry = entries[0];
          const code = entry
            ? getShiftTypeCode(entry.shift_type, entry.activity_type)
            : "";
          row.push(code);
        });
      });

      exportData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Week ${weekNumber}`);
    XLSX.writeFile(wb, `schedule-week-${weekNumber}-${year}.xlsx`);
  };

  const exportGapsToCsv = () => {
    if (coverageAnalysis.gaps.length === 0) return;

    const csvData = [
      ["Date", "Team", "Required", "Actual", "Deficit", "Weekend", "Holiday"],
      ...coverageAnalysis.gaps.map((gap) => [
        format(new Date(gap.date), "yyyy-MM-dd"),
        gap.teamName,
        gap.required.toString(),
        gap.actual.toString(),
        gap.deficit.toString(),
        gap.isWeekend ? "Yes" : "No",
        gap.isHoliday ? "Yes" : "No",
      ]),
    ];

    const csv = csvData.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coverage-gaps-week-${weekNumber}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Coverage Alerts */}
      {selectedTeams.length > 0 && <CoverageAlerts analysis={coverageAnalysis} />}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <div>
                  <CardTitle>Multi-Team Schedule Overview</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Week {weekNumber} • {format(weekStart, "dd.MM.yyyy")} - {format(weekDays[6], "dd.MM.yyyy")}
                  </p>
                </div>
                {selectedTeams.length > 0 && !coverageAnalysis.isLoading && (
                  <Badge
                    variant={coverageAnalysis.belowThreshold ? "destructive" : "default"}
                    className="text-sm"
                  >
                    Coverage: {coverageAnalysis.coveragePercentage}%
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => changeWeek(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => changeWeek(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <TeamFavoritesManager
                currentSelectedTeamIds={selectedTeams}
                teams={teams}
                onApplyFavorite={handleApplyFavorite}
              />
              <Button variant="outline" size="sm" onClick={exportToExcel} disabled={selectedTeams.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium">Teams:</span>
            {teams.map((team) => (
              <Badge
                key={team.id}
                variant={selectedTeams.includes(team.id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleTeam(team.id)}
              >
                {team.name}
              </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Switch id="show-holidays" checked={showHolidays} onCheckedChange={toggleHolidays} />
              <Label htmlFor="show-holidays" className="text-sm cursor-pointer">
                Show holidays/weekends
              </Label>
            </div>
          </div>

          {selectedTeams.length > 0 && (
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "schedule" | "coverage" | "grid")}>
              <TabsList>
                <TabsTrigger value="schedule">Schedule View</TabsTrigger>
                <TabsTrigger value="grid">Coverage Grid</TabsTrigger>
                <TabsTrigger value="coverage">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Coverage Analysis
                </TabsTrigger>
              </TabsList>

              <TabsContent value="schedule" className="mt-4 space-y-4">
                <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-left font-medium sticky left-0 bg-muted/50 z-10">
                      Date
                    </th>
                    {selectedTeams.map((teamId) => {
                      const team = teams.find((t) => t.id === teamId);
                      const members = teamMembers[teamId] || [];
                      return members.map((member) => (
                        <th key={`${teamId}-${member.user_id}`} className="p-2 text-center font-medium min-w-[60px]">
                          <div className="text-xs">{team?.name}</div>
                          <div className="font-bold">{member.initials}</div>
                        </th>
                      ));
                    })}
                  </tr>
                </thead>
                <tbody>
                  {weekDays.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const dayName = format(day, "EEE");
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const holiday = showHolidays ? getHolidayForDate(day) : undefined;

                    return (
                      <tr
                        key={dateStr}
                        className={`border-b ${isWeekend && showHolidays ? "bg-muted/30" : ""} ${
                          holiday && showHolidays ? "bg-purple-50 dark:bg-purple-950/20" : ""
                        }`}
                      >
                        <td className="p-2 sticky left-0 bg-background z-10 font-medium">
                          <div className="flex items-center gap-2">
                            <div>
                              <div>{dayName}</div>
                              <div className="text-xs text-muted-foreground">{format(day, "dd.MM")}</div>
                            </div>
                            {holiday && showHolidays && <HolidayBadge holidayName={holiday.name} size="sm" />}
                          </div>
                        </td>
                        {selectedTeams.map((teamId) => {
                          const members = teamMembers[teamId] || [];
                          return members.map((member) => {
                            const key = `${dateStr}-${member.user_id}`;
                            const entries = scheduleData[key] || [];
                            const entry = entries[0];

                            const bgColor = entry
                              ? getShiftTypeColor(entry.shift_type, entry.activity_type)
                              : isWeekend
                              ? "hsl(var(--muted))"
                              : "transparent";

                            const code = entry
                              ? getShiftTypeCode(entry.shift_type, entry.activity_type)
                              : "";

                            return (
                              <TooltipProvider key={`${teamId}-${member.user_id}`}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <td
                                      className="p-2 text-center font-bold cursor-pointer hover:opacity-80 transition-opacity"
                                      style={{
                                        backgroundColor: bgColor,
                                        color: entry ? "white" : "inherit",
                                      }}
                                    >
                                      {code}
                                    </td>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-sm">
                                      <div className="font-bold">
                                        {member.first_name} {member.last_name}
                                      </div>
                                      {entry && (
                                        <div>
                                          {entry.shift_type} - {entry.activity_type}
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          });
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
                </div>

                {/* Legend */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-4 text-xs">
                    <div className="font-semibold">Shifts:</div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6" style={{ backgroundColor: getShiftTypeColor("early") }} />
                      <span>F - Early Shift</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6" style={{ backgroundColor: getShiftTypeColor("late") }} />
                      <span>S - Late Shift</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6" style={{ backgroundColor: getShiftTypeColor("weekend") }} />
                      <span>W - Weekend Duty</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <div className="font-semibold">Activities:</div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6" style={{ backgroundColor: getShiftTypeColor("", "vacation") }} />
                      <span>U - Vacation</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="grid" className="mt-4">
                <TeamCoverageGrid
                  teamIds={selectedTeams}
                  currentDate={currentDate}
                  showHolidays={showHolidays}
                />
              </TabsContent>

              <TabsContent value="coverage" className="mt-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <CoverageOverview analysis={coverageAnalysis} onExportGaps={exportGapsToCsv} />
                  <CoverageHeatmap
                    teamIds={selectedTeams}
                    startDate={weekStart}
                    endDate={weekEnd}
                    teams={teams.filter((t) => selectedTeams.includes(t.id))}
                  />
                </div>
              </TabsContent>
            </Tabs>
          )}

          {selectedTeams.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Select teams above to view their schedules
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}