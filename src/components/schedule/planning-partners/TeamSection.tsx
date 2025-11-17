import { useState } from 'react';
import { ChevronDown, ChevronRight, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TeamMember {
  user_id: string;
  team_id: string;
  profiles: {
    first_name: string;
    last_name: string;
  } | null;
}

interface ScheduleEntry {
  date: string;
  user_id: string;
  team_id: string;
  availability_status: 'available' | 'unavailable';
  activity_type: string;
  shift_type: string;
  notes?: string;
}

interface TeamSectionProps {
  teamId: string;
  teamName: string;
  teamColor: string;
  members: TeamMember[];
  scheduleEntries: ScheduleEntry[];
  weekDates: Date[];
  onCellClick: (userId: string, date: Date, teamId: string) => void;
  canScheduleUser: (userId: string, teamId: string) => boolean;
}

const getShiftBadgeColor = (shiftType: string) => {
  switch (shiftType) {
    case 'early': return 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700';
    case 'late': return 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700';
    case 'weekend': return 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700';
    case 'normal': return 'bg-gray-100 dark:bg-gray-950 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getShiftLabel = (shiftType: string) => {
  switch (shiftType) {
    case 'early': return 'Early';
    case 'late': return 'Late';
    case 'weekend': return 'Weekend';
    case 'normal': return 'Normal';
    default: return shiftType;
  }
};

export function TeamSection({
  teamId,
  teamName,
  teamColor,
  members,
  scheduleEntries,
  weekDates,
  onCellClick,
  canScheduleUser
}: TeamSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getAvailabilityForUserAndDate = (userId: string, date: Date) => {
    return scheduleEntries.find(
      e => e.user_id === userId && e.date === format(date, 'yyyy-MM-dd') && e.team_id === teamId
    );
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-4 bg-muted/50 hover:bg-muted transition-colors border-b"
        style={{ borderLeftColor: teamColor, borderLeftWidth: '4px' }}
      >
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        )}
        <Circle className="h-3 w-3 flex-shrink-0" fill={teamColor} color={teamColor} />
        <span className="font-semibold text-lg">{teamName}</span>
        <Badge variant="secondary" className="ml-auto">
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </Badge>
      </button>

      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              {members.map((member) => {
                const displayName = member.profiles 
                  ? `${member.profiles.first_name} ${member.profiles.last_name}`
                  : 'Unknown User';
                
                return (
                <tr key={member.user_id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3 sticky left-0 bg-card border-r z-10">
                    <div className="flex items-center gap-2 min-w-[160px]">
                      <Circle className="h-2 w-2 flex-shrink-0" fill={teamColor} color={teamColor} />
                      <span className="font-medium text-sm">
                        {displayName}
                      </span>
                    </div>
                  </td>
                  {weekDates.map((date, dateIndex) => {
                    const availability = getAvailabilityForUserAndDate(member.user_id, date);
                    const canSchedule = canScheduleUser(member.user_id, teamId);
                    const isWeekendDay = isWeekend(date);

                    return (
                      <td
                        key={dateIndex}
                        className={cn(
                          "p-2 text-center border-r last:border-r-0 min-w-[120px]",
                          isWeekendDay && "bg-muted/20",
                          canSchedule && "cursor-pointer hover:bg-accent/50 transition-colors"
                        )}
                        onClick={() => canSchedule && onCellClick(member.user_id, date, teamId)}
                      >
                        {availability ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1">
                              {availability.availability_status === 'available' ? (
                                <Circle className="h-3 w-3 fill-green-500 text-green-500" />
                              ) : (
                                <Circle className="h-3 w-3 fill-red-500 text-red-500" />
                              )}
                              <span className={cn(
                                "text-xs font-medium",
                                availability.availability_status === 'available' 
                                  ? "text-green-700 dark:text-green-400" 
                                  : "text-red-700 dark:text-red-400"
                              )}>
                                {availability.availability_status === 'available' ? 'Available' : 'Unavailable'}
                              </span>
                            </div>
                            {availability.shift_type && availability.availability_status === 'available' && (
                              <Badge
                                variant="outline"
                                className={cn("text-xs", getShiftBadgeColor(availability.shift_type))}
                              >
                                {getShiftLabel(availability.shift_type)}
                              </Badge>
                            )}
                            {availability.activity_type && availability.availability_status === 'unavailable' && (
                              <span className="text-xs text-muted-foreground capitalize">
                                {availability.activity_type}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
