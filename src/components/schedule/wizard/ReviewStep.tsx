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

  useEffect(() => {
    fetchTeamName();
    calculatePreview();
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

    return workingDays.length * userCount;
  };

  const handleGenerate = async () => {
    setLoading(true);
    
    try {
      if (!wizardData.startDate || !wizardData.endDate || !user) {
        throw new Error("Missing required data");
      }

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

      // Fetch holidays if needed
      let holidays: string[] = [];
      if (wizardData.skipHolidays && wizardData.selectedTeam) {
        const { data } = await supabase
          .from("holidays")
          .select("date")
          .gte("date", format(wizardData.startDate, "yyyy-MM-dd"))
          .lte("date", format(wizardData.endDate, "yyyy-MM-dd"))
          .eq("is_public", true);
        
        holidays = data?.map(h => h.date) || [];
      }

      const finalDays = workingDays.filter(day => {
        if (wizardData.skipHolidays) {
          const dateStr = format(day, "yyyy-MM-dd");
          return !holidays.includes(dateStr);
        }
        return true;
      });

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
      for (const day of finalDays) {
        for (const userId of usersToSchedule) {
          entries.push({
            user_id: userId,
            team_id: wizardData.selectedTeam,
            date: format(day, "yyyy-MM-dd"),
            shift_type: wizardData.shiftType,
            start_time: wizardData.startTime,
            end_time: wizardData.endTime,
            created_by: user.id,
          });
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

      toast({
        title: "Success!",
        description: `Created ${entries.length} schedule entries`,
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
        </div>
      </div>

      {/* Preview Calendar */}
      {previewDays.length > 0 && (
        <div className="border rounded-lg p-6">
          <h3 className="font-medium text-lg mb-4">Preview (First {previewDays.length} Days)</h3>
          
          <div className="grid grid-cols-7 gap-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            
            {previewDays.map((day, index) => {
              const dayOfWeek = getDay(day);
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              
              return (
                <div
                  key={index}
                  className={cn(
                    "text-center p-2 rounded text-sm",
                    isWeekend ? "bg-muted/50" : "bg-primary/10"
                  )}
                >
                  {format(day, "d")}
                </div>
              );
            })}
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
