import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Calendar, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FairnessParametersProps {
  fairnessWeight: number;
  onFairnessWeightChange: (value: number) => void;
  historicalWindow: number;
  onHistoricalWindowChange: (value: number) => void;
  avoidConsecutiveWeekends: boolean;
  onAvoidConsecutiveWeekendsChange: (value: boolean) => void;
  balanceHolidayShifts: boolean;
  onBalanceHolidayShiftsChange: (value: boolean) => void;
}

export function FairnessParameters({
  fairnessWeight,
  onFairnessWeightChange,
  historicalWindow,
  onHistoricalWindowChange,
  avoidConsecutiveWeekends,
  onAvoidConsecutiveWeekendsChange,
  balanceHolidayShifts,
  onBalanceHolidayShiftsChange,
}: FairnessParametersProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            <CardTitle>Fairness Parameters</CardTitle>
          </div>
          <Badge variant="secondary">Advanced</Badge>
        </div>
        <CardDescription>
          Adjust how the system balances workload distribution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Fairness Weight Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="fairness-weight" className="flex items-center gap-2">
              Fairness vs Coverage Priority
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      <strong>0%:</strong> Prioritize coverage, ignore fairness
                      <br />
                      <strong>50%:</strong> Balance both equally
                      <br />
                      <strong>100%:</strong> Maximize fairness, allow some gaps
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <span className="text-sm font-medium">{fairnessWeight}%</span>
          </div>
          <Slider
            id="fairness-weight"
            value={[fairnessWeight]}
            onValueChange={([value]) => onFairnessWeightChange(value)}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Coverage Priority</span>
            <span>Balanced</span>
            <span>Fairness Priority</span>
          </div>
        </div>

        {/* Historical Window Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="historical-window" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Historical Data Window
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      How far back to look at past shift assignments when calculating fairness.
                      Longer windows ensure better long-term balance.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <span className="text-sm font-medium">{historicalWindow} months</span>
          </div>
          <Slider
            id="historical-window"
            value={[historicalWindow]}
            onValueChange={([value]) => onHistoricalWindowChange(value)}
            min={1}
            max={12}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1 month</span>
            <span>6 months</span>
            <span>12 months</span>
          </div>
        </div>

        {/* Fairness Rules Checkboxes */}
        <div className="space-y-3 pt-2 border-t">
          <Label className="text-sm font-medium">Fairness Rules</Label>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="avoid-consecutive"
              checked={avoidConsecutiveWeekends}
              onCheckedChange={(checked) => onAvoidConsecutiveWeekendsChange(checked as boolean)}
            />
            <Label
              htmlFor="avoid-consecutive"
              className="text-sm font-normal cursor-pointer"
            >
              Avoid consecutive weekend shifts
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground inline-block ml-1 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Prevents assigning the same person to consecutive weekend shifts unless unavoidable
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="balance-holidays"
              checked={balanceHolidayShifts}
              onCheckedChange={(checked) => onBalanceHolidayShiftsChange(checked as boolean)}
            />
            <Label
              htmlFor="balance-holidays"
              className="text-sm font-normal cursor-pointer"
            >
              Balance holiday shifts evenly
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground inline-block ml-1 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Distributes holiday shifts equally across all team members
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
          </div>
        </div>

        {/* Guidance Info */}
        <div className="bg-muted/50 p-3 rounded-lg space-y-1">
          <p className="text-xs font-medium">Recommendations:</p>
          <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
            <li>Start with 50% fairness weight for balanced results</li>
            <li>Use 6-12 months historical window for accurate fairness</li>
            <li>Enable fairness rules for better employee satisfaction</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
