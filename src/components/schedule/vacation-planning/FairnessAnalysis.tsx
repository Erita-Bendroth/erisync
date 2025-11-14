import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { VacationRequest } from '@/hooks/useVacationPlanning';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import { differenceInDays, parseISO, startOfYear, endOfYear } from 'date-fns';

interface FairnessAnalysisProps {
  vacationRequests: VacationRequest[];
  teams: Array<{ id: string; name: string }>;
  dateRange: { start: Date; end: Date };
}

interface UserVacationStats {
  user_id: string;
  name: string;
  team_name: string;
  approved_days: number;
  pending_days: number;
  total_days: number;
  percentage_of_range: number;
}

export const FairnessAnalysis = ({ vacationRequests, teams, dateRange }: FairnessAnalysisProps) => {
  const stats = useMemo(() => {
    // Group requests by user
    const userMap = new Map<string, UserVacationStats>();

    vacationRequests.forEach(req => {
      const key = req.user_id;
      
      if (!userMap.has(key)) {
        userMap.set(key, {
          user_id: req.user_id,
          name: `${req.profiles?.first_name} ${req.profiles?.last_name}`,
          team_name: req.teams?.name || 'Unknown Team',
          approved_days: 0,
          pending_days: 0,
          total_days: 0,
          percentage_of_range: 0
        });
      }

      const userStats = userMap.get(key)!;
      const dayCount = req.is_full_day ? 1 : 0.5;

      if (req.status === 'approved') {
        userStats.approved_days += dayCount;
      } else if (req.status === 'pending') {
        userStats.pending_days += dayCount;
      }
      
      userStats.total_days = userStats.approved_days + userStats.pending_days;
    });

    // Calculate percentage of date range
    const rangeInDays = differenceInDays(dateRange.end, dateRange.start);
    userMap.forEach(stats => {
      stats.percentage_of_range = (stats.total_days / rangeInDays) * 100;
    });

    return Array.from(userMap.values()).sort((a, b) => b.total_days - a.total_days);
  }, [vacationRequests, dateRange]);

  const avgDays = stats.length > 0 
    ? stats.reduce((sum, s) => sum + s.total_days, 0) / stats.length 
    : 0;

  const maxDays = Math.max(...stats.map(s => s.total_days), 0);
  const minDays = Math.min(...stats.map(s => s.total_days), maxDays);
  const fairnessScore = maxDays > 0 ? ((1 - (maxDays - minDays) / maxDays) * 100) : 100;

  if (stats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Fairness Analysis
          </CardTitle>
          <CardDescription>
            No vacation data available for the selected period
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Fairness Analysis
        </CardTitle>
        <CardDescription>
          Vacation distribution across team members
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <div className="text-sm text-muted-foreground">Average Days</div>
            <div className="text-2xl font-bold">{avgDays.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Fairness Score</div>
            <div className="text-2xl font-bold flex items-center gap-2">
              {fairnessScore.toFixed(0)}%
              {fairnessScore >= 80 ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-warning" />
              )}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Range</div>
            <div className="text-2xl font-bold">
              {minDays.toFixed(1)} - {maxDays.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Individual User Stats */}
        <div className="space-y-3">
          <div className="text-sm font-medium">Individual Distribution</div>
          {stats.map(userStat => {
            const isAboveAvg = userStat.total_days > avgDays;
            const deviation = Math.abs(userStat.total_days - avgDays);
            const isSignificantDeviation = deviation > avgDays * 0.3;

            return (
              <div key={userStat.user_id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{userStat.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {userStat.team_name}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {userStat.approved_days.toFixed(1)} approved
                    </span>
                    {userStat.pending_days > 0 && (
                      <span className="text-warning">
                        +{userStat.pending_days.toFixed(1)} pending
                      </span>
                    )}
                    <span className="font-medium">
                      {userStat.total_days.toFixed(1)} days
                    </span>
                    {isSignificantDeviation && (
                      <Badge variant={isAboveAvg ? "secondary" : "outline"}>
                        {isAboveAvg ? '+' : '-'}{deviation.toFixed(1)}
                      </Badge>
                    )}
                  </div>
                </div>
                <Progress 
                  value={maxDays > 0 ? (userStat.total_days / maxDays) * 100 : 0} 
                  className="h-2"
                />
              </div>
            );
          })}
        </div>

        {/* Fairness Insights */}
        {fairnessScore < 70 && (
          <Alert className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Uneven Distribution Detected</AlertTitle>
            <AlertDescription>
              There's significant variance in vacation distribution. Consider reviewing 
              requests to ensure fair allocation across team members.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

// Missing import
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
