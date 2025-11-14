import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TimeSelect } from "@/components/ui/time-select";
import { WizardData } from "./BulkScheduleWizard";
import { Moon, Sun, Calendar, Clock } from "lucide-react";
import { cn, doesShiftCrossMidnight } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface ShiftConfigStepProps {
  wizardData: WizardData;
  updateWizardData: (updates: Partial<WizardData>) => void;
}

interface ShiftDefinition {
  id: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  description?: string;
}

export const ShiftConfigStep = ({ wizardData, updateWizardData }: ShiftConfigStepProps) => {
  const [shiftDefinitions, setShiftDefinitions] = useState<ShiftDefinition[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("custom");

  useEffect(() => {
    if (wizardData.selectedTeam) {
      fetchShiftDefinitions();
    }
  }, [wizardData.selectedTeam]);

  const fetchShiftDefinitions = async () => {
    try {
      const { data, error } = await supabase
        .from("shift_time_definitions")
        .select("*")
        .eq("team_id", wizardData.selectedTeam)
        .order("name");

      if (error) throw error;
      setShiftDefinitions(data || []);
    } catch (error) {
      console.error("Error fetching shift definitions:", error);
    }
  };

  const presetShifts = [
    {
      id: "day",
      label: "Standard Day",
      description: "8:00 AM - 4:30 PM",
      icon: Sun,
      startTime: "08:00",
      endTime: "16:30",
    },
    {
      id: "night",
      label: "Night Shift",
      description: "10:00 PM - 6:00 AM",
      icon: Moon,
      startTime: "22:00",
      endTime: "06:00",
    },
    {
      id: "custom",
      label: "Custom Times",
      description: "Set your own hours",
      icon: Clock,
      startTime: wizardData.startTime,
      endTime: wizardData.endTime,
    },
  ];

  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = presetShifts.find(p => p.id === presetId);
    if (preset && presetId !== "custom") {
      updateWizardData({
        startTime: preset.startTime,
        endTime: preset.endTime,
        shiftType: presetId,
      });
    } else if (presetId === "custom") {
      updateWizardData({ shiftType: "custom" });
    }
  };

  const handleShiftDefinitionSelect = (def: ShiftDefinition) => {
    updateWizardData({
      startTime: def.start_time,
      endTime: def.end_time,
      shiftName: def.shift_type,
      shiftType: def.id,
    });
    setSelectedPreset("definition-" + def.id);
  };

  const calculateDuration = () => {
    if (!wizardData.startTime || !wizardData.endTime) return "";
    
    const [startHour, startMin] = wizardData.startTime.split(':').map(Number);
    const [endHour, endMin] = wizardData.endTime.split(':').map(Number);
    
    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60; // Add 24 hours for overnight shifts
    }
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes > 0 ? minutes + 'm' : ''}`;
  };

  const crossesMidnight = doesShiftCrossMidnight(wizardData.startTime, wizardData.endTime);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">What shifts should be assigned?</h2>
        <p className="text-muted-foreground">Choose a preset or set custom times</p>
      </div>

      {/* Preset Shifts */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Quick Presets</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {presetShifts.map((preset) => {
            const Icon = preset.icon;
            const isSelected = selectedPreset === preset.id;

            return (
              <div
                key={preset.id}
                className={cn(
                  "border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md",
                  isSelected
                    ? "ring-2 ring-primary bg-primary/5"
                    : "hover:bg-accent"
                )}
                onClick={() => handlePresetSelect(preset.id)}
              >
                <div className="flex items-start space-x-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{preset.label}</div>
                    <div className="text-sm text-muted-foreground">{preset.description}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Team Shift Definitions */}
      {shiftDefinitions.length > 0 && (
        <div className="space-y-4">
          <Label className="text-base font-medium">Your Team's Shift Templates</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shiftDefinitions.map((def) => (
              <div
                key={def.id}
                className={cn(
                  "border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md",
                  selectedPreset === "definition-" + def.id
                    ? "ring-2 ring-primary bg-primary/5"
                    : "hover:bg-accent"
                )}
                onClick={() => handleShiftDefinitionSelect(def)}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{def.shift_type}</div>
                  <div className="text-sm text-muted-foreground">
                    {def.start_time} - {def.end_time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Time Picker - Always visible when custom selected */}
      {selectedPreset === "custom" && (
        <div className="border rounded-lg p-6 space-y-4 bg-muted/30">
          <Label className="text-base font-medium">Set Custom Times</Label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="start-time">Start Time</Label>
              <TimeSelect
                value={wizardData.startTime}
                onValueChange={(value) => updateWizardData({ startTime: value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-time">End Time</Label>
              <TimeSelect
                value={wizardData.endTime}
                onValueChange={(value) => updateWizardData({ endTime: value })}
              />
            </div>
          </div>

          <div className="bg-background border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Duration:</span>
              <span className="font-medium">{calculateDuration()}</span>
            </div>
            {crossesMidnight && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
                <Moon className="w-4 h-4" />
                <span>This shift crosses midnight (overnight shift)</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {selectedPreset !== "custom" && wizardData.startTime && wizardData.endTime && (
        <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
          <div className="text-center space-y-1">
            <p className="font-medium">
              {wizardData.startTime} - {wizardData.endTime}
            </p>
            <p className="text-sm text-muted-foreground">
              Duration: {calculateDuration()}
              {crossesMidnight && " (overnight)"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
