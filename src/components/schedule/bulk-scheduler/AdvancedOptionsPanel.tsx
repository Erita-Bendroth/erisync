import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BulkSchedulerConfig } from "@/hooks/useBulkSchedulerState";

interface AdvancedOptionsPanelProps {
  advanced: BulkSchedulerConfig['advanced'];
  onAdvancedChange: (advanced: BulkSchedulerConfig['advanced']) => void;
}

export const AdvancedOptionsPanel = ({
  advanced,
  onAdvancedChange,
}: AdvancedOptionsPanelProps) => {
  return (
    <div className="space-y-6 p-4 border rounded-lg bg-muted/20">
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
