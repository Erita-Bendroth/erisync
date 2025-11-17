import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ShiftTypeOption } from '@/hooks/useShiftTypes';
import { ScheduleEntry } from '@/hooks/useSchedulerState';
import { ShiftDistributionPopover } from './ShiftDistributionPopover';

interface TeamMember {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
}

interface TeamSectionData {
  teamId: string;
  teamName: string;
  members: TeamMember[];
  color: string;
}

interface ShiftTypeCounterRowProps {
  dates: string[];
  scheduleEntries: ScheduleEntry[];
  shiftTypes: ShiftTypeOption[];
  teamSections?: TeamSectionData[];
}

export const ShiftTypeCounterRow: React.FC<ShiftTypeCounterRowProps> = ({
  dates,
  scheduleEntries,
  shiftTypes,
  teamSections,
}) => {
  // Memoize visible team IDs to prevent unnecessary recalculations
  const visibleTeamIds = React.useMemo(() => 
    teamSections?.map(t => t.teamId) || [],
    [teamSections]
  );

  // Memoize the counting function
  const countShiftTypes = React.useCallback((date: string): Record<string, number> => {
    const counts: Record<string, number> = {};
    const uniqueKeys = new Set<string>();
    
    // Filter and deduplicate by user_id + date + shift_type
    const filtered = scheduleEntries.filter((e) => 
      e.date === date && 
      e.shift_type && 
      e.activity_type === 'work' &&
      // Only count entries for visible teams
      (visibleTeamIds.length === 0 || visibleTeamIds.includes(e.team_id))
    );

    filtered.forEach((e) => {
      const key = `${e.user_id}-${e.date}-${e.shift_type}`;
      if (!uniqueKeys.has(key)) {
        uniqueKeys.add(key);
        counts[e.shift_type!] = (counts[e.shift_type!] || 0) + 1;
      }
    });
    
    return counts;
  }, [scheduleEntries, visibleTeamIds]);

  // Memoize shift counts for all dates
  const shiftCounts = React.useMemo(() => {
    return dates.reduce((acc, date) => {
      acc[date] = countShiftTypes(date);
      return acc;
    }, {} as Record<string, Record<string, number>>);
  }, [dates, countShiftTypes]);

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
    switch (shiftType) {
      case 'early':
        return 'E';
      case 'late':
        return 'L';
      case 'normal':
        return 'N';
      case 'weekend':
        return 'W';
      default:
        const shift = shiftTypes.find((s) => s.type === shiftType);
        return shift ? shift.label.charAt(0).toUpperCase() : shiftType.charAt(0).toUpperCase();
    }
  };

  return (
    <div className="grid grid-cols-[200px_auto] border-t border-border bg-blue-50/30 dark:bg-blue-950/20">
      <div className="px-4 py-3 font-semibold text-sm border-r border-border flex items-center">
        Shift Distribution
      </div>
      <div
        className="grid gap-0"
        style={{ gridTemplateColumns: `repeat(${dates.length}, ${dates.length > 14 ? '80px' : 'minmax(80px, 1fr)'})` }}
      >
        {dates.map((date) => {
          const counts = shiftCounts[date];
          const hasShifts = Object.keys(counts).length > 0;

          return (
            <ShiftDistributionPopover
              key={date}
              date={date}
              scheduleEntries={scheduleEntries}
              shiftTypes={shiftTypes}
              teamSections={teamSections}
              showTeamBreakdown={!!teamSections}
            >
              <div className="px-1 py-2 border-r border-border min-h-[3rem] hover:bg-muted/50 cursor-pointer transition-colors">
                {hasShifts ? (
                  <div className="flex flex-wrap gap-1 justify-center items-center">
                    {shiftTypes.map((shift) =>
                      counts[shift.type] > 0 ? (
                        <Badge
                          key={`${date}-${shift.id}`}
                          variant="outline"
                          className={`text-xs px-1.5 py-0 h-5 ${getShiftColor(shift.type)}`}
                        >
                          {getShiftLabel(shift.type)}:{counts[shift.type]}
                        </Badge>
                      ) : null
                    )}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground text-xs">-</div>
                )}
              </div>
            </ShiftDistributionPopover>
          );
        })}
      </div>
    </div>
  );
};
