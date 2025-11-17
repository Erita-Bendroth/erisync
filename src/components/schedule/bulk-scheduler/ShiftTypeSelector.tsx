import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";

interface ShiftTypeSelectorProps {
  shiftType: string | null;
  customTimes: {
    start: string;
    end: string;
  };
  onShiftTypeChange: (type: string) => void;
  onCustomTimesChange: (times: { start: string; end: string }) => void;
}

export const ShiftTypeSelector = ({
  shiftType,
  customTimes,
  onShiftTypeChange,
  onCustomTimesChange,
}: ShiftTypeSelectorProps) => {
  return (
    <div className="space-y-4">
      <Label>Shift Type</Label>
      
      <RadioGroup value={shiftType || ''} onValueChange={onShiftTypeChange}>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="normal" id="normal" />
            <Label htmlFor="normal" className="cursor-pointer font-normal">
              Standard Day
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <RadioGroupItem value="early" id="early" />
            <Label htmlFor="early" className="cursor-pointer font-normal">
              Early Shift
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <RadioGroupItem value="late" id="late" />
            <Label htmlFor="late" className="cursor-pointer font-normal">
              Late Shift
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <RadioGroupItem value="weekend" id="weekend" />
            <Label htmlFor="weekend" className="cursor-pointer font-normal">
              Weekend Shift
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <RadioGroupItem value="custom" id="custom" />
            <Label htmlFor="custom" className="cursor-pointer font-normal">
              Custom Times
            </Label>
          </div>
        </div>
      </RadioGroup>

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
