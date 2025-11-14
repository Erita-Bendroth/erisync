import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { WizardData } from "./BulkScheduleWizard";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, Copy } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, eachDayOfInterval } from "date-fns";
import { cn } from "@/lib/utils";

interface ShiftPatternStepProps {
  wizardData: WizardData;
  updateWizardData: (updates: Partial<WizardData>) => void;
}

interface ShiftDefinition {
  id: string;
  shift_type: string;
  description: string;
  start_time: string;
  end_time: string;
}

const QUICK_PRESETS = [
  { value: "skip", label: "🚫 Skip / Day Off", start: "", end: "" },
  { value: "day", label: "Day Shift", start: "08:00", end: "16:30" },
  { value: "night", label: "Night Shift", start: "22:00", end: "06:00" },
  { value: "custom", label: "Custom Times", start: "08:00", end: "16:30" },
];

export const ShiftPatternStep = ({ wizardData, updateWizardData }: ShiftPatternStepProps) => {
  const [shiftDefinitions, setShiftDefinitions] = useState<ShiftDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState<Date[]>([]);

  useEffect(() => {
    fetchShiftDefinitions();
    generateDates();
  }, [wizardData.selectedTeam, wizardData.startDate, wizardData.endDate]);

  const generateDates = () => {
    if (!wizardData.startDate || !wizardData.endDate) return;

    const dateRange = eachDayOfInterval({
      start: wizardData.startDate,
      end: wizardData.endDate,
    });

    setDates(dateRange);
  };

  const fetchShiftDefinitions = async () => {
    if (!wizardData.selectedTeam) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("shift_time_definitions")
        .select("*")
        .or(`team_id.eq.${wizardData.selectedTeam},team_ids.cs.{${wizardData.selectedTeam}},and(team_id.is.null,team_ids.is.null)`)
        .order("shift_type");

      if (error) throw error;
      setShiftDefinitions(data || []);
    } catch (error) {
      console.error("Error fetching shift definitions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateShiftChange = (dateStr: string, shiftId: string) => {
    // Handle "skip" option
    if (shiftId === "skip") {
      updateWizardData({
        shiftPattern: {
          ...wizardData.shiftPattern,
          [dateStr]: {
            shiftType: "skip",
            shiftName: "Day Off",
            startTime: "",
            endTime: "",
            isDayOff: true,
          },
        },
      });
      return;
    }

    const selectedShift = shiftDefinitions.find(s => s.id === shiftId);
    const preset = QUICK_PRESETS.find(p => p.value === shiftId);

    let shiftInfo;
    if (selectedShift) {
      shiftInfo = {
        shiftType: selectedShift.shift_type,
        shiftName: selectedShift.description || selectedShift.shift_type,
        startTime: selectedShift.start_time,
        endTime: selectedShift.end_time,
      };
    } else if (preset) {
      shiftInfo = {
        shiftType: preset.value,
        shiftName: preset.label,
        startTime: preset.start,
        endTime: preset.end,
      };
    } else {
      return;
    }

    updateWizardData({
      shiftPattern: {
        ...wizardData.shiftPattern,
        [dateStr]: shiftInfo,
      },
    });
  };

  const getCurrentShift = (dateStr: string) => {
    const pattern = wizardData.shiftPattern?.[dateStr];
    if (!pattern) return "";
    
    // Check if it matches a shift definition
    const matchingDef = shiftDefinitions.find(
      s => s.start_time === pattern.startTime && s.end_time === pattern.endTime
    );
    if (matchingDef) return matchingDef.id;
    
    // Check if it matches a preset
    const matchingPreset = QUICK_PRESETS.find(
      p => p.start === pattern.startTime && p.end === pattern.endTime
    );
    if (matchingPreset) return matchingPreset.value;
    
    return "";
  };

  const applyShiftToWeekdays = () => {
    if (!dates.length) return;
    
    const firstWeekdayShift = dates.find(date => {
      const day = date.getDay();
      const dateStr = format(date, "yyyy-MM-dd");
      return day >= 1 && day <= 5 && wizardData.shiftPattern?.[dateStr];
    });

    if (!firstWeekdayShift) return;
    
    const firstWeekdayDateStr = format(firstWeekdayShift, "yyyy-MM-dd");
    const shiftToCopy = wizardData.shiftPattern?.[firstWeekdayDateStr];
    
    if (!shiftToCopy) return;

    const updatedPattern = { ...wizardData.shiftPattern };
    dates.forEach(date => {
      const day = date.getDay();
      if (day >= 1 && day <= 5) {
        const dateStr = format(date, "yyyy-MM-dd");
        updatedPattern[dateStr] = { ...shiftToCopy };
      }
    });

    updateWizardData({ shiftPattern: updatedPattern });
  };

  const applyShiftToWeekends = () => {
    if (!dates.length) return;
    
    const firstWeekendShift = dates.find(date => {
      const day = date.getDay();
      const dateStr = format(date, "yyyy-MM-dd");
      return (day === 0 || day === 6) && wizardData.shiftPattern?.[dateStr];
    });

    if (!firstWeekendShift) return;
    
    const firstWeekendDateStr = format(firstWeekendShift, "yyyy-MM-dd");
    const shiftToCopy = wizardData.shiftPattern?.[firstWeekendDateStr];
    
    if (!shiftToCopy) return;

    const updatedPattern = { ...wizardData.shiftPattern };
    dates.forEach(date => {
      const day = date.getDay();
      if (day === 0 || day === 6) {
        const dateStr = format(date, "yyyy-MM-dd");
        updatedPattern[dateStr] = { ...shiftToCopy };
      }
    });

    updateWizardData({ shiftPattern: updatedPattern });
  };

  const applyShiftToRemaining = () => {
    if (!dates.length) return;
    
    const lastConfiguredDate = dates.find(date => {
      const dateStr = format(date, "yyyy-MM-dd");
      return wizardData.shiftPattern?.[dateStr];
    });

    if (!lastConfiguredDate) return;
    
    const lastConfiguredDateStr = format(lastConfiguredDate, "yyyy-MM-dd");
    const shiftToCopy = wizardData.shiftPattern?.[lastConfiguredDateStr];
    
    if (!shiftToCopy) return;

    const updatedPattern = { ...wizardData.shiftPattern };
    dates.forEach(date => {
      const dateStr = format(date, "yyyy-MM-dd");
      if (!updatedPattern[dateStr]) {
        updatedPattern[dateStr] = { ...shiftToCopy };
      }
    });

    updateWizardData({ shiftPattern: updatedPattern });
  };

  const configuredDates = dates.filter(date => {
    const dateStr = format(date, "yyyy-MM-dd");
    return wizardData.shiftPattern?.[dateStr];
  });

  const workDays = configuredDates.filter(date => {
    const dateStr = format(date, "yyyy-MM-dd");
    return !wizardData.shiftPattern?.[dateStr]?.isDayOff;
  }).length;

  const skipDays = configuredDates.filter(date => {
    const dateStr = format(date, "yyyy-MM-dd");
    return wizardData.shiftPattern?.[dateStr]?.isDayOff;
  }).length;

  const configuredCount = configuredDates.length;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Configure Shifts for Each Day</h2>
        <p className="text-muted-foreground">
          Assign a shift to each date in your selected range
        </p>
      </div>

      <Alert>
        <Calendar className="h-4 w-4" />
        <AlertDescription>
          Configuring {dates.length} dates from {wizardData.startDate && format(wizardData.startDate, "MMM d")} to {wizardData.endDate && format(wizardData.endDate, "MMM d, yyyy")}. 
          Progress: {configuredCount}/{dates.length} dates configured
          {skipDays > 0 && <span className="ml-2 text-muted-foreground">({workDays} work days, {skipDays} days off)</span>}
        </AlertDescription>
      </Alert>

      <div className="flex gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={applyShiftToWeekdays}
          disabled={configuredCount === 0}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy to All Weekdays
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={applyShiftToWeekends}
          disabled={configuredCount === 0}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy to All Weekends
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={applyShiftToRemaining}
          disabled={configuredCount === 0}
        >
          <Copy className="h-4 w-4 mr-2" />
          Apply to Remaining Dates
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date-by-Date Configuration</CardTitle>
          <CardDescription>Select the shift type for each specific date</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
          {dates.map((date) => {
            const dateStr = format(date, "yyyy-MM-dd");
            const dayName = format(date, "EEEE");
            const fullDate = format(date, "MMMM d, yyyy");
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const isSkipped = wizardData.shiftPattern?.[dateStr]?.isDayOff;

            return (
              <div 
                key={dateStr} 
                className={cn(
                  "flex items-center gap-4 p-3 rounded-lg border",
                  isSkipped && "bg-muted/50 border-muted opacity-60"
                )}
              >
                <div className="min-w-[200px]">
                  <div className="font-medium flex items-center gap-2">
                    {dayName}
                    {isSkipped && <span className="text-xs text-destructive">(Skipped)</span>}
                  </div>
                  <div className={`text-sm ${isWeekend ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
                    {fullDate}
                  </div>
                </div>
                <Select
                  value={getCurrentShift(dateStr)}
                  onValueChange={(value) => handleDateShiftChange(dateStr, value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select shift..." />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Quick Presets
                    </div>
                    {QUICK_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span>{preset.label}</span>
                          <span className="text-xs text-muted-foreground">
                            ({preset.start} - {preset.end})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                    {shiftDefinitions.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-2">
                          Team Shift Templates
                        </div>
                        {shiftDefinitions.map((shift) => (
                          <SelectItem key={shift.id} value={shift.id}>
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              <span>{shift.description || shift.shift_type}</span>
                              <span className="text-xs text-muted-foreground">
                                ({shift.start_time} - {shift.end_time})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};
