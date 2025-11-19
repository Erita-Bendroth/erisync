import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { useShiftTypes } from "@/hooks/useShiftTypes";
import { Skeleton } from "@/components/ui/skeleton";

interface ShiftTypeSelectorProps {
  teamId: string | null;
  shiftType: string | null;
  customTimes: {
    start: string;
    end: string;
  };
  onShiftTypeChange: (type: string) => void;
  onCustomTimesChange: (times: { start: string; end: string }) => void;
}

export const ShiftTypeSelector = ({
  teamId,
  shiftType,
  customTimes,
  onShiftTypeChange,
  onCustomTimesChange,
}: ShiftTypeSelectorProps) => {
  const { shiftTypes, loading } = useShiftTypes(teamId ? [teamId] : []);

  return (
    <div className="space-y-4">
      <Label>Shift Type</Label>
      
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <RadioGroup value={shiftType || ''} onValueChange={onShiftTypeChange}>
          <div className="space-y-3">
            {shiftTypes.map((shift) => (
              <div key={shift.id} className="flex items-center space-x-2">
                <RadioGroupItem value={shift.id} id={shift.id} />
                <Label htmlFor={shift.id} className="cursor-pointer font-normal flex-1">
                  <div className="flex items-baseline gap-2">
                    <span>{shift.label}</span>
                    {shift.startTime && shift.endTime && (
                      <span className="text-xs text-muted-foreground">
                        {shift.startTime}-{shift.endTime}
                      </span>
                    )}
                  </div>
                </Label>
              </div>
            ))}

            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="custom" />
              <Label htmlFor="custom" className="cursor-pointer font-normal">
                Custom Times
              </Label>
            </div>
          </div>
        </RadioGroup>
      )}

      {shiftType === 'custom' && (
        <div className="flex items-center gap-4 pl-6">
          <div className="flex-1">
            <Label className="text-xs">Start</Label>
            <Input
              type="time"
              value={customTimes.start}
              onChange={(e) =>
                onCustomTimesChange({ ...customTimes, start: e.target.value })
              }
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs">End</Label>
            <Input
              type="time"
              value={customTimes.end}
              onChange={(e) =>
                onCustomTimesChange({ ...customTimes, end: e.target.value })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};
