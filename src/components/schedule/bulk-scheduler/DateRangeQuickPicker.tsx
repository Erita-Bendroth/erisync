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
  excludedDays: number[];
  skipHolidays: boolean;
  onDateRangeChange: (start: Date | null, end: Date | null) => void;
  onExcludedDaysChange: (days: number[]) => void;
  onSkipHolidaysChange: (skip: boolean) => void;
}

export const DateRangeQuickPicker = ({
  startDate,
  endDate,
  excludedDays,
  skipHolidays,
  onDateRangeChange,
  onExcludedDaysChange,
  onSkipHolidaysChange,
}: DateRangeQuickPickerProps) => {
  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    
    // Calculate actual work days by checking each day
    let workDays = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
      if (!excludedDays.includes(current.getDay())) {
        workDays++;
      }
      current.setDate(current.getDate() + 1);
    }
    return workDays;
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
        <Label className="text-sm font-medium">Days to Exclude</Label>
        
        <div className="space-y-2 pl-1">
          {/* Quick toggle for both weekend days */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="excludeBothWeekendDays"
              checked={excludedDays.includes(0) && excludedDays.includes(6)}
              onCheckedChange={(checked) => {
                if (checked) {
                  const newDays = [...new Set([...excludedDays, 0, 6])];
                  onExcludedDaysChange(newDays);
                } else {
                  const newDays = excludedDays.filter(d => d !== 0 && d !== 6);
                  onExcludedDaysChange(newDays);
                }
              }}
            />
            <label htmlFor="excludeBothWeekendDays" className="text-sm cursor-pointer font-medium">
              Skip Weekends (Sat & Sun)
            </label>
          </div>

          {/* Individual day checkboxes */}
          <div className="pl-6 space-y-2 border-l-2 border-border">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="excludeSaturday"
                checked={excludedDays.includes(6)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onExcludedDaysChange([...excludedDays, 6]);
                  } else {
                    onExcludedDaysChange(excludedDays.filter(d => d !== 6));
                  }
                }}
              />
              <label htmlFor="excludeSaturday" className="text-sm cursor-pointer">
                Saturdays
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="excludeSunday"
                checked={excludedDays.includes(0)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onExcludedDaysChange([...excludedDays, 0]);
                  } else {
                    onExcludedDaysChange(excludedDays.filter(d => d !== 0));
                  }
                }}
              />
              <label htmlFor="excludeSunday" className="text-sm cursor-pointer">
                Sundays
              </label>
            </div>
          </div>
        </div>

        {/* Holidays checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="skipHolidays"
            checked={skipHolidays}
            onCheckedChange={(checked) => onSkipHolidaysChange(checked === true)}
          />
          <label htmlFor="skipHolidays" className="text-sm cursor-pointer">
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
