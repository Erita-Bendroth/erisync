import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { BulkSchedulerConfig } from "@/hooks/useBulkSchedulerState";
import { ShiftTypeSelector } from "./ShiftTypeSelector";

interface AdvancedOptionsPanelProps {
  config: BulkSchedulerConfig;
  onConfigChange: (config: BulkSchedulerConfig) => void;
}

export const AdvancedOptionsPanel = ({
  config,
  onConfigChange,
}: AdvancedOptionsPanelProps) => {
  const { advanced } = config;
  
  const onAdvancedChange = (newAdvanced: BulkSchedulerConfig['advanced']) => {
    onConfigChange({ ...config, advanced: newAdvanced });
  };
  
  return (
    <div className="space-y-6 p-4 border rounded-lg bg-muted/20">
      {/* Weekend/Holiday Detection */}
      <div className="space-y-4 pb-4 border-b">
        <h4 className="font-semibold text-sm">Weekend & Holiday Detection</h4>
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Auto-detect Weekends</Label>
            <p className="text-xs text-muted-foreground">
              Automatically use weekend shift for Saturdays and Sundays
            </p>
          </div>
          <Switch
            checked={config.autoDetectWeekends}
            onCheckedChange={(checked) =>
              onConfigChange({ ...config, autoDetectWeekends: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Auto-detect Public Holidays</Label>
            <p className="text-xs text-muted-foreground">
              Automatically use weekend shift for public holidays
            </p>
          </div>
          <Switch
            checked={config.autoDetectHolidays}
            onCheckedChange={(checked) =>
              onConfigChange({ ...config, autoDetectHolidays: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Skip Users with Personal Holidays</Label>
            <p className="text-xs text-muted-foreground">
              Don't schedule users on their personal holidays
            </p>
          </div>
          <Switch
            checked={config.skipUsersWithHolidays}
            onCheckedChange={(checked) =>
              onConfigChange({ ...config, skipUsersWithHolidays: checked })
            }
          />
        </div>

        {(config.autoDetectWeekends || config.autoDetectHolidays) && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-sm font-medium">Weekend/Holiday Shift Override (Optional)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Choose a specific shift for weekends and holidays
            </p>
            <ShiftTypeSelector
              teamId={config.teamId}
              shiftType={config.weekendShiftOverride}
              customTimes={config.customTimes}
              onShiftTypeChange={(type) =>
                onConfigChange({ ...config, weekendShiftOverride: type })
              }
              onCustomTimesChange={(times) =>
                onConfigChange({ ...config, customTimes: times })
              }
              filterToWeekendShifts={true}
              label="Weekend Shift"
            />
          </div>
        )}
      </div>

      {/* Fairness Mode */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="fairness"
            checked={advanced.fairnessEnabled}
            onCheckedChange={(checked) =>
              onAdvancedChange({ ...advanced, fairnessEnabled: checked === true })
            }
          />
          <Label htmlFor="fairness" className="cursor-pointer font-semibold">
            Fairness Mode
          </Label>
        </div>

        {advanced.fairnessEnabled && (
          <div className="pl-6 space-y-2">
            <Label className="text-xs">Weight: {advanced.fairnessWeight}%</Label>
            <Slider
              value={[advanced.fairnessWeight]}
              onValueChange={([value]) =>
                onAdvancedChange({ ...advanced, fairnessWeight: value })
              }
              max={100}
              step={5}
            />
          </div>
        )}
      </div>

      {/* Recurring Patterns */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="recurring"
            checked={advanced.recurringEnabled}
            onCheckedChange={(checked) =>
              onAdvancedChange({ ...advanced, recurringEnabled: checked === true })
            }
          />
          <Label htmlFor="recurring" className="cursor-pointer font-semibold">
            Recurring Pattern
          </Label>
        </div>

        {advanced.recurringEnabled && (
          <div className="pl-6 space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-xs">Repeat every (weeks)</Label>
                <Input
                  type="number"
                  min={1}
                  value={advanced.recurringWeeks}
                  onChange={(e) =>
                    onAdvancedChange({
                      ...advanced,
                      recurringWeeks: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">Number of cycles</Label>
                <Input
                  type="number"
                  min={1}
                  value={advanced.recurringCycles}
                  onChange={(e) =>
                    onAdvancedChange({
                      ...advanced,
                      recurringCycles: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rotation */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="rotation"
            checked={advanced.rotationEnabled}
            onCheckedChange={(checked) =>
              onAdvancedChange({ ...advanced, rotationEnabled: checked === true })
            }
          />
          <Label htmlFor="rotation" className="cursor-pointer font-semibold">
            Rotation Mode
          </Label>
        </div>

        {advanced.rotationEnabled && (
          <div className="pl-6 space-y-2">
            <Label className="text-xs">Pattern</Label>
            <RadioGroup
              value={advanced.rotationPattern}
              onValueChange={(value: 'sequential' | 'random') =>
                onAdvancedChange({ ...advanced, rotationPattern: value })
              }
              className="space-y-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sequential" id="sequential" />
                <div className="flex-1">
                  <Label htmlFor="sequential" className="cursor-pointer font-normal">
                    Sequential
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Assigns shifts in order: Person A → Person B → Person C → repeat
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="random" id="random" />
                <div className="flex-1">
                  <Label htmlFor="random" className="cursor-pointer font-normal">
                    Random
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Randomly distributes shifts among selected team members
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
        )}
      </div>

      {/* Conflict Handling */}
      <div className="space-y-2">
        <Label className="font-semibold">Conflict Handling</Label>
        <RadioGroup
          value={advanced.conflictHandling}
          onValueChange={(value: 'skip' | 'overwrite' | 'ask') =>
            onAdvancedChange({ ...advanced, conflictHandling: value })
          }
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="skip" id="skip" />
            <Label htmlFor="skip" className="cursor-pointer font-normal">
              Skip existing entries
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="overwrite" id="overwrite" />
            <Label htmlFor="overwrite" className="cursor-pointer font-normal">
              Overwrite existing
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
};
