import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WizardData } from "./BulkScheduleWizard";
import { format, eachDayOfInterval, isWeekend as isWeekendDate, addDays, getDay } from "date-fns";
import { Calendar, Users, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const [previewUsers, setPreviewUsers] = useState<Array<{ initials: string; name: string }>>([]);

  useEffect(() => {
    fetchTeamName();
    calculatePreview();
    fetchPreviewUsers();
  }, [wizardData]);

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
      if (wizardData.skipWeekends && isWeekendDate(day)) {
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
          initials: u.initials || `${u.first_name[0]}${u.last_name[0]}`,
          name: `${u.first_name} ${u.last_name}`
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
            initials: u.initials || `${u.first_name[0]}${u.last_name[0]}`,
            name: `${u.first_name} ${u.last_name}`
          })));
        }
      }
    }
  };

  const getTotalShifts = () => {
    if (!wizardData.startDate || !wizardData.endDate) return 0;
    
    const allDays = eachDayOfInterval({
      start: wizardData.startDate,
      end: wizardData.endDate,
    });

    const workingDays = allDays.filter(day => {
      if (wizardData.skipWeekends && isWeekendDate(day)) {
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
      if (!wizardData.startDate || !wizardData.endDate || !user) {
        throw new Error("Missing required data");
      }

      // Get pattern days (the base rotation pattern)
      const patternDays = eachDayOfInterval({
        start: wizardData.startDate,
        end: wizardData.endDate,
      }).filter(day => {
        if (wizardData.skipWeekends && isWeekendDate(day)) {
          return false;
        }
        return true;
      });

      // Fetch holidays if needed (for the entire potential date range)
      let holidays: string[] = [];
      if (wizardData.skipHolidays && wizardData.selectedTeam) {
        const isRecurring = wizardData.enableRecurring && wizardData.mode === "rotation";
        const endDateForHolidays = isRecurring 
          ? addDays(wizardData.startDate, wizardData.rotationCycles * wizardData.rotationIntervalWeeks * 7)
          : wizardData.endDate;

        const { data } = await supabase
          .from("holidays")
          .select("date")
          .gte("date", format(wizardData.startDate, "yyyy-MM-dd"))
          .lte("date", format(endDateForHolidays, "yyyy-MM-dd"))
          .eq("is_public", true);
        
        holidays = data?.map(h => h.date) || [];
      }

      // Get users to schedule
      let usersToSchedule: string[] = [];
      if (wizardData.mode === "team") {
        const { data } = await supabase
          .from("team_members")
          .select("user_id")
          .eq("team_id", wizardData.selectedTeam);
        
        usersToSchedule = data?.map(tm => tm.user_id) || [];
      } else {
        usersToSchedule = wizardData.selectedUsers;
      }

      // Create schedule entries
      const entries = [];
      
      // Check if this is a recurring rotation
      const isRecurring = wizardData.enableRecurring && wizardData.mode === "rotation";
      const cycles = isRecurring ? wizardData.rotationCycles : 1;
      
      for (let cycle = 0; cycle < cycles; cycle++) {
        const offsetDays = cycle * wizardData.rotationIntervalWeeks * 7;
        
        for (const day of patternDays) {
          const scheduledDate = addDays(day, offsetDays);
          const dateStr = format(scheduledDate, "yyyy-MM-dd");
          
          // Get shift info for this specific date
          const shiftInfo = wizardData.shiftPattern?.[dateStr];
          
          // Skip if marked as day off
          if (shiftInfo?.isDayOff) {
            continue;
          }
          
          // Skip if it's a holiday
          if (wizardData.skipHolidays && holidays.includes(dateStr)) {
            continue;
          }
          
          // Use shift pattern info if available, otherwise fallback to wizard data
          const finalShiftInfo = shiftInfo ? {
            shiftType: shiftInfo.shiftType,
            startTime: shiftInfo.startTime,
            endTime: shiftInfo.endTime,
          } : {
            shiftType: wizardData.shiftType,
            startTime: wizardData.startTime,
            endTime: wizardData.endTime,
          };
          
          for (const userId of usersToSchedule) {
            entries.push({
              user_id: userId,
              team_id: wizardData.selectedTeam,
              date: dateStr,
              shift_type: finalShiftInfo.shiftType,
              start_time: finalShiftInfo.startTime,
              end_time: finalShiftInfo.endTime,
              created_by: user.id,
            });
          }
        }
      }

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
      toast({
        title: "Error",
        description: "Failed to generate schedule. Please try again.",
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
            {wizardData.startTime} - {wizardData.endTime}
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
            <span className="text-muted-foreground">Skip Weekends:</span>
            <span className="font-medium">{wizardData.skipWeekends ? "Yes" : "No"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Skip Holidays:</span>
            <span className="font-medium">{wizardData.skipHolidays ? "Yes" : "No"}</span>
          </div>
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
              {previewDays.map((day, index) => {
                const dayOfWeek = getDay(day);
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const shiftLabel = wizardData.shiftType === "normal" ? "Day" : 
                                  wizardData.shiftType === "early" ? "Early" :
                                  wizardData.shiftType === "late" ? "Late" : 
                                  wizardData.shiftType === "night" ? "Night" : "Custom";
                
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
                          {shiftLabel} Shift: {wizardData.startTime || "08:00"} - {wizardData.endTime || "16:30"}
                        </div>
                        {wizardData.mode === "users" && previewUsers.length > 0 && (
                          <div className="text-xs pt-1 border-t">
                            <div className="font-medium">People scheduled:</div>
                            {previewUsers.map((user, idx) => (
                              <div key={idx}>• {user.name}</div>
                            ))}
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
              })}
            </TooltipProvider>
          </div>
        </div>
      )}

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
