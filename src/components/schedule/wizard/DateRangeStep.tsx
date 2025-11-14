import React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { WizardData } from "./BulkScheduleWizard";
import { format, addDays, addWeeks, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

interface DateRangeStepProps {
  wizardData: WizardData;
  updateWizardData: (updates: Partial<WizardData>) => void;
}

export const DateRangeStep = ({ wizardData, updateWizardData }: DateRangeStepProps) => {
  const quickRanges = [
    {
      label: "This Week",
      getDates: () => ({
        start: startOfWeek(new Date(), { weekStartsOn: 1 }),
        end: endOfWeek(new Date(), { weekStartsOn: 1 })
      })
    },
    {
      label: "Next Week",
      getDates: () => {
        const nextWeek = addWeeks(new Date(), 1);
        return {
          start: startOfWeek(nextWeek, { weekStartsOn: 1 }),
          end: endOfWeek(nextWeek, { weekStartsOn: 1 })
        };
      }
    },
    {
      label: "Next 2 Weeks",
      getDates: () => ({
        start: new Date(),
        end: addWeeks(new Date(), 2)
      })
    },
    {
      label: "This Month",
      getDates: () => ({
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date())
      })
    },
    {
      label: "Next Month",
      getDates: () => {
        const nextMonth = addMonths(new Date(), 1);
        return {
          start: startOfMonth(nextMonth),
          end: endOfMonth(nextMonth)
        };
      }
    },
  ];

  const handleQuickRange = (range: typeof quickRanges[0]) => {
    const { start, end } = range.getDates();
    updateWizardData({ startDate: start, endDate: end });
  };

  const getWorkingDaysCount = () => {
    if (!wizardData.startDate || !wizardData.endDate) return 0;
    
    let count = 0;
    let current = new Date(wizardData.startDate);
    const end = new Date(wizardData.endDate);
    
    while (current <= end) {
      const day = current.getDay();
      const isWeekend = day === 0 || day === 6;
      
      if (!wizardData.skipWeekends || !isWeekend) {
        count++;
      }
      
      current = addDays(current, 1);
    }
    
    return count;
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">When should these shifts occur?</h2>
        <p className="text-muted-foreground">Select the date range for your schedule</p>
      </div>

      {/* Quick Select Buttons */}
      <div className="flex flex-wrap gap-2 justify-center">
        {quickRanges.map((range) => (
          <Button
            key={range.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleQuickRange(range)}
          >
            {range.label}
          </Button>
        ))}
      </div>

      {/* Date Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-base font-medium">Start Date</Label>
          <div className="border rounded-lg p-4">
            <Calendar
              mode="single"
              selected={wizardData.startDate}
              onSelect={(date) => updateWizardData({ startDate: date })}
              className={cn("pointer-events-auto")}
              disabled={(date) => {
                if (wizardData.endDate) {
                  return date > wizardData.endDate;
                }
                return false;
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-base font-medium">End Date</Label>
          <div className="border rounded-lg p-4">
            <Calendar
              mode="single"
              selected={wizardData.endDate}
              onSelect={(date) => updateWizardData({ endDate: date })}
              className={cn("pointer-events-auto")}
              disabled={(date) => {
                if (wizardData.startDate) {
                  return date < wizardData.startDate;
                }
                return false;
              }}
            />
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          <Checkbox
            id="skip-weekends"
            checked={wizardData.skipWeekends}
            onCheckedChange={(checked) => 
              updateWizardData({ skipWeekends: checked as boolean })
            }
          />
          <Label htmlFor="skip-weekends" className="cursor-pointer">
            Skip weekends (Saturday & Sunday)
          </Label>
        </div>

        <div className="flex items-center space-x-3">
          <Checkbox
            id="skip-holidays"
            checked={wizardData.skipHolidays}
            onCheckedChange={(checked) => 
              updateWizardData({ skipHolidays: checked as boolean })
            }
          />
          <Label htmlFor="skip-holidays" className="cursor-pointer">
            Skip public holidays
          </Label>
        </div>
      </div>

      {/* Summary */}
      {wizardData.startDate && wizardData.endDate && (
        <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
          <div className="text-center space-y-1">
            <p className="font-medium">
              Selected: {format(wizardData.startDate, "MMM d")} - {format(wizardData.endDate, "MMM d, yyyy")}
            </p>
            <p className="text-sm text-muted-foreground">
              {getWorkingDaysCount()} {wizardData.skipWeekends ? "working " : ""}days
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
