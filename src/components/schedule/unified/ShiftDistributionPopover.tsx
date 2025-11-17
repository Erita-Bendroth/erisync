import React, { useMemo } from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ScheduleEntry } from '@/hooks/useSchedulerState';
import { ShiftTypeOption } from '@/hooks/useShiftTypes';
import { CalendarDays, Users } from 'lucide-react';

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

interface ShiftDistributionPopoverProps {
  date: string;
  scheduleEntries: ScheduleEntry[];
  shiftTypes: ShiftTypeOption[];
  teamSections?: TeamSectionData[];
  children: React.ReactNode;
  showTeamBreakdown?: boolean;
}

interface ShiftDetail {
  shiftType: string;
  count: number;
  users: Array<{ userId: string; name: string; initials: string; teamName?: string }>;
}

const ShiftDistributionPopoverComponent: React.FC<ShiftDistributionPopoverProps> = ({
  date,
  scheduleEntries,
  shiftTypes,
  teamSections,
  children,
  showTeamBreakdown = false,
}) => {
  // Memoize visible team IDs
  const visibleTeamIds = useMemo(() => 
    teamSections?.map(t => t.teamId) || [],
    [teamSections]
  );

  const shiftDetails = useMemo(() => {
    const details: Record<string, ShiftDetail> = {};
    const uniqueKeys = new Set<string>();

    scheduleEntries
      .filter((e) => 
        e.date === date && 
        e.shift_type && 
        e.activity_type === 'work' &&
        // Only count entries for visible teams
        (visibleTeamIds.length === 0 || visibleTeamIds.includes(e.team_id))
      )
      .forEach((entry) => {
        const key = `${entry.user_id}-${entry.date}-${entry.shift_type}`;
        
        if (!uniqueKeys.has(key)) {
          uniqueKeys.add(key);
          
          if (!details[entry.shift_type!]) {
            details[entry.shift_type!] = {
              shiftType: entry.shift_type!,
              count: 0,
              users: [],
            };
          }

          // Find user info
          const userInfo = teamSections?.flatMap(t => t.members).find(m => m.user_id === entry.user_id);
          const teamName = teamSections?.find(t => t.members.some(m => m.user_id === entry.user_id))?.teamName;

          details[entry.shift_type!].count++;
          details[entry.shift_type!].users.push({
            userId: entry.user_id,
            name: userInfo ? `${userInfo.first_name} ${userInfo.last_name}` : 'Unknown',
            initials: userInfo?.initials || '??',
            teamName,
          });
        }
      });

    return Object.values(details);
  }, [date, scheduleEntries, teamSections, visibleTeamIds]);

  const getShiftColor = (shiftType: string): string => {
    switch (shiftType) {
      case 'early':
        return 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300';
      case 'late':
        return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300';
      case 'normal':
        return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300';
      case 'weekend':
        return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getShiftLabel = (shiftType: string): string => {
    const shift = shiftTypes.find((s) => s.type === shiftType);
    return shift?.label || shiftType;
  };

  const totalStaff = shiftDetails.reduce((sum, detail) => sum + detail.count, 0);

  if (shiftDetails.length === 0) {
    return <>{children}</>;
  }

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-4" align="center" side="top">
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm font-semibold">{new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            <Badge variant="secondary" className="ml-auto">
              <Users className="h-3 w-3 mr-1" />
              {totalStaff} staff
            </Badge>
          </div>

          <div className="space-y-3">
            {shiftDetails.map((detail) => (
              <div key={detail.shiftType} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`${getShiftColor(detail.shiftType)} font-medium`}>
                    {getShiftLabel(detail.shiftType)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    ({detail.count} {detail.count === 1 ? 'person' : 'people'})
                  </span>
                </div>
                <div className="pl-2 space-y-0.5">
                  {detail.users.map((user) => (
                    <div key={user.userId} className="text-xs text-foreground flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium">
                        {user.initials}
                      </div>
                      <span>{user.name}</span>
                      {showTeamBreakdown && user.teamName && (
                        <span className="text-muted-foreground">• {user.teamName}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

// Wrap with React.memo to prevent unnecessary re-renders
export const ShiftDistributionPopover = React.memo(ShiftDistributionPopoverComponent);
