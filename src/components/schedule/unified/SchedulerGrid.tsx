import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { SchedulerCellWithTooltip } from './SchedulerCellWithTooltip';
import { InlineEditPopover } from './InlineEditPopover';
import { QuickScheduleDialog } from './QuickScheduleDialog';
import { CoverageRow } from './CoverageRow';
import { ScheduleEntry } from '@/hooks/useSchedulerState';
import type { OnlineUser } from '@/hooks/useSchedulerPresence';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';

type ShiftType = Database['public']['Enums']['shift_type'];
type ActivityType = Database['public']['Enums']['activity_type'];
type AvailabilityStatus = Database['public']['Enums']['availability_status'];

interface TeamMember {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
}

interface SchedulerGridProps {
  teamMembers: TeamMember[];
  dates: string[];
  scheduleEntries: ScheduleEntry[];
  selectedUsers: Set<string>;
  selectedCells: Set<string>;
  hoveredCell: string | null;
  editingCell: string | null;
  onUserToggle: (userId: string) => void;
  onCellClick: (cellId: string) => void;
  onCellDoubleClick: (cellId: string) => void;
  onCellHover: (cellId: string | null) => void;
  onCellDragStart: (cellId: string) => void;
  onCellDragEnd: () => void;
  onUpdateEntry: (entry: ScheduleEntry) => void;
  teamId: string;
  currentUserId: string;
  cellsBeingEdited: Record<string, OnlineUser[]>;
}

export const SchedulerGrid: React.FC<SchedulerGridProps> = ({
  teamMembers,
  dates,
  scheduleEntries,
  selectedUsers,
  selectedCells,
  hoveredCell,
  editingCell,
  onUserToggle,
  onCellClick,
  onCellDoubleClick,
  onCellHover,
  onCellDragStart,
  onCellDragEnd,
  onUpdateEntry,
  teamId,
  currentUserId,
  cellsBeingEdited,
}) => {
  const { toast } = useToast();
  
  // Determine if we should use quick dialog (for long date ranges)
  const isLongRange = dates.length > 14; // More than 2 weeks
  
  const [editPopoverOpen, setEditPopoverOpen] = useState(false);
  const [editingCellData, setEditingCellData] = useState<{
    userId: string;
    userName: string;
    date: string;
  } | null>(null);
  
  // Quick dialog state for long ranges
  const [quickDialogOpen, setQuickDialogOpen] = useState(false);
  const [quickDialogData, setQuickDialogData] = useState<{
    userId: string;
    userName: string;
    userInitials: string;
    date: string;
  } | null>(null);
  
  // Drag detection state for smart click vs drag differentiation
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartCell, setDragStartCell] = useState<string | null>(null);

  const getEntry = (userId: string, date: string) => {
    return scheduleEntries.find(e => e.user_id === userId && e.date === date);
  };

  const handleCellClick = (userId: string, date: string) => {
    const cellId = `${userId}:${date}`;
    
    if (isLongRange) {
      // Only open dialog if this was a true click (not after dragging)
      if (!isDragging) {
        const member = teamMembers.find(m => m.user_id === userId);
        if (member) {
          setQuickDialogData({
            userId,
            userName: `${member.first_name} ${member.last_name}`,
            userInitials: member.initials || `${member.first_name.charAt(0)}${member.last_name.charAt(0)}`,
            date,
          });
          setQuickDialogOpen(true);
        }
      }
      // Reset dragging state
      setIsDragging(false);
      setDragStartCell(null);
    } else {
      // Short range: Use existing selection logic
      onCellClick(cellId);
    }
  };

  const handleCellDoubleClick = (userId: string, date: string) => {
    if (isLongRange) {
      // In long range mode, double-click does same as single click
      handleCellClick(userId, date);
      return;
    }
    
    // Short range: Open popover
    const member = teamMembers.find(m => m.user_id === userId);
    if (member) {
      setEditingCellData({
        userId,
        userName: `${member.first_name} ${member.last_name}`,
        date,
      });
      setEditPopoverOpen(true);
    }
    onCellDoubleClick(`${userId}:${date}`);
  };

  const handleCellMouseDown = (cellId: string) => {
    setDragStartCell(cellId);
    setIsDragging(false);
    // Always trigger drag start for both modes
    onCellDragStart(cellId);
  };

  const handleCellMouseMove = (cellId: string) => {
    if (dragStartCell) {
      if (dragStartCell !== cellId) {
        setIsDragging(true);
      }
      // Always call hover handler to build selection
      onCellHover(cellId);
    }
  };

  const handleCellMouseUp = () => {
    if (isDragging) {
      // User was dragging - trigger drag end for both modes
      onCellDragEnd();
    }
    // Reset drag state
    setDragStartCell(null);
    // Note: handleCellClick will be called after this, and it checks isDragging
  };

  const handleSaveEdit = async (data: {
    shift_type: ShiftType | null;
    activity_type: ActivityType;
    availability_status: AvailabilityStatus;
    notes?: string;
  }) => {
    if (!editingCellData) return;

    try {
      const entry: ScheduleEntry = {
        user_id: editingCellData.userId,
        team_id: teamId,
        date: editingCellData.date,
        ...data,
      };

      // Save to database
      const { error } = await supabase
        .from('schedule_entries')
        .upsert({
          ...entry,
          created_by: currentUserId,
        }, {
          onConflict: 'user_id,date,team_id',
        });

      if (error) throw error;

      onUpdateEntry(entry);

      toast({
        title: "Schedule updated",
        description: "Changes saved successfully",
      });
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
    }
  };

  const scheduledCounts = dates.reduce((acc, date) => {
    acc[date] = scheduleEntries.filter(e => 
      e.date === date && e.availability_status === 'available'
    ).length;
    return acc;
  }, {} as Record<string, number>);

  const cellWidth = isLongRange ? '60px' : 'minmax(60px, 1fr)';

  return (
    <div className="border border-border rounded-lg overflow-x-auto overflow-y-hidden">
      {/* Header */}
      <div className="grid grid-cols-[200px_1fr] bg-muted">
        <div className="flex items-center px-4 py-3 font-semibold border-r border-b border-border">
          Team Member
        </div>
        <div className="grid gap-0 border-b border-border" style={{ gridTemplateColumns: `repeat(${dates.length}, ${cellWidth})` }}>
          {dates.map((date) => {
            const dateObj = new Date(date);
            return (
              <div key={date} className="flex flex-col items-center justify-center px-2 py-2 border-r border-border">
                <div className="text-xs font-semibold">
                  {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Team Member Rows */}
      {teamMembers.map((member) => (
        <div key={member.user_id} className="grid grid-cols-[200px_1fr] hover:bg-muted/50">
          <div className="flex items-center px-4 py-2 border-r border-b border-border">
            <Checkbox
              checked={selectedUsers.has(member.user_id)}
              onCheckedChange={() => onUserToggle(member.user_id)}
              className="mr-2"
            />
            <div>
              <div className="font-medium text-sm">
                {member.initials || `${member.first_name.charAt(0)}${member.last_name.charAt(0)}`}
              </div>
              <div className="text-xs text-muted-foreground">
                {member.first_name} {member.last_name}
              </div>
            </div>
          </div>
          <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${dates.length}, ${cellWidth})` }}>
            {dates.map((date) => {
              const entry = getEntry(member.user_id, date);
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
                  onClick={() => handleCellClick(member.user_id, date)}
                  onDoubleClick={() => handleCellDoubleClick(member.user_id, date)}
                  onMouseEnter={() => handleCellMouseMove(cellId)}
                  onMouseLeave={() => onCellHover(null)}
                  onMouseDown={() => handleCellMouseDown(cellId)}
                  onMouseUp={() => handleCellMouseUp()}
                  editingBy={cellsBeingEdited[cellId] || []}
                  enableQuickDialog={isLongRange}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* Coverage Row */}
      <CoverageRow
        dates={dates}
        teamSize={teamMembers.length}
        scheduledCounts={scheduledCounts}
      />

      {/* Edit Popover (for short ranges) */}
      {!isLongRange && editingCellData && (
        <InlineEditPopover
          open={editPopoverOpen}
          onOpenChange={setEditPopoverOpen}
          userId={editingCellData.userId}
          userName={editingCellData.userName}
          date={editingCellData.date}
          currentShiftType={getEntry(editingCellData.userId, editingCellData.date)?.shift_type || null}
          currentActivityType={getEntry(editingCellData.userId, editingCellData.date)?.activity_type || 'work'}
          currentAvailabilityStatus={getEntry(editingCellData.userId, editingCellData.date)?.availability_status || 'available'}
          currentNotes={getEntry(editingCellData.userId, editingCellData.date)?.notes}
          onSave={handleSaveEdit}
        >
          <div />
        </InlineEditPopover>
      )}
      
      {/* Quick Dialog (for long ranges) */}
      {isLongRange && quickDialogData && (
        <QuickScheduleDialog
          open={quickDialogOpen}
          onOpenChange={setQuickDialogOpen}
          userId={quickDialogData.userId}
          userName={quickDialogData.userName}
          userInitials={quickDialogData.userInitials}
          date={quickDialogData.date}
          teamId={teamId}
          teamName="Team"
          currentEntry={getEntry(quickDialogData.userId, quickDialogData.date)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
};
