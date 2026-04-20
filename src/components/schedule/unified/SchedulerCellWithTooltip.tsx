import React, { useState, useEffect } from 'react';
import { SchedulerCell } from './SchedulerCell';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getApplicableShiftTimes } from '@/lib/shiftTimeUtils';
import { AlertTriangle } from 'lucide-react';
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
  countryCode?: string | null;
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
  canEdit?: boolean;
  hotlineAssignment?: {
    id: string;
    notes: string | null;
    responsibility_region: string | null;
  };
}

export const SchedulerCellWithTooltip: React.FC<SchedulerCellWithTooltipProps> = (props) => {
  const { shiftType, shiftTimeDefinitionId, date, teamId, regionCode, countryCode } = props;
  const [shiftTimes, setShiftTimes] = useState<{ startTime: string; endTime: string; description: string; id: string } | null>(null);
  const [drift, setDrift] = useState(false);

  useEffect(() => {
    if (shiftType && teamId) {
      const dayOfWeek = new Date(date).getDay();
      getApplicableShiftTimes({
        teamId,
        regionCode,
        countryCode: countryCode || undefined,
        shiftType,
        dayOfWeek,
        date,
        // Don't trust stored ID blindly — let resolver re-evaluate. shiftTimeUtils
        // now ignores stored IDs whose shift_type doesn't match the requested one.
        shiftTimeDefinitionId: shiftTimeDefinitionId || undefined,
      }).then(times => {
        setShiftTimes(times);
        if (shiftTimeDefinitionId && times.id && times.id !== shiftTimeDefinitionId && !times.id.startsWith('default-')) {
          setDrift(true);
        } else {
          setDrift(false);
        }
      });
    }
  }, [shiftType, shiftTimeDefinitionId, date, teamId, regionCode, countryCode]);

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
          {drift && (
            <div className="mt-1 flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              <span>Stored shift definition differs from resolved one</span>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
