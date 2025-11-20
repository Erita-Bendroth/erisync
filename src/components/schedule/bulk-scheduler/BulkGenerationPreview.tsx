import { format, isWeekend, eachDayOfInterval } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useShiftTypes } from "@/hooks/useShiftTypes";
import { cn } from "@/lib/utils";

interface BulkGenerationPreviewProps {
  totalShifts: number;
  workDays: number;
  userCount: number;
  startDate: Date | null;
  endDate: Date | null;
  shiftType: string | null;
  teamId: string | null;
  autoDetectWeekends: boolean;
  autoDetectHolidays: boolean;
}

export const BulkGenerationPreview = ({
  totalShifts,
  workDays,
  userCount,
  startDate,
  endDate,
  shiftType,
  teamId,
  autoDetectWeekends,
  autoDetectHolidays,
}: BulkGenerationPreviewProps) => {
  const { shiftTypes } = useShiftTypes(teamId ? [teamId] : []);
  const selectedShift = shiftTypes.find(s => s.type === shiftType);
  
  if (!startDate || !endDate || !shiftType) {
    return (
      <Card className="p-4 bg-muted/30">
        <div className="text-sm text-muted-foreground">
          Configure the settings above to see a preview
        </div>
      </Card>
    );
  }

  // Calculate weekend count
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekendCount = days.filter(d => isWeekend(d)).length;

  return (
    <Card className="p-4 space-y-3">
      <div className="font-semibold">Preview</div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Period:</span>
          <span className="font-medium">
            {format(startDate, "MMM dd")} - {format(endDate, "MMM dd, yyyy")}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Working days:</span>
          <span className="font-medium">{workDays} days</span>
        </div>
        
        {autoDetectWeekends && weekendCount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Weekend days:</span>
            <span className="font-medium flex items-center gap-1">
              {weekendCount} days
              <Badge variant="secondary" className="text-[10px]">Auto-detect ON</Badge>
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-muted-foreground">Team members:</span>
          <span className="font-medium">{userCount} people</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Shift type:</span>
          {selectedShift ? (
            <div className="flex flex-col items-end">
              <span className="font-medium">{selectedShift.label}</span>
              {selectedShift.startTime && selectedShift.endTime && (
                <span className="text-xs text-muted-foreground">
                  {selectedShift.startTime}-{selectedShift.endTime}
                </span>
              )}
            </div>
          ) : (
            <span className="font-medium capitalize">{shiftType}</span>
          )}
        </div>

        <div className="pt-2 mt-2 border-t flex justify-between">
          <span className="font-semibold">Total shifts:</span>
          <span className="font-bold text-primary">{totalShifts}</span>
        </div>
      </div>

      {totalShifts > 0 && (
        <div className="pt-3 mt-3 border-t space-y-2">
          <div className="text-xs text-muted-foreground">
            ✨ Ready to generate {totalShifts} schedule entries
          </div>
          
          {(autoDetectWeekends || autoDetectHolidays) && (
            <div className="flex flex-wrap gap-1 pt-2">
              {autoDetectWeekends && (
                <Badge variant="outline" className="text-[10px]">
                  📅 Weekend detection enabled
                </Badge>
              )}
              {autoDetectHolidays && (
                <Badge variant="outline" className="text-[10px]">
                  🎉 Holiday detection enabled
                </Badge>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
