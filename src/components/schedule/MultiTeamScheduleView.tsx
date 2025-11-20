import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Download, BarChart3, Camera, Loader2 } from "lucide-react";
import { getShiftTypeColor, getShiftTypeCode } from "@/lib/shiftTimeUtils";
import { formatUserName } from "@/lib/utils";
import { format, startOfWeek, addDays, getWeek, getYear, endOfWeek, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TeamFavoritesManager } from "./TeamFavoritesManager";
import { CoverageOverview } from "./CoverageOverview";
import { CoverageAlerts } from "./CoverageAlerts";
import { CoverageHeatmap } from "./CoverageHeatmap";
import { TeamCoverageGrid } from "./TeamCoverageGrid";
import { useCoverageAnalysis } from "@/hooks/useCoverageAnalysis";
import { useHolidayVisibility } from "@/hooks/useHolidayVisibility";
import { useHolidayRefetch } from "@/hooks/useHolidayRefetch";
import { HolidayBadge } from "./HolidayBadge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/AuthProvider";
import { TeamFavoritesQuickAccess } from "./TeamFavoritesQuickAccess";
import { useTeamFavorites } from "@/hooks/useTeamFavorites";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { useScheduleAccessControl } from "@/hooks/useScheduleAccessControl";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
  team_id: string;
  team_name: string;
  first_name: string;
  last_name: string;
  initials: string | null;
  created_by?: string;
  creator_name?: string;
  notes?: string;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  country_code: string;
  region_code?: string;
  is_public: boolean;
}

interface MultiTeamScheduleViewProps {
  teams?: Array<{ id: string; name: string; parent_team_id: string | null }>;
}

export function MultiTeamScheduleView({ teams: teamsFromProps }: MultiTeamScheduleViewProps = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Array<{ id: string; name: string; parent_team_id: string | null }>>(teamsFromProps || []);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleData, setScheduleData] = useState<ScheduleEntry[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [capacityConfigs, setCapacityConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"schedule" | "coverage" | "grid">("schedule");
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [dateRangeType, setDateRangeType] = useState<'1week' | '2weeks' | '1month' | '3months' | '6months'>('1week');
  const { showHolidays, toggleHolidays } = useHolidayVisibility(user?.id);
  const { favorites } = useTeamFavorites('multi-team');
  const holidayRefetchTrigger = useHolidayRefetch();
  
  // Access control hook for multi-team view mode
  const {
    canViewActivityDetails,
    canEditTeam,
    isAdmin: isAdminRole,
    isPlanner: isPlannerRole,
  } = useScheduleAccessControl({ viewMode: 'multi-team' });
  
  // Fetch deduplication ref
  const fetchInProgressRef = useRef(false);
  const prevSelectedTeamsRef = useRef<string[]>(selectedTeams);
  const prevDateRef = useRef<Date>(currentDate);

  // Calculate date range based on selected range type
  const getDateRange = (baseDate: Date, rangeType: typeof dateRangeType) => {
    switch (rangeType) {
      case '1week':
        return {
          start: startOfWeek(baseDate, { weekStartsOn: 1 }),
          end: endOfWeek(baseDate, { weekStartsOn: 1 }),
        };
      case '2weeks':
        const week1Start = startOfWeek(baseDate, { weekStartsOn: 1 });
        return {
          start: week1Start,
          end: addDays(week1Start, 13),
        };
      case '1month':
        return {
          start: startOfMonth(baseDate),
          end: endOfMonth(baseDate),
        };
      case '3months':
        const month3Start = startOfMonth(baseDate);
        return {
          start: month3Start,
          end: endOfMonth(addMonths(month3Start, 2)),
        };
      case '6months':
        const month6Start = startOfMonth(baseDate);
        return {
          start: month6Start,
          end: endOfMonth(addMonths(month6Start, 5)),
        };
    }
  };

  const dateRange = getDateRange(currentDate, dateRangeType);
  const weekStart = dateRange.start;
  const weekEnd = dateRange.end;
  const weekNumber = getWeek(currentDate, { weekStartsOn: 1 });
  const year = getYear(currentDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Coverage analysis hook - pass pre-fetched data to avoid duplicate queries
  const coverageAnalysis = useCoverageAnalysis({
    teamIds: selectedTeams,
    startDate: weekStart,
    endDate: weekEnd,
    threshold: 90,
    scheduleData: scheduleData,
    teamsData: teams.filter(t => selectedTeams.includes(t.id)),
    holidaysData: holidays,
    capacityData: capacityConfigs,
  });

  // Helper function to count shift types for a given date across all selected teams
  const getShiftTypeCounts = (dateStr: string, day: Date) => {
    const counts = {
      early: 0,
      late: 0,
      normal: 0,
      weekend: 0,
      total: 0
    };
    
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    
    selectedTeams.forEach(teamId => {
      const daySchedules = scheduleByDateAndTeam.get(dateStr)?.get(teamId) || [];
      daySchedules.forEach(entry => {
        // Only count "work" activities
        if (entry.activity_type === 'work') {
          counts.total++;
          
          // Determine effective shift type (weekend overrides normal on Sat/Sun)
          const effectiveShiftType = isWeekend && entry.shift_type === 'normal' 
            ? 'weekend' 
            : entry.shift_type;
          
          switch (effectiveShiftType) {
            case 'early':
              counts.early++;
              break;
            case 'late':
              counts.late++;
              break;
            case 'weekend':
              counts.weekend++;
              break;
            case 'normal':
              counts.normal++;
              break;
          }
        }
      });
    });
    
    return counts;
  };

  // Sync teams from props
  useEffect(() => {
    if (teamsFromProps && teamsFromProps.length > 0) {
      setTeams(teamsFromProps);
    } else if (!teamsFromProps || (Array.isArray(teamsFromProps) && teamsFromProps.length === 0)) {
      fetchTeams();
    }
  }, [teamsFromProps]);

  // Memoize schedule data by date and team for fast lookups
  const scheduleByDateAndTeam = useMemo(() => {
    const map = new Map<string, Map<string, ScheduleEntry[]>>();
    
    scheduleData.forEach(entry => {
      const dateStr = typeof entry.date === 'string' ? entry.date : format(parseISO(entry.date), "yyyy-MM-dd");
      
      if (!map.has(dateStr)) {
        map.set(dateStr, new Map());
      }
      
      const dateMap = map.get(dateStr)!;
      if (!dateMap.has(entry.team_id)) {
        dateMap.set(entry.team_id, []);
      }
      
      if (entry.activity_type === 'work') {
        dateMap.get(entry.team_id)!.push(entry);
      }
    });
    
    return map;
  }, [scheduleData]);

  useEffect(() => {
    // Don't fetch on initial render or if no teams selected
    if (selectedTeams.length === 0) {
      setLoading(false);
      setScheduleData([]);
      return;
    }
    
    // Only fetch if something actually changed
    const teamsChanged = JSON.stringify([...prevSelectedTeamsRef.current].sort()) !== 
                         JSON.stringify([...selectedTeams].sort());
    const dateChanged = Math.abs(prevDateRef.current.getTime() - currentDate.getTime()) > 1000;
    
    if ((teamsChanged || dateChanged) && !screenshotMode) {
      prevSelectedTeamsRef.current = [...selectedTeams];
      prevDateRef.current = currentDate;
      fetchTeamData();
    }
  }, [selectedTeams, currentDate, screenshotMode, holidayRefetchTrigger]);


  const fetchTeams = async () => {
    const { data } = await supabase.from("teams").select("id, name, parent_team_id").order("name");
    if (data) {
      setTeams(data);
    }
  };

  const applyFavorite = (teamIds: string[], name: string) => {
    setSelectedTeams(teamIds);
    toast({
      title: 'Favorite Applied',
      description: `Now viewing: ${name}`,
    });
  };

  const fetchHolidays = async (userCountries: string[]) => {
    try {
      const startDate = format(weekDays[0], "yyyy-MM-dd");
      const endDate = format(weekDays[6], "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .eq("is_public", true)
        .in("country_code", userCountries);

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
    // Prevent concurrent fetches
    if (fetchInProgressRef.current) {
      console.log('⏭️ Fetch already in progress, skipping...');
      return;
    }
    
    fetchInProgressRef.current = true;
    setLoading(true);
    setError(null);
    
    // Add timeout protection (30 seconds)
    const timeoutId = setTimeout(() => {
      if (fetchInProgressRef.current) {
        fetchInProgressRef.current = false;
        setLoading(false);
        setError('Request timed out. Please refresh and try again.');
        toast({
          title: "Timeout",
          description: "The request took too long. Please try again.",
          variant: "destructive"
        });
      }
    }, 30000);

    try {
      const startDate = format(weekDays[0], "yyyy-MM-dd");
      const endDate = format(weekDays[6], "yyyy-MM-dd");

      // Fetch ALL data in parallel: schedules (work activities only), holidays, and capacity config
      const [schedulesResult, holidaysResult, capacityResult] = await Promise.all([
        supabase
          .from("schedule_entries")
          .select("date, user_id, team_id, shift_type, activity_type, created_by, notes")
          .in("team_id", selectedTeams)
          .eq("activity_type", "work")
          .gte("date", startDate)
          .lte("date", endDate)
          .limit(1000),
        supabase
          .from('holidays')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .eq('is_public', true),
        supabase
          .from('team_capacity_config')
          .select('*')
          .in('team_id', selectedTeams)
      ]);

      if (schedulesResult.error) throw schedulesResult.error;
      if (holidaysResult.error) console.warn('Error fetching holidays:', holidaysResult.error);
      if (capacityResult.error) console.warn('Error fetching capacity:', capacityResult.error);

      const schedules = schedulesResult.data;
      const holidaysData = holidaysResult.data || [];
      const capacityData = capacityResult.data || [];
      
      setCapacityConfigs(capacityData);

      // Collect ALL user IDs we need (both assignees and creators)
      const allUserIds = new Set<string>();
      schedules?.forEach((entry: any) => {
        if (entry.user_id) allUserIds.add(entry.user_id);
        if (entry.created_by) allUserIds.add(entry.created_by);
      });

      console.log(`📊 Fetching profiles for ${allUserIds.size} unique users (assignees + creators)`);

      // Fetch only the profiles we need
      const profilesResult = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, initials, email, country_code")
        .in("user_id", Array.from(allUserIds));

      if (profilesResult.error) console.warn('Error fetching profiles:', profilesResult.error);

      const profilesData = profilesResult.data || [];

      // Create lookup maps
      const profileMap = new Map(
        profilesData?.map(p => [p.user_id, p]) || []
      );
      
      const teamMap = new Map(
        teams.map(t => [t.id, t.name])
      );

      // Process schedule data with profile info
      const enrichedSchedules: ScheduleEntry[] = schedules?.map((entry: any) => {
        const profile = profileMap.get(entry.user_id);
        const creatorProfile = profileMap.get(entry.created_by);
        return {
          date: format(parseISO(entry.date), "yyyy-MM-dd"), // Normalize date format
          user_id: entry.user_id,
          shift_type: entry.shift_type,
          activity_type: entry.activity_type,
          team_id: entry.team_id,
          team_name: teamMap.get(entry.team_id) || 'Unknown Team',
          first_name: profile?.first_name || 'Unknown',
          last_name: profile?.last_name || '',
          initials: profile?.initials || null,
          created_by: entry.created_by,
          creator_name: creatorProfile?.first_name || entry.created_by || 'Unknown',
          notes: entry.notes,
        };
      }) || [];

      setScheduleData(enrichedSchedules);
      
      // Filter holidays by user countries to avoid showing irrelevant holidays
      const userCountries = new Set(
        profilesData
          .map(p => p.country_code)
          .filter(c => c)
      );
      
      const relevantHolidays = userCountries.size > 0
        ? holidaysData.filter(h => userCountries.has(h.country_code))
        : [];
      
      setHolidays(relevantHolidays);
    } catch (err) {
      console.error('Error fetching team data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load schedule data');
      toast({
        title: "Error loading schedule",
        description: err instanceof Error ? err.message : 'Failed to load schedule data',
        variant: "destructive"
      });
    } finally {
      clearTimeout(timeoutId);
      fetchInProgressRef.current = false;
      setLoading(false);
    }
  };

  const changeWeek = (delta: number) => {
    let newDate: Date;
    
    switch (dateRangeType) {
      case '1week':
      case '2weeks':
        newDate = addDays(currentDate, delta * 7);
        break;
      case '1month':
        newDate = delta > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1);
        break;
      case '3months':
        newDate = delta > 0 ? addMonths(currentDate, 3) : subMonths(currentDate, 3);
        break;
      case '6months':
        newDate = delta > 0 ? addMonths(currentDate, 6) : subMonths(currentDate, 6);
        break;
    }
    
    setCurrentDate(newDate);
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeams((prev) => {
      return prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId];
    });
  };

  const handleApplyFavorite = (teamIds: string[], name: string) => {
    setSelectedTeams(teamIds);
  };

  const exportToExcel = () => {
    const exportData: any[] = [];
    
    // Header row with teams
    const headerRow = ["Date/Day"];
    selectedTeams.forEach((teamId) => {
      const team = teams.find((t) => t.id === teamId);
      headerRow.push(team?.name || 'Unknown Team');
    });
    exportData.push(headerRow);

    // Data rows
    weekDays.forEach((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayName = format(day, "EEE");
      const row = [`${dayName} ${format(day, "dd.MM")}`];

      selectedTeams.forEach((teamId) => {
        const daySchedules = scheduleData.filter(
          e => e.date === dateStr && e.team_id === teamId
        );
        
        const userSummary = daySchedules.map(e => {
          const name = e.initials || `${e.first_name} ${e.last_name}`;
          const code = getShiftTypeCode(e.shift_type, e.activity_type);
          return `${name}(${code})`;
        }).join(', ');
        
        row.push(userSummary || '-');
      });

      exportData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, dateRangeType === '1week' ? `Week ${weekNumber}` : `Schedule`);
    const filename = dateRangeType === '1week' 
      ? `schedule-week-${weekNumber}-${year}.xlsx`
      : `schedule-${format(weekStart, 'yyyy-MM-dd')}_to_${format(weekEnd, 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const exportGapsToExcel = () => {
    if (coverageAnalysis.gaps.length === 0) {
      toast({
        title: 'No Gaps to Export',
        description: 'There are no coverage gaps in the selected date range.',
        variant: 'default'
      });
      return;
    }

    // Prepare data with calculated columns
    const excelData = coverageAnalysis.gaps.map((gap) => ({
      'Date': format(new Date(gap.date), 'yyyy-MM-dd (EEE)'), // Add day of week
      'Team': gap.teamName,
      'Required Staff': gap.required,
      'Actual Staff': gap.actual,
      'Deficit': gap.deficit,
      'Coverage %': gap.required > 0 ? Math.round((gap.actual / gap.required) * 100) : 0,
      'Severity': gap.deficit >= 3 ? 'CRITICAL' : gap.deficit >= 2 ? 'High' : 'Medium',
      'Weekend': gap.isWeekend ? 'Yes' : 'No',
      'Holiday': gap.isHoliday ? 'Yes' : 'No',
    }));

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths for readability
    ws['!cols'] = [
      { wch: 18 }, // Date
      { wch: 35 }, // Team (long names)
      { wch: 14 }, // Required Staff
      { wch: 12 }, // Actual Staff
      { wch: 10 }, // Deficit
      { wch: 12 }, // Coverage %
      { wch: 12 }, // Severity
      { wch: 10 }, // Weekend
      { wch: 10 }, // Holiday
    ];

    // Add autofilter to all columns
    ws['!autofilter'] = { ref: ws['!ref'] || 'A1' };

    // Create workbook and add summary sheet
    const wb = XLSX.utils.book_new();
    
    // Add summary statistics sheet
    const summaryData = [
      ['Coverage Gap Summary'],
      [''],
      ['Date Range:', `${format(weekStart, 'yyyy-MM-dd')} to ${format(weekEnd, 'yyyy-MM-dd')}`],
      ['Total Gaps:', coverageAnalysis.gaps.length],
      ['Total Staff Deficit:', coverageAnalysis.gaps.reduce((sum, g) => sum + g.deficit, 0)],
      ['Critical Gaps (3+ staff short):', coverageAnalysis.gaps.filter(g => g.deficit >= 3).length],
      ['High Priority (2 staff short):', coverageAnalysis.gaps.filter(g => g.deficit === 2).length],
      [''],
      ['Teams Affected:'],
      ...Array.from(new Set(coverageAnalysis.gaps.map(g => g.teamName))).map(team => [team])
    ];
    
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 40 }];
    
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    XLSX.utils.book_append_sheet(wb, ws, 'Coverage Gaps');

    // Download file
    const filename = `coverage-gaps-week-${weekNumber}-${year}.xlsx`;
    XLSX.writeFile(wb, filename);

    toast({
      title: 'Export Complete',
      description: `Coverage gaps exported to ${filename}`,
    });
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
                    {dateRangeType === '1week' && `Week ${weekNumber} • `}
                    {format(weekStart, "dd.MM.yyyy")} - {format(weekEnd, "dd.MM.yyyy")}
                    {dateRangeType !== '1week' && ` (${weekDays.length} days)`}
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
              <Select 
                value={dateRangeType} 
                onValueChange={(value) => setDateRangeType(value as typeof dateRangeType)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1week">1 Week</SelectItem>
                  <SelectItem value="2weeks">2 Weeks</SelectItem>
                  <SelectItem value="1month">1 Month</SelectItem>
                  <SelectItem value="3months">3 Months</SelectItem>
                  <SelectItem value="6months">6 Months</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant={screenshotMode ? "default" : "outline"} 
                size="sm" 
                onClick={() => {
                  setScreenshotMode(!screenshotMode);
                  toast({
                    title: screenshotMode ? "Screenshot Mode Off" : "Screenshot Mode On",
                    description: screenshotMode ? "Auto-refresh resumed" : "Auto-refresh paused for screenshots",
                  });
                }}
              >
                <Camera className="w-4 h-4 mr-2" />
                {screenshotMode ? "Resume" : "Screenshot"}
              </Button>
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
                viewContext="multi-team"
              />
              <Button variant="outline" size="sm" onClick={exportToExcel} disabled={selectedTeams.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick access to saved favorites */}
          {favorites.length > 0 && (
            <div className="pb-2">
              <TeamFavoritesQuickAccess
                favorites={favorites}
                currentSelectedTeamIds={selectedTeams}
                onApplyFavorite={applyFavorite}
              />
            </div>
          )}
          
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

          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
              Error loading schedule: {error}
            </div>
          )}

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
                {selectedTeams.length === 0 && !loading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-lg">Please select teams to view the schedule</p>
                  </div>
                ) : loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <TooltipProvider>
                <ScrollArea className="border rounded-lg h-[600px] scroll-area">
                      <div className="px-3 py-2 bg-muted/50 border-b text-xs text-muted-foreground">
                        <strong>Note:</strong> Multi-team overview shows work schedules only. Other activities (vacation, training, etc.) are not displayed here.
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="p-3 text-left font-semibold sticky left-0 bg-muted/50 z-10 min-w-[120px]">
                              Date
                            </th>
                            {selectedTeams.map((teamId) => {
                              const team = teams.find((t) => t.id === teamId);
                              return (
                                <th key={teamId} className="p-3 text-left font-semibold min-w-[200px]">
                                  {team?.name}
                                </th>
                              );
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
                                className={`border-b hover:bg-muted/50 ${isWeekend && showHolidays ? "bg-muted/30" : ""} ${
                                  holiday && showHolidays ? "bg-purple-50 dark:bg-purple-950/20" : ""
                                }`}
                              >
                                <td className="p-3 sticky left-0 bg-background z-10 font-medium">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <div>
                                        <div>{dayName}</div>
                                        <div className="text-xs text-muted-foreground">{format(day, "dd.MM")}</div>
                                      </div>
                                      {holiday && showHolidays && (
                                        <Badge variant="secondary" className="text-xs">
                                          {holiday.name}
                                        </Badge>
                                      )}
                                    </div>
                                    {/* Shift type counter */}
                                    {selectedTeams.length > 0 && (() => {
                                      const counts = getShiftTypeCounts(dateStr, day);
                                      return counts.total > 0 ? (
                                        <div className="flex gap-1.5 text-xs font-mono mt-1">
                                          {counts.early > 0 && (
                                            <span className="px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: getShiftTypeColor("early"), color: 'white' }}>
                                              E:{counts.early}
                                            </span>
                                          )}
                                          {counts.late > 0 && (
                                            <span className="px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: getShiftTypeColor("late"), color: 'white' }}>
                                              L:{counts.late}
                                            </span>
                                          )}
                                          {counts.normal > 0 && (
                                            <span className="px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: getShiftTypeColor("normal"), color: 'white' }}>
                                              N:{counts.normal}
                                            </span>
                                          )}
                                          {counts.weekend > 0 && (
                                            <span className="px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: getShiftTypeColor("weekend"), color: 'white' }}>
                                              W:{counts.weekend}
                                            </span>
                                          )}
                                        </div>
                                      ) : null;
                                    })()}
                                  </div>
                                </td>
                                {selectedTeams.map((teamId) => {
                                  const daySchedules = scheduleByDateAndTeam.get(dateStr)?.get(teamId) || [];
                                  
                                  return (
                                    <td key={teamId} className="p-3">
                                      {daySchedules.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {daySchedules.map((entry, idx) => {
                                            const effectiveShiftType = 
                                              isWeekend && entry.shift_type === 'normal'
                                                ? 'weekend'
                                                : entry.shift_type;
                                            const bgColor = getShiftTypeColor(effectiveShiftType, entry.activity_type);
                                            const code = getShiftTypeCode(effectiveShiftType, entry.activity_type);
                                            const userName = formatUserName(entry.first_name, entry.last_name, entry.initials);
                                            
                                            return (
                                              <Tooltip key={idx}>
                                                <TooltipTrigger asChild>
                                                  <span className="inline-block">
                                                    <Badge 
                                                      variant="secondary"
                                                      className="cursor-pointer text-xs font-semibold"
                                                      style={{
                                                        backgroundColor: bgColor,
                                                        color: 'white',
                                                      }}
                                                    >
                                                      {userName} ({code})
                                                    </Badge>
                                                  </span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <div className="text-sm space-y-1">
                                                    <div className="font-bold">
                                                      {entry.first_name} {entry.last_name}
                                                    </div>
                                                    <div>
                                                      {entry.shift_type} - {entry.activity_type}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                      {entry.team_name}
                                                    </div>
                                                    <div className="text-xs pt-1 mt-1 border-t border-border">
                                                      <span className="text-muted-foreground">Scheduled by:</span>{' '}
                                                      <span className="font-medium">{entry.creator_name}</span>
                                                    </div>
                                                  </div>
                                                </TooltipContent>
                                              </Tooltip>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <ScrollBar orientation="horizontal" className="h-3" />
                      <ScrollBar orientation="vertical" className="w-3" />
                    </ScrollArea>
                  </TooltipProvider>
                )}

                {/* Legend */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-4 text-xs">
                    <div className="font-semibold">Shifts:</div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded" style={{ backgroundColor: getShiftTypeColor("early") }} />
                      <span>E - Early Shift</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded" style={{ backgroundColor: getShiftTypeColor("late") }} />
                      <span>L - Late Shift</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded" style={{ backgroundColor: getShiftTypeColor("weekend") }} />
                      <span>W - Weekend/Holiday</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded" style={{ backgroundColor: getShiftTypeColor("normal") }} />
                      <span>N - Normal</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="grid" className="mt-4">
                <TeamCoverageGrid
                  teamIds={selectedTeams}
                  startDate={weekStart}
                  endDate={weekEnd}
                  showHolidays={showHolidays}
                />
              </TabsContent>

              <TabsContent value="coverage" className="mt-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <CoverageOverview analysis={coverageAnalysis} onExportGaps={exportGapsToExcel} />
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