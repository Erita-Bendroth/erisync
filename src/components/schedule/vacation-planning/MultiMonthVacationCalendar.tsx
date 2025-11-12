import { useMemo } from 'react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, addMonths, isSameDay, parseISO, isWeekend } from 'date-fns';
import { VacationRequest, DayCapacity } from '@/hooks/useVacationPlanning';
import { VacationDayPopover } from './VacationDayPopover';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface MultiMonthVacationCalendarProps {
  startDate: Date;
  monthsToShow: number;
  vacationRequests: VacationRequest[];
  capacityData: DayCapacity[];
  teams: Array<{ id: string; name: string }>;
  loading: boolean;
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string, reason: string) => Promise<void>;
  onRefresh: () => void;
}

export const MultiMonthVacationCalendar = ({
  startDate,
  monthsToShow,
  vacationRequests,
  capacityData,
  teams,
  loading,
  onApprove,
  onReject,
  onRefresh
}: MultiMonthVacationCalendarProps) => {
  const months = useMemo(() => {
    return Array.from({ length: monthsToShow }, (_, i) => addMonths(startDate, i));
  }, [startDate, monthsToShow]);

  const getRequestsForDay = (date: Date, teamId?: string) => {
    return vacationRequests.filter(vr => {
      const matchesDate = isSameDay(parseISO(vr.requested_date), date);
      const matchesTeam = !teamId || vr.team_id === teamId;
      return matchesDate && matchesTeam;
    });
  };

  const getCapacityForDay = (date: Date, teamId?: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const capacities = capacityData.filter(cd => {
      const matchesDate = cd.date === dateStr;
      const matchesTeam = !teamId || cd.team_id === teamId;
      return matchesDate && matchesTeam;
    });

    if (capacities.length === 0) return null;

    // Aggregate if multiple teams
    const totalAvailable = capacities.reduce((sum, c) => sum + c.available, 0);
    const totalRequired = capacities.reduce((sum, c) => sum + c.required_capacity, 0);
    const totalMembers = capacities.reduce((sum, c) => sum + c.total_members, 0);
    
    let riskLevel: 'safe' | 'warning' | 'critical' = 'safe';
    if (totalAvailable < totalRequired) {
      riskLevel = 'critical';
    } else if (totalAvailable < totalRequired * 1.5) {
      riskLevel = 'warning';
    }

    return {
      available: totalAvailable,
      required: totalRequired,
      total: totalMembers,
      riskLevel,
      capacities
    };
  };

  const getRiskColorClass = (riskLevel: 'safe' | 'warning' | 'critical') => {
    switch (riskLevel) {
      case 'critical':
        return 'bg-destructive/10 border-destructive/20';
      case 'warning':
        return 'bg-warning/10 border-warning/20';
      default:
        return 'bg-success/5 border-border';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: monthsToShow }).map((_, i) => (
          <Skeleton key={i} className="h-[300px] w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {months.map((month, monthIndex) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

        return (
          <div key={monthIndex} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {format(month, 'MMMM yyyy')}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-success/20 border border-success/40" />
                  <span>Safe</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-warning/20 border border-warning/40" />
                  <span>At Risk</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-destructive/20 border border-destructive/40" />
                  <span>Critical</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {/* Day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}

              {/* Empty cells for days before month starts */}
              {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[100px]" />
              ))}

              {/* Day cells */}
              {days.map((day) => {
                const requests = getRequestsForDay(day);
                const capacity = getCapacityForDay(day);
                const isWeekendDay = isWeekend(day);

                return (
                  <VacationDayPopover
                    key={day.toISOString()}
                    day={day}
                    requests={requests}
                    capacity={capacity}
                    teams={teams}
                    onApprove={onApprove}
                    onReject={onReject}
                    onRefresh={onRefresh}
                  >
                    <div
                      className={cn(
                        "min-h-[100px] p-2 border rounded-lg cursor-pointer transition-all hover:shadow-md",
                        capacity ? getRiskColorClass(capacity.riskLevel) : "bg-card border-border",
                        isWeekendDay && "bg-muted/30"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                          "text-sm font-medium",
                          isWeekendDay && "text-muted-foreground"
                        )}>
                          {format(day, 'd')}
                        </span>
                        {capacity && (
                          <span className="text-xs text-muted-foreground">
                            {capacity.available}/{capacity.total}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        {requests.slice(0, 3).map((request) => (
                          <div
                            key={request.id}
                            className={cn(
                              "text-xs px-1.5 py-0.5 rounded truncate",
                              request.status === 'approved' && "bg-success/20 text-success-foreground border border-success/40",
                              request.status === 'pending' && "bg-warning/20 text-warning-foreground border border-warning/40",
                              request.status === 'rejected' && "bg-destructive/20 text-destructive-foreground border border-destructive/40"
                            )}
                          >
                            {request.profiles?.initials || request.profiles?.first_name || 'Unknown'}
                          </div>
                        ))}
                        {requests.length > 3 && (
                          <div className="text-xs text-muted-foreground px-1.5">
                            +{requests.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  </VacationDayPopover>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
