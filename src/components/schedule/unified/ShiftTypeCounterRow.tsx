import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ShiftTypeOption } from '@/hooks/useShiftTypes';
import { ScheduleEntry } from '@/hooks/useSchedulerState';

interface ShiftTypeCounterRowProps {
  dates: string[];
  scheduleEntries: ScheduleEntry[];
  shiftTypes: ShiftTypeOption[];
}

export const ShiftTypeCounterRow: React.FC<ShiftTypeCounterRowProps> = ({
  dates,
  scheduleEntries,
  shiftTypes,
}) => {
  const countShiftTypes = (date: string): Record<string, number> => {
    const counts: Record<string, number> = {};
    const uniqueEntries = new Map<string, ScheduleEntry>();
    
    // Deduplicate entries by ID to prevent duplicate counting
    scheduleEntries
      .filter((e) => e.date === date && e.shift_type && e.activity_type === 'work')
      .forEach((e) => {
        if (!uniqueEntries.has(e.id)) {
          uniqueEntries.set(e.id, e);
        }
      });
    
    // Count unique entries
    uniqueEntries.forEach((entry) => {
      counts[entry.shift_type!] = (counts[entry.shift_type!] || 0) + 1;
    });
    
    return counts;
  };

  const getShiftColor = (shiftType: string): string => {
    switch (shiftType) {
      case 'early':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'late':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'normal':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'weekend':
        return 'bg-green-100 text-green-700 border-green-300';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getShiftLabel = (shiftType: string): string => {
    const shift = shiftTypes.find((s) => s.type === shiftType);
    return shift ? shift.label.split(' ')[0] : shiftType;
  };

  return (
    <div className="grid grid-cols-[200px_1fr] border-t border-border bg-blue-50/30 dark:bg-blue-950/20">
      <div className="px-4 py-3 font-semibold text-sm border-r border-border flex items-center">
        Shift Distribution
      </div>
      <div
        className="grid gap-0"
        style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(80px, 1fr))` }}
      >
        {dates.map((date) => {
          const counts = countShiftTypes(date);
          const hasShifts = Object.keys(counts).length > 0;

          return (
            <div
              key={date}
              className="px-2 py-2 border-r border-border flex flex-wrap gap-1 justify-center items-center min-h-[48px]"
            >
              {hasShifts ? (
                shiftTypes.map((shift) =>
                  counts[shift.type] > 0 ? (
                    <Badge
                      key={shift.type}
                      variant="outline"
                      className={`text-xs px-1.5 py-0.5 ${getShiftColor(shift.type)}`}
                    >
                      {getShiftLabel(shift.type)}: {counts[shift.type]}
                    </Badge>
                  ) : null
                )
              ) : (
                <span className="text-xs text-muted-foreground">-</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
