import React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { WizardData } from "./BulkScheduleWizard";
import { ChevronDown, TrendingUp, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdvancedOptionsStepProps {
  wizardData: WizardData;
  updateWizardData: (updates: Partial<WizardData>) => void;
}

export const AdvancedOptionsStep = ({ wizardData, updateWizardData }: AdvancedOptionsStepProps) => {
  const [fairnessOpen, setFairnessOpen] = React.useState(false);
  const [rotationOpen, setRotationOpen] = React.useState(wizardData.mode === "rotation");

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Advanced Options</h2>
        <p className="text-muted-foreground">Optional settings to fine-tune your schedule (can be skipped)</p>
      </div>

      {/* Fairness Distribution */}
      <Collapsible open={fairnessOpen} onOpenChange={setFairnessOpen}>
        <CollapsibleTrigger className="w-full">
          <div className={cn(
            "flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer",
            fairnessOpen && "bg-accent"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-medium">Fairness Distribution</div>
                <div className="text-sm text-muted-foreground">
                  Balance shifts fairly across team members
                </div>
              </div>
            </div>
            <ChevronDown className={cn(
              "w-5 h-5 transition-transform",
              fairnessOpen && "rotate-180"
            )} />
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-4 space-y-6 border rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="fairness-mode"
              checked={wizardData.fairnessMode}
              onCheckedChange={(checked) => 
                updateWizardData({ fairnessMode: checked as boolean })
              }
            />
            <Label htmlFor="fairness-mode" className="cursor-pointer">
              Enable fairness-based scheduling
            </Label>
          </div>

          {wizardData.fairnessMode && (
            <>
              <div className="space-y-3">
                <Label>Fairness Weight: {wizardData.fairnessWeight}%</Label>
                <Slider
                  value={[wizardData.fairnessWeight]}
                  onValueChange={([value]) => updateWizardData({ fairnessWeight: value })}
                  min={0}
                  max={100}
                  step={10}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Higher values prioritize fairness more strongly when assigning shifts
                </p>
              </div>

              <div className="space-y-3">
                <Label>Consider History From: Past {wizardData.historicalWindow} Months</Label>
                <Slider
                  value={[wizardData.historicalWindow]}
                  onValueChange={([value]) => updateWizardData({ historicalWindow: value })}
                  min={1}
                  max={12}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Look back this many months when calculating fair distribution
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="avoid-consecutive"
                    checked={wizardData.avoidConsecutiveWeekends}
                    onCheckedChange={(checked) => 
                      updateWizardData({ avoidConsecutiveWeekends: checked as boolean })
                    }
                  />
                  <Label htmlFor="avoid-consecutive" className="cursor-pointer">
                    Avoid consecutive weekend assignments
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="balance-holidays"
                    checked={wizardData.balanceHolidayShifts}
                    onCheckedChange={(checked) => 
                      updateWizardData({ balanceHolidayShifts: checked as boolean })
                    }
                  />
                  <Label htmlFor="balance-holidays" className="cursor-pointer">
                    Balance holiday shifts fairly
                  </Label>
                </div>
              </div>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Rotation Pattern - Only for rotation mode */}
      {wizardData.mode === "rotation" && (
        <Collapsible open={rotationOpen} onOpenChange={setRotationOpen}>
          <CollapsibleTrigger className="w-full">
            <div className={cn(
              "flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer",
              rotationOpen && "bg-accent"
            )}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Repeat className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Recurring Pattern</div>
                  <div className="text-sm text-muted-foreground">
                    Set up repeating schedule cycles
                  </div>
                </div>
              </div>
              <ChevronDown className={cn(
                "w-5 h-5 transition-transform",
                rotationOpen && "rotate-180"
              )} />
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-4 space-y-6 border rounded-lg p-6">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="enable-recurring"
                checked={wizardData.enableRecurring}
                onCheckedChange={(checked) => 
                  updateWizardData({ enableRecurring: checked as boolean })
                }
              />
              <Label htmlFor="enable-recurring" className="cursor-pointer">
                Enable recurring rotation
              </Label>
            </div>

            {wizardData.enableRecurring && (
              <>
                <div className="space-y-3">
                  <Label>Rotation Interval: {wizardData.rotationIntervalWeeks} Week(s)</Label>
                  <Slider
                    value={[wizardData.rotationIntervalWeeks]}
                    onValueChange={([value]) => updateWizardData({ rotationIntervalWeeks: value })}
                    min={1}
                    max={12}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    How often the rotation pattern repeats
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Number of Cycles: {wizardData.rotationCycles}</Label>
                  <Slider
                    value={[wizardData.rotationCycles]}
                    onValueChange={([value]) => updateWizardData({ rotationCycles: value })}
                    min={1}
                    max={26}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    How many times to repeat the rotation pattern
                  </p>
                </div>

                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <p className="text-sm">
                    <strong>Your rotation will repeat {wizardData.rotationCycles} time{wizardData.rotationCycles > 1 ? 's' : ''}</strong>, 
                    every <strong>{wizardData.rotationIntervalWeeks} week{wizardData.rotationIntervalWeeks > 1 ? 's' : ''}</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total duration: ~{wizardData.rotationCycles * wizardData.rotationIntervalWeeks} weeks
                    ({Math.round(wizardData.rotationCycles * wizardData.rotationIntervalWeeks / 4.33)} months)
                  </p>
                </div>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="bg-muted/50 p-4 rounded-lg text-center">
        <p className="text-sm text-muted-foreground">
          <strong>Tip:</strong> These options are optional. You can skip them and proceed to review your schedule.
        </p>
      </div>
    </div>
  );
};
