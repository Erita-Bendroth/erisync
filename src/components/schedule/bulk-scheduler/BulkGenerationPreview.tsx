import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BulkGenerationPreviewProps {
  totalShifts: number;
  workDays: number;
  userCount: number;
  startDate: Date | null;
  endDate: Date | null;
  shiftType: string | null;
}

export const BulkGenerationPreview = ({
  totalShifts,
  workDays,
  userCount,
  startDate,
  endDate,
  shiftType,
}: BulkGenerationPreviewProps) => {
  if (!startDate || !endDate || !shiftType) {
    return (
      <Card className="p-4 bg-muted/30">
        <div className="text-sm text-muted-foreground">
          Configure the settings above to see a preview
        </div>
      </Card>
    );
  }

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

        <div className="flex justify-between">
          <span className="text-muted-foreground">Team members:</span>
          <span className="font-medium">{userCount} people</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Shift type:</span>
          <span className="font-medium capitalize">{shiftType}</span>
        </div>

        <div className="pt-2 mt-2 border-t flex justify-between">
          <span className="font-semibold">Total shifts:</span>
          <span className="font-bold text-primary">{totalShifts}</span>
        </div>
      </div>

      {totalShifts > 0 && (
        <div className="pt-3 mt-3 border-t">
          <div className="text-xs text-muted-foreground">
            ✨ Ready to generate {totalShifts} schedule entries
          </div>
        </div>
      )}
    </Card>
  );
};
