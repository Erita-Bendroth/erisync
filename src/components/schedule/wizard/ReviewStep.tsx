import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WizardData } from "./BulkScheduleWizard";
import { format, eachDayOfInterval, isWeekend as isWeekendDate, addDays, getDay } from "date-fns";
import { Calendar, Users, Clock, CheckCircle2, Loader2, ArrowLeftRight, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SharedPlanningCalendar } from "./SharedPlanningCalendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getShiftForDate, fetchTeamShiftDefinitions } from "@/lib/previewShiftSelection";

interface ReviewStepProps {
  wizardData: WizardData;
  onScheduleGenerated?: () => void;
}

export const ReviewStep = ({ wizardData, onScheduleGenerated }: ReviewStepProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [userCount, setUserCount] = useState(0);
  const [previewDays, setPreviewDays] = useState<Date[]>([]);
  const [previewUsers, setPreviewUsers] = useState<Array<{ userId: string; initials: string; name: string; countryCode?: string }>>([]);
  const [shiftDefinitions, setShiftDefinitions] = useState<any[]>([]);

  useEffect(() => {
    fetchTeamName();
    calculatePreview();
    fetchPreviewUsers();
    if (wizardData.selectedTeam) {
      fetchShiftDefinitions();
    }
  }, [wizardData]);

  const fetchShiftDefinitions = async () => {
    if (!wizardData.selectedTeam) return;
    const definitions = await fetchTeamShiftDefinitions(wizardData.selectedTeam);
    setShiftDefinitions(definitions);
  };

  const fetchTeamName = async () => {
    if (!wizardData.selectedTeam) return;
    
    const { data } = await supabase
      .from("teams")
      .select("name")
      .eq("id", wizardData.selectedTeam)
      .single();
    
    if (data) setTeamName(data.name);
  };

  const calculatePreview = () => {
    if (!wizardData.startDate || !wizardData.endDate) return;
    
    const allDays = eachDayOfInterval({
      start: wizardData.startDate,
      end: wizardData.endDate,
    });

    const filteredDays = allDays.filter(day => {
      if (wizardData.excludedDays.includes(day.getDay())) {
        return false;
      }
      return true;
    });

    setPreviewDays(filteredDays.slice(0, 14)); // Show first 14 days max
    
    if (wizardData.mode === "team") {
      fetchTeamMemberCount();
    } else {
      setUserCount(wizardData.selectedUsers.length);
    }
  };

  const fetchTeamMemberCount = async () => {
    if (!wizardData.selectedTeam) return;
    
    const { count } = await supabase
      .from("team_members")
      .select("*", { count: "exact", head: true })
      .eq("team_id", wizardData.selectedTeam);
    
    setUserCount(count || 0);
  };

  const fetchPreviewUsers = async () => {
    if (wizardData.mode === "users" && wizardData.selectedUsers.length > 0) {
      const { data } = await supabase
        .rpc('get_multiple_basic_profile_info', { _user_ids: wizardData.selectedUsers });
      
      if (data) {
        setPreviewUsers(data.map((u: any) => ({
          userId: u.user_id,
          initials: u.initials || `${u.first_name[0]}${u.last_name[0]}`,
          name: `${u.first_name} ${u.last_name}`,
          countryCode: u.country_code
        })));
      }
    } else if (wizardData.mode === "team" && wizardData.selectedTeam) {
      const { data: membersData } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", wizardData.selectedTeam)
        .limit(5);

      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(m => m.user_id);
        const { data } = await supabase
          .rpc('get_multiple_basic_profile_info', { _user_ids: userIds });
        
        if (data) {
          setPreviewUsers(data.map((u: any) => ({
            userId: u.user_id,
            initials: u.initials || `${u.first_name[0]}${u.last_name[0]}`,
            name: `${u.first_name} ${u.last_name}`,
            countryCode: u.country_code
          })));
        }
      }
    }
  };

  // Map UI shift types to valid database enum values
  const mapShiftTypeToEnum = (shiftType: string | undefined): "early" | "late" | "normal" | "weekend" => {
    if (!shiftType) return "normal";
    
    const mapping: Record<string, "early" | "late" | "normal" | "weekend"> = {
      "day": "normal",
      "night": "late",
      "custom": "normal",
      "early": "early",
      "late": "late",
      "normal": "normal",
      "weekend": "weekend",
    };
    return mapping[shiftType] || "normal";
  };

  const getTotalShifts = () => {
    if (!wizardData.startDate || !wizardData.endDate) return 0;
    
    const allDays = eachDayOfInterval({
      start: wizardData.startDate,
      end: wizardData.endDate,
    });

    const workingDays = allDays.filter(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const shiftInfo = wizardData.shiftPattern?.[dateStr];
      
      // Skip if marked as day off in pattern
      if (wizardData.mode === "rotation" && shiftInfo?.isDayOff) {
        return false;
      }
      
      // Skip excluded days if configured
      if (wizardData.excludedDays.includes(day.getDay())) {
        return false;
      }
      
      return true;
    });

    const baseDays = workingDays.length;
    const multiplier = wizardData.enableRecurring && wizardData.mode === "rotation" 
      ? wizardData.rotationCycles 
      : 1;

    return baseDays * userCount * multiplier;
  };

  const handleGenerate = async () => {
    setLoading(true);
    
    try {
      // Validate required data
      if (!wizardData.startDate || !wizardData.endDate) {
        throw new Error("Start date and end date are required");
      }
      
      if (!wizardData.selectedTeam) {
        throw new Error("Please select a team before generating schedule");
      }
      
      if (!user?.id) {
        throw new Error("User authentication required");
      }

      // Get pattern days (the base rotation pattern)
      const patternDays = eachDayOfInterval({
        start: wizardData.startDate,
        end: wizardData.endDate,
      }).filter(day => {
        if (wizardData.excludedDays.includes(day.getDay())) {
          return false;
        }
        return true;
      });

      // Fetch holidays WITH location data (for the entire potential date range)
      let holidaysMap: Map<string, { date: string; countryCode: string; regionCode: string | null }[]> = new Map();
      if (wizardData.skipHolidays && wizardData.selectedTeam) {
        const isRecurring = wizardData.enableRecurring && wizardData.mode === "rotation";
        const endDateForHolidays = isRecurring 
          ? addDays(wizardData.startDate, wizardData.rotationCycles * wizardData.rotationIntervalWeeks * 7)
          : wizardData.endDate;

        const { data: holidaysData } = await supabase
          .from("holidays")
          .select("date, country_code, region_code")
          .gte("date", format(wizardData.startDate, "yyyy-MM-dd"))
          .lte("date", format(endDateForHolidays, "yyyy-MM-dd"))
          .eq("is_public", true)
          .is("user_id", null); // Only centrally managed holidays
        
        // Organize holidays by date
        holidaysData?.forEach(h => {
          if (!holidaysMap.has(h.date)) {
            holidaysMap.set(h.date, []);
          }
          holidaysMap.get(h.date)!.push({
            date: h.date,
            countryCode: h.country_code,
            regionCode: h.region_code
          });
        });
      }

      // Get users to schedule WITH their location data
      let usersToSchedule: { userId: string; countryCode: string; regionCode: string | null }[] = [];
      if (wizardData.mode === "team") {
        const { data: teamMembers } = await supabase
          .from("team_members")
          .select("user_id, profiles!inner(country_code, region_code)")
          .eq("team_id", wizardData.selectedTeam);
        
        usersToSchedule = teamMembers?.map(tm => ({
          userId: tm.user_id,
          countryCode: (tm.profiles as any).country_code || 'US',
          regionCode: (tm.profiles as any).region_code
        })) || [];
      } else if (wizardData.mode === "users") {
        // Handle users mode - fetch selected users with their country codes
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, country_code, region_code")
          .in("user_id", wizardData.selectedUsers || []);
        
        usersToSchedule = profiles?.map(p => ({
          userId: p.user_id,
          countryCode: p.country_code || 'US',
          regionCode: p.region_code
        })) || [];
      } else if (wizardData.mode === "rotation") {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, country_code, region_code")
          .in("user_id", wizardData.selectedUsers || []);
        
        usersToSchedule = profiles?.map(p => ({
          userId: p.user_id,
          countryCode: p.country_code || 'US',
          regionCode: p.region_code
        })) || [];
      }

      if (usersToSchedule.length === 0) {
        throw new Error("No users found to schedule");
      }

      // Create schedule entries
      const entries = [];
      
      // Check if this is a recurring rotation
      const isRecurring = wizardData.enableRecurring && wizardData.mode === "rotation";
      const cycles = isRecurring ? wizardData.rotationCycles : 1;
      
      for (let cycle = 0; cycle < cycles; cycle++) {
        const offsetDays = cycle * wizardData.rotationIntervalWeeks * 7;
        
        for (const day of patternDays) {
          // Use the ORIGINAL date to look up the pattern
          const originalDateStr = format(day, "yyyy-MM-dd");
          const shiftInfo = wizardData.shiftPattern?.[originalDateStr];
          
          // Skip if marked as day off
          if (shiftInfo?.isDayOff) {
            continue;
          }
          
          // Calculate the SCHEDULED date (with offset for recurring cycles)
          const scheduledDate = addDays(day, offsetDays);
          const scheduledDateStr = format(scheduledDate, "yyyy-MM-dd");
          
          // Check if the SCHEDULED date is a holiday for ANY of the users
          // We'll check per-user in the loop below
          
          for (const userProfile of usersToSchedule) {
            // Validate user ID
            if (!userProfile.userId) {
              console.warn("Skipping entry: user_id is undefined");
              continue;
            }

            // Check if the SCHEDULED date is a holiday for THIS specific user
            let skipDueToHoliday = false;
            if (wizardData.skipHolidays && holidaysMap.has(scheduledDateStr)) {
              const dateHolidays = holidaysMap.get(scheduledDateStr)!;
              skipDueToHoliday = dateHolidays.some(holiday => {
                // Holiday matches if country matches AND (no region specified OR region matches)
                const countryMatches = holiday.countryCode === userProfile.countryCode;
                const regionMatches = !holiday.regionCode || holiday.regionCode === userProfile.regionCode;
                return countryMatches && regionMatches;
              });
            }

            if (skipDueToHoliday) {
              console.log(`Skipping ${scheduledDateStr} for user ${userProfile.userId} - holiday in their location`);
              continue;
            }

            // Calculate shift info for THIS specific user with THEIR country code
            let finalShiftInfo;
            if (shiftInfo) {
              finalShiftInfo = {
                shiftType: mapShiftTypeToEnum(shiftInfo.shiftType),
                shiftName: shiftInfo.shiftName,
                startTime: shiftInfo.startTime,
                endTime: shiftInfo.endTime,
              };
            } else if (shiftDefinitions.length > 0 && wizardData.shiftType) {
              // Use smart selection based on day of week AND USER'S COUNTRY
              const smartShift = getShiftForDate(
                scheduledDate,
                wizardData.shiftType,
                true, // autoDetectWeekends
                null, // weekendOverrideShiftId
                shiftDefinitions,
                userProfile.countryCode  // Pass user's country code
              );
              finalShiftInfo = {
                shiftType: mapShiftTypeToEnum(smartShift.shiftType),
                shiftName: smartShift.description || wizardData.shiftName || "Day Shift",
                startTime: smartShift.startTime,
                endTime: smartShift.endTime,
              };
            } else {
              // Final fallback to wizard data
              finalShiftInfo = {
                shiftType: mapShiftTypeToEnum(wizardData.shiftType),
                shiftName: wizardData.shiftName || "Day Shift",
                startTime: wizardData.startTime || "08:00",
                endTime: wizardData.endTime || "16:30",
              };
            }

            // Format time information as JSON in notes
            const timeInfo = JSON.stringify([{
              activity_type: "work",
              start_time: finalShiftInfo.startTime,
              end_time: finalShiftInfo.endTime
            }]);
            
            const description = wizardData.mode === "rotation" 
              ? `Auto-generated ${finalShiftInfo.shiftName} (Rotation)`
              : `Auto-generated ${finalShiftInfo.shiftName}`;
            
            entries.push({
              user_id: userProfile.userId,
              team_id: wizardData.selectedTeam,
              date: scheduledDateStr,
              shift_type: finalShiftInfo.shiftType as "early" | "late" | "normal" | "weekend",
              activity_type: "work" as const,
              availability_status: "available" as const,
              notes: `Times: ${timeInfo}\n${description}`,
              created_by: user.id,
            });
          }
        }
      }

      // Calculate the full date range including all recurring cycles
      const fullDateRange = {
        start: wizardData.startDate,
        end: isRecurring 
          ? addDays(wizardData.startDate, cycles * wizardData.rotationIntervalWeeks * 7)
          : wizardData.endDate
      };

      console.log("Deleting existing entries for:", {
        team: wizardData.selectedTeam,
        users: usersToSchedule.length,
        dateRange: [format(fullDateRange.start, "yyyy-MM-dd"), format(fullDateRange.end, "yyyy-MM-dd")]
      });

      // Delete existing entries for this exact scope
      const userIds = usersToSchedule.map(u => u.userId);
      const { error: deleteError } = await supabase
        .from("schedule_entries")
        .delete()
        .eq("team_id", wizardData.selectedTeam)
        .in("user_id", userIds)
        .gte("date", format(fullDateRange.start, "yyyy-MM-dd"))
        .lte("date", format(fullDateRange.end, "yyyy-MM-dd"));

      if (deleteError) {
        console.error("Error deleting existing entries:", deleteError);
        throw new Error(`Failed to clear existing schedule: ${deleteError.message}`);
      }

      console.log(`Cleared existing entries. Now inserting ${entries.length} new entries.`);

      // Insert in batches
      const batchSize = 100;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const { error } = await supabase
          .from("schedule_entries")
          .insert(batch);
        
        if (error) throw error;
      }

      const description = isRecurring
        ? `Created ${entries.length} schedule entries across ${cycles} rotation cycles`
        : `Created ${entries.length} schedule entries`;

      toast({
        title: "Success!",
        description,
      });

      onScheduleGenerated?.();
    } catch (error) {
      console.error("Error generating schedule:", error);
      
      let errorMessage: string;
      
      // Check if it's a duplicate key error
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        errorMessage = "Duplicate entries detected. Some schedule entries may already exist for these dates. Try deleting existing entries for this date range first, or contact support if the issue persists.";
      } else if (error && typeof error === 'object' && 'code' in error && error.code === '409') {
        errorMessage = "Conflict detected. Please refresh the page and try again. If the problem continues, try manually deleting entries for this date range first.";
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = "Failed to generate schedule. Please check your configuration and try again.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Review Your Schedule</h2>
        <p className="text-muted-foreground">Check everything before generating</p>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="summary">Summary & Preview</TabsTrigger>
          <TabsTrigger value="planning" className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" />
            Side-by-Side Planning
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6 mt-6">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="font-medium">Date Range</div>
          </div>
          <div className="text-sm text-muted-foreground">
            {wizardData.startDate && format(wizardData.startDate, "MMM d")} - {wizardData.endDate && format(wizardData.endDate, "MMM d, yyyy")}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {previewDays.length} days
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="font-medium">People</div>
          </div>
          <div className="text-sm text-muted-foreground">
            {teamName}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {userCount} people
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div className="font-medium">Shift Times</div>
          </div>
          <div className="text-sm text-muted-foreground">
            {shiftDefinitions.length > 1 
              ? "Varies by day (see preview)" 
              : `${wizardData.startTime} - ${wizardData.endTime}`
            }
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {wizardData.shiftName || wizardData.shiftType}
          </div>
        </div>
      </div>

      {/* Detailed Summary */}
      <div className="border rounded-lg p-6 space-y-4">
        <h3 className="font-medium text-lg">Schedule Details</h3>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mode:</span>
            <span className="font-medium capitalize">{wizardData.mode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Shifts:</span>
            <span className="font-medium">{getTotalShifts()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Excluded Days:</span>
            <span className="font-medium">
              {wizardData.excludedDays.includes(0) && wizardData.excludedDays.includes(6) 
                ? "Weekends" 
                : wizardData.excludedDays.includes(6) 
                ? "Saturdays" 
                : wizardData.excludedDays.includes(0) 
                ? "Sundays" 
                : "None"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Skip Holidays:</span>
            <span className="font-medium">{wizardData.skipHolidays ? "Yes" : "No"}</span>
          </div>
          {shiftDefinitions.some(def => def.country_codes && def.country_codes.length > 0) && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Location-specific shift times configured
              </span>
              <Badge variant="outline" className="text-xs">Auto-assigned</Badge>
            </div>
          )}
          {wizardData.fairnessMode && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fairness Mode:</span>
              <Badge variant="secondary">Enabled</Badge>
            </div>
          )}
          {wizardData.enableRecurring && wizardData.mode === "rotation" && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rotation Interval:</span>
                <span className="font-medium">Every {wizardData.rotationIntervalWeeks} week(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Number of Cycles:</span>
                <span className="font-medium">{wizardData.rotationCycles} cycles</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Duration:</span>
                <span className="font-medium">
                  ~{wizardData.rotationCycles * wizardData.rotationIntervalWeeks} weeks
                  {" "}({Math.round(wizardData.rotationCycles * wizardData.rotationIntervalWeeks / 4.33)} months)
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Preview Calendar */}
      {previewDays.length > 0 && (
        <div className="border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-lg">Preview (First {previewDays.length} Days)</h3>
            <div className="flex gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-primary/20 border border-primary/40"></div>
                <span className="text-muted-foreground">Weekday</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-muted/50 border border-border"></div>
                <span className="text-muted-foreground">Weekend</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground pb-1">
                {day}
              </div>
            ))}
            
            <TooltipProvider>
              {(() => {
                // Check if we have country-specific shifts configured
                const hasCountrySpecificShifts = shiftDefinitions.some(
                  def => def.country_codes && def.country_codes.length > 0
                );

                // Helper to calculate shift for a user on a specific day
                const getUserShiftForDay = (day: Date, userCountryCode?: string) => {
                  if (shiftDefinitions.length > 0) {
                    return getShiftForDate(
                      day,
                      wizardData.shiftType,
                      true,
                      null,
                      shiftDefinitions,
                      userCountryCode
                    );
                  }
                  return null;
                };

                return previewDays.map((day, index) => {
                  const dayOfWeek = getDay(day);
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const shiftLabel = wizardData.shiftType === "normal" ? "Day" : 
                                    wizardData.shiftType === "early" ? "Early" :
                                    wizardData.shiftType === "late" ? "Late" : 
                                    wizardData.shiftType === "night" ? "Night" : "Custom";
                  
                  const fallbackTime = `${wizardData.startTime || "08:00"} - ${wizardData.endTime || "16:30"}`;
                  
                  // Calculate shift info based on mode and country-specific configuration
                  let displayInfo: { time: string; shiftName: string; note?: string };

                  if (wizardData.mode === "users" && hasCountrySpecificShifts && previewUsers.length > 0) {
                    // Calculate unique shift times for the selected users
                    const userShifts = previewUsers.map(user => 
                      getUserShiftForDay(day, user.countryCode)
                    );
                    const uniqueTimes = new Set(userShifts.map(s => 
                      s ? `${s.startTime} - ${s.endTime}` : null
                    ));
                    
                    if (uniqueTimes.size > 1) {
                      displayInfo = {
                        time: "Varies by location",
                        shiftName: shiftLabel,
                        note: "Different shift times per user"
                      };
                    } else {
                      const firstShift = userShifts[0];
                      displayInfo = {
                        time: firstShift ? `${firstShift.startTime} - ${firstShift.endTime}` : fallbackTime,
                        shiftName: firstShift?.description || shiftLabel
                      };
                    }
                  } else {
                    // Original logic for team mode or non-country-specific shifts
                    const smartShift = getUserShiftForDay(day, undefined);
                    displayInfo = {
                      time: smartShift ? `${smartShift.startTime} - ${smartShift.endTime}` : fallbackTime,
                      shiftName: smartShift?.description || shiftLabel
                    };
                  }

                  const displayTime = displayInfo.time;
                  const displayShiftName = displayInfo.shiftName;
                
                return (
                  <Tooltip key={index}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "relative rounded border p-2 min-h-[60px] cursor-pointer transition-colors hover:border-primary/60",
                          isWeekend ? "bg-muted/50 border-border" : "bg-primary/10 border-primary/30"
                        )}
                      >
                        <div className="text-xs font-medium mb-1">{format(day, "d")}</div>
                        
                        {wizardData.mode === "users" && previewUsers.length > 0 && (
                          <div className="space-y-0.5">
                            {previewUsers.slice(0, 2).map((user, idx) => (
                              <div key={idx} className="text-[10px] bg-primary/20 rounded px-1 truncate">
                                {user.initials}
                              </div>
                            ))}
                            {previewUsers.length > 2 && (
                              <div className="text-[10px] text-muted-foreground">
                                +{previewUsers.length - 2}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {wizardData.mode === "team" && (
                          <div className="space-y-0.5">
                            <Badge variant="secondary" className="text-[9px] h-4 px-1">
                              {shiftLabel}
                            </Badge>
                            <div className="text-[10px] text-muted-foreground">
                              {userCount} members
                            </div>
                          </div>
                        )}
                        
                        {wizardData.mode === "rotation" && (
                          <div className="text-[10px] text-center">
                            <Badge variant="outline" className="text-[9px] h-4 px-1">
                              Rotation
                            </Badge>
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="space-y-1">
                        <div className="font-medium">{format(day, "MMMM d, yyyy")}</div>
                        <div className="text-xs text-muted-foreground">
                          {displayShiftName} Shift: {displayTime}
                        </div>
                        {wizardData.mode === "users" && previewUsers.length > 0 && (
                          <div className="text-xs pt-1 border-t">
                            <div className="font-medium mb-1">People scheduled:</div>
                            {previewUsers.map((user, idx) => {
                              const userShift = getUserShiftForDay(day, user.countryCode);
                              const userTime = userShift 
                                ? `${userShift.startTime} - ${userShift.endTime}`
                                : fallbackTime;
                              const userShiftDesc = userShift?.description || shiftLabel;
                              return (
                                <div key={idx} className="space-y-0.5">
                                  <div className="flex justify-between gap-2">
                                    <span>• {user.name}</span>
                                    <span className="text-muted-foreground font-mono text-[10px]">
                                      {userTime}
                                    </span>
                                  </div>
                                  <div className="pl-3 text-[10px] text-muted-foreground italic">
                                    {userShiftDesc}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {wizardData.mode === "team" && (
                          <div className="text-xs pt-1 border-t">
                            Team: {teamName} ({userCount} members)
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  );
                });
              })()}
            </TooltipProvider>
          </div>
        </div>
      )}

        </TabsContent>

        <TabsContent value="planning" className="mt-6">
          <SharedPlanningCalendar wizardData={wizardData} />
        </TabsContent>
      </Tabs>

      {/* Generate Button */}
      <Button
        size="lg"
        className="w-full"
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Generating Schedule...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Generate Schedule ({getTotalShifts()} shifts)
          </>
        )}
      </Button>
    </div>
  );
};
