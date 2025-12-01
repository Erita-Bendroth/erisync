import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SchedulerCellWithTooltip } from './SchedulerCellWithTooltip';
import { cn } from '@/lib/utils';
import type { OnlineUser } from '@/hooks/useSchedulerPresence';
import { ScheduleEntry } from '@/hooks/useSchedulerState';

interface TeamMember {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
}

interface TeamSectionProps {
  teamId: string;
  teamName: string;
  teamColor: string;
  members: TeamMember[];
  dates: string[];
  scheduleEntries: ScheduleEntry[];
  dutyAssignments: any[];
  selectedUsers: Set<string>;
  selectedCells: Set<string>;
  hoveredCell: string | null;
  editingCell: string | null;
  cellsBeingEdited: Record<string, OnlineUser[]>;
  onUserToggle: (userId: string) => void;
  onCellClick: (cellId: string) => void;
  onCellDoubleClick: (cellId: string) => void;
  onCellHover: (cellId: string | null) => void;
  onCellDragStart: (cellId: string) => void;
  onCellDragEnd: () => void;
  onSelectAllTeam: () => void;
  showHolidays?: boolean;
  isPartnershipView?: boolean;
  canViewActivityDetails?: boolean;
}

export const TeamSection: React.FC<TeamSectionProps> = ({
  teamId,
  teamName,
  teamColor,
  members,
  dates,
  scheduleEntries,
  dutyAssignments,
  selectedUsers,
  selectedCells,
  hoveredCell,
  editingCell,
  cellsBeingEdited,
  onUserToggle,
  onCellClick,
  onCellDoubleClick,
  onCellHover,
  onCellDragStart,
  onCellDragEnd,
  onSelectAllTeam,
  showHolidays = true,
  isPartnershipView = false,
  canViewActivityDetails = true,
}) => {
  const [expanded, setExpanded] = useState(true);

  const getEntry = (userId: string, date: string) => {
    return scheduleEntries.find(e => e.user_id === userId && e.date === date);
  };

  const getHotlineAssignment = (userId: string, date: string) => {
    return dutyAssignments.find(d => d.user_id === userId && d.date === date);
  };

  return (
    <div className="border-t-2 border-primary/20">
      {/* Team Header */}
      <div 
        className="flex items-center gap-2 p-3 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight className={cn(
          "h-4 w-4 transition-transform",
          expanded && "rotate-90"
        )} />
        <div 
          className="w-3 h-3 rounded-full" 
          style={{ backgroundColor: teamColor }} 
        />
        <span className="font-semibold">{teamName}</span>
        <Badge variant="secondary" className="ml-2">
          {members.length} members
        </Badge>
        <Button 
          size="sm" 
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onSelectAllTeam();
          }}
          className="ml-auto"
        >
          Select All
        </Button>
      </div>

      {/* Team Members Grid */}
      {expanded && (
        <div>
          {members.map((member) => (
            <div
              key={member.user_id}
              className="grid grid-cols-[200px_auto] border-b border-border hover:bg-muted/20 transition-colors"
            >
              {/* Member Info */}
              <div className="flex items-center gap-2 px-4 py-2 border-r border-border">
                <Checkbox
                  checked={selectedUsers.has(member.user_id)}
                  onCheckedChange={() => onUserToggle(member.user_id)}
                />
                <div 
                  className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold"
                  title={`${member.first_name} ${member.last_name}`}
                >
                  {member.initials}
                </div>
              </div>

              {/* Schedule Cells */}
              <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${dates.length}, ${dates.length > 14 ? '60px' : 'minmax(60px, 1fr)'})` }}>
                {dates.map((date) => {
                  const entry = getEntry(member.user_id, date);
                  const hotlineAssignment = getHotlineAssignment(member.user_id, date);
                  const cellId = `${member.user_id}:${date}`;
                  
                  return (
                    <SchedulerCellWithTooltip
                      key={cellId}
                      userId={member.user_id}
                      date={date}
                      teamId={teamId}
                      shiftType={entry?.shift_type || null}
                      shiftTimeDefinitionId={entry?.shift_time_definition_id || null}
                      availabilityStatus={entry?.availability_status || 'available'}
                      activityType={entry?.activity_type}
                      isSelected={selectedCells.has(cellId)}
                      isHovered={hoveredCell === cellId}
                      isEditing={editingCell === cellId}
                      onClick={() => onCellClick(cellId)}
                      onDoubleClick={() => onCellDoubleClick(cellId)}
                      onMouseEnter={() => onCellHover(cellId)}
                      onMouseLeave={() => onCellHover(null)}
                      onMouseDown={() => onCellDragStart(cellId)}
                      onMouseUp={() => onCellDragEnd()}
                      editingBy={cellsBeingEdited[cellId] || []}
                      isPartnershipView={isPartnershipView}
                      canViewActivityDetails={canViewActivityDetails}
                      hotlineAssignment={hotlineAssignment}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
