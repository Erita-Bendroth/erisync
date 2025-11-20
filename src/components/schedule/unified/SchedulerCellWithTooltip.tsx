import React, { useState, useEffect } from 'react';
import { SchedulerCell } from './SchedulerCell';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getApplicableShiftTimes } from '@/lib/shiftTimeUtils';
import type { OnlineUser } from '@/hooks/useSchedulerPresence';
import { Database } from '@/integrations/supabase/types';

type ShiftType = Database['public']['Enums']['shift_type'];
type AvailabilityStatus = Database['public']['Enums']['availability_status'];
type ActivityType = Database['public']['Enums']['activity_type'];

interface SchedulerCellWithTooltipProps {
  userId: string;
  date: string;
  teamId?: string;
  regionCode?: string;
  shiftType: ShiftType | null;
  shiftTimeDefinitionId?: string | null;
  availabilityStatus: AvailabilityStatus;
  activityType?: ActivityType;
  isSelected: boolean;
  isHovered: boolean;
  isEditing: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onMouseDown: () => void;
  onMouseUp: () => void;
  editingBy?: OnlineUser[];
  enableQuickDialog?: boolean;
  canViewActivityDetails?: boolean;
  isPartnershipView?: boolean;
}

export const SchedulerCellWithTooltip: React.FC<SchedulerCellWithTooltipProps> = (props) => {
  const { shiftType, shiftTimeDefinitionId, date, teamId, regionCode } = props;
  const [shiftTimes, setShiftTimes] = useState<{ startTime: string; endTime: string; description: string } | null>(null);

  useEffect(() => {
    if (shiftType && teamId) {
      const dayOfWeek = new Date(date).getDay();
      getApplicableShiftTimes({
        teamId,
        regionCode,
        shiftType,
        dayOfWeek,
        date, // Pass date for holiday checking
        shiftTimeDefinitionId: shiftTimeDefinitionId || undefined,
      }).then(times => setShiftTimes(times));
    }
  }, [shiftType, shiftTimeDefinitionId, date, teamId, regionCode]);

  if (!shiftType || !shiftTimes) {
    return <SchedulerCell {...props} />;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <SchedulerCell {...props} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="font-medium">{shiftTimes.description}</div>
          <div className="text-muted-foreground">
            {shiftTimes.startTime} - {shiftTimes.endTime}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
