import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';
import type { OnlineUser } from '@/hooks/useSchedulerPresence';

type ShiftType = Database['public']['Enums']['shift_type'];
type AvailabilityStatus = Database['public']['Enums']['availability_status'];

interface SchedulerCellProps {
  userId: string;
  date: string;
  shiftType: ShiftType | null;
  availabilityStatus: AvailabilityStatus;
  isSelected: boolean;
  isHovered: boolean;
  isEditing: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onMouseDown: () => void;
  editingBy?: OnlineUser[];
}

const SHIFT_TYPE_LABELS: Record<string, string> = {
  early: 'E',
  late: 'L',
  normal: 'D',
  weekend: 'W',
};

const SHIFT_TYPE_COLORS: Record<string, string> = {
  early: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  late: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  normal: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  weekend: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

export const SchedulerCell: React.FC<SchedulerCellProps> = ({
  userId,
  date,
  shiftType,
  availabilityStatus,
  isSelected,
  isHovered,
  isEditing,
  onClick,
  onDoubleClick,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  editingBy = [],
}) => {
  const cellId = `${userId}:${date}`;
  const isBeingEdited = editingBy.length > 0;
  
  return (
    <div
      className={cn(
        'relative h-12 border-r border-b border-border cursor-pointer transition-colors',
        'flex items-center justify-center',
        isSelected && 'bg-accent',
        isHovered && !isSelected && 'bg-muted',
        isEditing && 'ring-2 ring-ring',
        availabilityStatus === 'unavailable' && 'bg-destructive/10',
        isBeingEdited && 'ring-2 ring-offset-1'
      )}
      style={
        isBeingEdited
          ? {
              // @ts-ignore - Custom property for ring color
              '--tw-ring-color': editingBy[0].color,
            }
          : undefined
      }
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      data-cell-id={cellId}
    >
      {shiftType && availabilityStatus === 'available' && (
        <Badge
          variant="secondary"
          className={cn(
            'text-xs font-semibold',
            SHIFT_TYPE_COLORS[shiftType] || 'bg-muted'
          )}
        >
          {SHIFT_TYPE_LABELS[shiftType] || shiftType.charAt(0).toUpperCase()}
        </Badge>
      )}
      {availabilityStatus === 'unavailable' && (
        <div className="w-2 h-2 rounded-full bg-destructive" />
      )}
      
      {/* Collaboration avatars - show who's editing */}
      {isBeingEdited && (
        <div className="absolute -top-1 -right-1 flex -space-x-1">
          {editingBy.slice(0, 2).map((user) => (
            <div
              key={user.user_id}
              className="w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
              style={{ backgroundColor: user.color }}
              title={`${user.first_name} ${user.last_name} is editing`}
            >
              {user.initials}
            </div>
          ))}
          {editingBy.length > 2 && (
            <div
              className="w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
              style={{ backgroundColor: 'hsl(var(--muted-foreground))' }}
              title={`+${editingBy.length - 2} more`}
            >
              +{editingBy.length - 2}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
