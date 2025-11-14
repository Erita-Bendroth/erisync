import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardData } from "./BulkScheduleWizard";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

const DAYS_OF_WEEK = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

const QUICK_PRESETS = [
  { value: "day", label: "Day Shift", start: "08:00", end: "16:30" },
  { value: "night", label: "Night Shift", start: "22:00", end: "06:00" },
  { value: "custom", label: "Custom Times", start: "08:00", end: "16:30" },
];

export const ShiftPatternStep = ({ wizardData, updateWizardData }: ShiftPatternStepProps) => {
  const [shiftDefinitions, setShiftDefinitions] = useState<ShiftDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShiftDefinitions();
  }, [wizardData.selectedTeam]);

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

  const handleDayShiftChange = (day: string, shiftId: string) => {
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
        [day]: shiftInfo,
      },
    });
  };

  const getCurrentShift = (day: string) => {
    const pattern = wizardData.shiftPattern?.[day];
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

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Configure Weekly Shift Pattern</h2>
        <p className="text-muted-foreground">Assign different shifts to each day of the week</p>
      </div>

      <Alert>
        <Calendar className="h-4 w-4" />
        <AlertDescription>
          This pattern will repeat for each week in your selected date range. Assign the appropriate shift to each day.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Day-by-Day Configuration</CardTitle>
          <CardDescription>Select the shift type for each day of the week</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day.key} className="flex items-center gap-4">
              <Label className="w-32 font-medium">{day.label}</Label>
              <Select
                value={getCurrentShift(day.key)}
                onValueChange={(value) => handleDayShiftChange(day.key, value)}
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
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pattern Preview</CardTitle>
          <CardDescription>Your weekly shift pattern</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {DAYS_OF_WEEK.map((day) => {
              const shift = wizardData.shiftPattern?.[day.key];
              return (
                <div key={day.key} className="flex items-center justify-between p-3 rounded-lg border">
                  <span className="font-medium w-32">{day.label}</span>
                  {shift ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{shift.shiftName}</span>
                      <span className="font-mono text-xs">
                        {shift.startTime} - {shift.endTime}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not configured</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
