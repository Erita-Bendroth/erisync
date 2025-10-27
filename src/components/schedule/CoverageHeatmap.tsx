import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCoverageAnalysis } from '@/hooks/useCoverageAnalysis';
import { format, eachDayOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';

interface CoverageHeatmapProps {
  teamIds: string[];
  startDate: Date;
  endDate: Date;
  teams: Array<{ id: string; name: string }>;
}

export function CoverageHeatmap({ teamIds, startDate, endDate, teams }: CoverageHeatmapProps) {
  const analysis = useCoverageAnalysis({ teamIds, startDate, endDate });

  const dates = eachDayOfInterval({ start: startDate, end: endDate });

  const getCoverageForTeamAndDate = (teamId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const gap = analysis.gaps.find((g) => g.teamId === teamId && g.date === dateStr);

    if (!gap) {
      return { percentage: 100, actual: 0, required: 0 };
    }

    const percentage = gap.required > 0 ? Math.round((gap.actual / gap.required) * 100) : 0;
    return { percentage, actual: gap.actual, required: gap.required };
  };

  const getCoverageColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-600 dark:bg-green-500';
    if (percentage >= 80) return 'bg-green-400 dark:bg-green-600';
    if (percentage >= 60) return 'bg-yellow-400 dark:bg-yellow-600';
    if (percentage >= 40) return 'bg-orange-400 dark:bg-orange-600';
    if (percentage > 0) return 'bg-red-400 dark:bg-red-600';
    return 'bg-red-600 dark:bg-red-700';
  };

  if (analysis.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Coverage Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coverage Heatmap</CardTitle>
        <CardDescription>
          Visual representation of coverage levels across teams and dates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <TooltipProvider>
            <div className="inline-block min-w-full">
              {/* Header row with dates */}
              <div className="flex gap-1 mb-2">
                <div className="w-32 flex-shrink-0" /> {/* Spacer for team names */}
                {dates.map((date) => (
                  <div
                    key={date.toISOString()}
                    className="w-8 text-xs text-center text-muted-foreground"
                  >
                    {format(date, 'd')}
                  </div>
                ))}
              </div>

              {/* Team rows */}
              {teams.map((team) => (
                <div key={team.id} className="flex gap-1 mb-1">
                  <div className="w-32 flex-shrink-0 text-sm font-medium truncate pr-2">
                    {team.name}
                  </div>
                  {dates.map((date) => {
                    const coverage = getCoverageForTeamAndDate(team.id, date);
                    return (
                      <Tooltip key={`${team.id}-${date.toISOString()}`}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'w-8 h-8 rounded cursor-pointer transition-transform hover:scale-110',
                              getCoverageColor(coverage.percentage)
                            )}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs">
                            <div className="font-medium">{team.name}</div>
                            <div>{format(date, 'MMM d, yyyy')}</div>
                            <div className="mt-1">
                              Coverage: {coverage.percentage}%
                            </div>
                            {coverage.required > 0 && (
                              <div>
                                Staff: {coverage.actual} / {coverage.required}
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                <span className="text-xs text-muted-foreground">Coverage:</span>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-600" />
                  <span className="text-xs">0%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-400" />
                  <span className="text-xs">60%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-400" />
                  <span className="text-xs">80%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-600" />
                  <span className="text-xs">100%</span>
                </div>
              </div>
            </div>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
