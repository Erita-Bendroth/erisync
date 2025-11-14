import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DayCapacity } from '@/hooks/useVacationPlanning';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CoverageHeatmapProps {
  capacityData: DayCapacity[];
  teams: Array<{ id: string; name: string }>;
  dateRange: { start: Date; end: Date };
}

export const CoverageHeatmap = ({ capacityData, teams, dateRange }: CoverageHeatmapProps) => {
  // Group capacity by week
  const getWeekDays = () => {
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];

    days.forEach((day, index) => {
      currentWeek.push(day);
      if (getDay(day) === 6 || index === days.length - 1) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    return weeks;
  };

  const weeks = getWeekDays();

  const getCapacityColor = (capacity: DayCapacity | undefined) => {
    if (!capacity) return 'bg-muted/30';
    
    if (capacity.risk_level === 'critical') return 'bg-destructive';
    if (capacity.risk_level === 'warning') return 'bg-warning';
    return 'bg-primary';
  };

  const getCapacityOpacity = (capacity: DayCapacity | undefined) => {
    if (!capacity) return '';
    
    const percentage = capacity.coverage_percentage;
    if (percentage >= 100) return 'opacity-100';
    if (percentage >= 75) return 'opacity-75';
    if (percentage >= 50) return 'opacity-50';
    return 'opacity-30';
  };

  const findCapacity = (date: Date, teamId: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return capacityData.find(cd => cd.date === dateStr && cd.team_id === teamId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coverage Heat Map</CardTitle>
        <CardDescription>
          Visual representation of team capacity across the date range
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {teams.map(team => (
            <div key={team.id} className="space-y-2">
              <div className="text-sm font-medium">{team.name}</div>
              <div className="space-y-1">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex gap-1">
                    {week.map((day, dayIndex) => {
                      const capacity = findCapacity(day, team.id);
                      const colorClass = getCapacityColor(capacity);
                      const opacityClass = getCapacityOpacity(capacity);

                      return (
                        <TooltipProvider key={dayIndex}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={`h-8 flex-1 rounded ${colorClass} ${opacityClass} hover:ring-2 hover:ring-primary cursor-pointer transition-all`}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {format(day, 'MMM d, yyyy')}
                                </div>
                                {capacity ? (
                                  <>
                                    <div className="text-sm">
                                      Available: {capacity.available}/{capacity.total_members}
                                    </div>
                                    <div className="text-sm">
                                      Required: {capacity.required_capacity}
                                    </div>
                                    <div className="text-sm">
                                      Coverage: {capacity.coverage_percentage}%
                                    </div>
                                    <div className="text-sm capitalize">
                                      Risk: {capacity.risk_level}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-sm text-muted-foreground">
                                    No data available
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-6 pt-4 border-t">
          <div className="text-sm font-medium">Legend:</div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-primary rounded" />
            <span className="text-xs">Safe</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-warning rounded" />
            <span className="text-xs">Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-destructive rounded" />
            <span className="text-xs">Critical</span>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <div className="text-xs text-muted-foreground">
              Opacity indicates coverage % (darker = better)
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
