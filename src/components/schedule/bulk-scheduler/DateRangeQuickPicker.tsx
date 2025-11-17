import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface DateRangeQuickPickerProps {
  startDate: Date | null;
  endDate: Date | null;
  skipWeekends: boolean;
  skipHolidays: boolean;
  onDateRangeChange: (start: Date | null, end: Date | null) => void;
  onSkipWeekendsChange: (skip: boolean) => void;
  onSkipHolidaysChange: (skip: boolean) => void;
}

export const DateRangeQuickPicker = ({
  startDate,
  endDate,
  skipWeekends,
  skipHolidays,
  onDateRangeChange,
  onSkipWeekendsChange,
  onSkipHolidaysChange,
}: DateRangeQuickPickerProps) => {
  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (skipWeekends) {
      return Math.ceil(days * (5 / 7));
    }
    return days;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Date Range</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !startDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate && endDate ? (
                <>
                  {format(startDate, "MMM dd")} - {format(endDate, "MMM dd, yyyy")}
                </>
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{
                from: startDate || undefined,
                to: endDate || undefined,
              }}
              onSelect={(range) => {
                onDateRangeChange(range?.from || null, range?.to || null);
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="skipWeekends"
            checked={skipWeekends}
            onCheckedChange={(checked) => onSkipWeekendsChange(checked === true)}
          />
          <label
            htmlFor="skipWeekends"
            className="text-sm cursor-pointer"
          >
            Skip Weekends
          </label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="skipHolidays"
            checked={skipHolidays}
            onCheckedChange={(checked) => onSkipHolidaysChange(checked === true)}
          />
          <label
            htmlFor="skipHolidays"
            className="text-sm cursor-pointer"
          >
            Skip Holidays
          </label>
        </div>
      </div>

      {startDate && endDate && (
        <div className="text-sm bg-muted/30 p-3 rounded-md">
          📊 {calculateDays()} working days selected
        </div>
      )}
    </div>
  );
};
