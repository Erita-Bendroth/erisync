import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { TeamSection } from './TeamSection';
import { ShiftTypeCounterRow } from './ShiftTypeCounterRow';
import { CoverageRow } from './CoverageRow';
import { SchedulerState, ScheduleEntry } from '@/hooks/useSchedulerState';
import { ShiftTypeOption } from '@/hooks/useShiftTypes';

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

interface WeeklyGridViewProps {
  teamSections: TeamSectionData[];
  dates: string[];
  scheduleEntries: ScheduleEntry[];
  state: SchedulerState;
  cellsBeingEdited: Record<string, any[]>;
  handlers: {
    toggleUserSelection: (userId: string) => void;
    toggleCellSelection: (cellId: string) => void;
    setEditingCell: (cellId: string | null) => void;
    setHoveredCell: (cellId: string | null) => void;
    startDrag: (cellId: string) => void;
    endDrag: () => void;
  };
  showHolidays: boolean;
  shiftTypes: ShiftTypeOption[];
  partnershipMode?: boolean;
  partnershipConfig?: {
    min_staff_required: number;
    max_staff_allowed?: number | null;
  };
}

const groupIntoWeeks = (dates: string[]): string[][] => {
  const weeks: string[][] = [];
  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7));
  }
  return weeks;
};

export const WeeklyGridView: React.FC<WeeklyGridViewProps> = ({
  teamSections,
  dates,
  scheduleEntries,
  state,
  cellsBeingEdited,
  handlers,
  showHolidays,
  shiftTypes,
  partnershipMode,
  partnershipConfig,
}) => {
  const weeks = groupIntoWeeks(dates);

  // Calculate coverage metrics for each week
  const getWeekMetrics = (weekDates: string[]) => {
    const scheduledCounts = weekDates.reduce((acc, date) => {
      acc[date] = scheduleEntries.filter(
        e => e.date === date && e.availability_status === 'available'
      ).length;
      return acc;
    }, {} as Record<string, number>);

    const teamBreakdowns = weekDates.reduce((acc, date) => {
      acc[date] = teamSections.map(section => ({
        teamName: section.teamName,
        count: scheduleEntries.filter(
          e => e.date === date && 
          e.availability_status === 'available' &&
          section.members.some(m => m.user_id === e.user_id)
        ).length,
        total: section.members.length,
        color: section.color,
      }));
      return acc;
    }, {} as Record<string, any[]>);

    const totalMembers = teamSections.reduce((sum, section) => sum + section.members.length, 0);

    return { scheduledCounts, teamBreakdowns, totalMembers };
  };

  return (
    <div className="space-y-6 p-4">
      {weeks.map((weekDates, weekIndex) => {
        const weekStart = format(new Date(weekDates[0]), 'MMM d');
        const weekEnd = format(new Date(weekDates[weekDates.length - 1]), 'MMM d, yyyy');
        const { scheduledCounts, teamBreakdowns, totalMembers } = getWeekMetrics(weekDates);
        
        return (
          <div key={weekIndex} className="border rounded-lg overflow-hidden bg-card">
            {/* Week Header */}
            <div className="bg-muted px-4 py-3 border-b">
              <h3 className="font-semibold text-foreground">
                Week {weekIndex + 1}: {weekStart} - {weekEnd}
              </h3>
            </div>

            {/* Date Headers */}
            <div className="grid grid-cols-[200px_1fr] border-b border-border bg-muted/30 sticky top-0 z-10">
              <div className="px-4 py-2 border-r border-border">
                <div className="font-semibold text-sm text-foreground">Team Members</div>
              </div>
              <div 
                className="grid gap-0"
                style={{ gridTemplateColumns: `repeat(${weekDates.length}, minmax(80px, 1fr))` }}
              >
                {weekDates.map((date) => {
                  const dateObj = new Date(date);
                  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                  
                  return (
                    <div
                      key={date}
                      className={`px-2 py-2 text-center border-r border-border ${
                        isWeekend ? 'bg-muted/50' : ''
                      }`}
                    >
                      <div className="text-xs font-medium text-muted-foreground">
                        {format(dateObj, 'EEE')}
                      </div>
                      <div className="text-sm font-semibold text-foreground">
                        {format(dateObj, 'd')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Shift Counter */}
            <ShiftTypeCounterRow
              dates={weekDates}
              scheduleEntries={scheduleEntries.filter(e => weekDates.includes(e.date))}
              shiftTypes={shiftTypes}
              teamSections={teamSections}
            />

            {/* Team Sections */}
            {teamSections.map((section) => (
              <TeamSection
                key={section.teamId}
                teamId={section.teamId}
                teamName={section.teamName}
                teamColor={section.color}
                members={section.members}
                dates={weekDates}
                scheduleEntries={scheduleEntries.filter(e => weekDates.includes(e.date))}
                selectedUsers={state.selectedUsers}
                selectedCells={state.selectedCells}
                hoveredCell={state.hoveredCell}
                editingCell={state.editingCell}
                cellsBeingEdited={cellsBeingEdited}
                onUserToggle={handlers.toggleUserSelection}
                onCellClick={handlers.toggleCellSelection}
                onCellDoubleClick={handlers.setEditingCell}
                onCellHover={handlers.setHoveredCell}
                onCellDragStart={handlers.startDrag}
                onCellDragEnd={handlers.endDrag}
                onSelectAllTeam={() => {}}
                showHolidays={showHolidays}
              />
            ))}

            {/* Coverage Row */}
            <CoverageRow
              dates={weekDates}
              teamSize={totalMembers}
              scheduledCounts={scheduledCounts}
              teamBreakdowns={teamBreakdowns}
              partnershipMode={partnershipMode}
              partnershipConfig={partnershipConfig}
            />
          </div>
        );
      })}
    </div>
  );
};
