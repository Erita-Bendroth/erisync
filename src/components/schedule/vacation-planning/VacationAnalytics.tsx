import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { VacationRequest, DayCapacity } from '@/hooks/useVacationPlanning';
import { TrendingUp, TrendingDown, Activity, Users } from 'lucide-react';
import { format, parseISO, differenceInDays, eachMonthOfInterval } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface VacationAnalyticsProps {
  vacationRequests: VacationRequest[];
  capacityData: DayCapacity[];
  teams: Array<{ id: string; name: string }>;
  dateRange: { start: Date; end: Date };
}

export const VacationAnalytics = ({ vacationRequests, capacityData, teams, dateRange }: VacationAnalyticsProps) => {
  const analytics = useMemo(() => {
    // Approval rate
    const total = vacationRequests.length;
    const approved = vacationRequests.filter(vr => vr.status === 'approved').length;
    const rejected = vacationRequests.filter(vr => vr.status === 'rejected').length;
    const pending = vacationRequests.filter(vr => vr.status === 'pending').length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    // Peak vacation months
    const months = eachMonthOfInterval({ start: dateRange.start, end: dateRange.end });
    const vacationsByMonth = months.map(month => {
      const monthKey = format(month, 'yyyy-MM');
      const count = vacationRequests.filter(vr => 
        vr.requested_date.startsWith(monthKey)
      ).length;
      return { month: format(month, 'MMM yyyy'), count };
    });
    const peakMonth = vacationsByMonth.reduce((max, curr) => 
      curr.count > max.count ? curr : max, vacationsByMonth[0]
    );

    // Capacity trends
    const avgCapacity = capacityData.length > 0
      ? Math.round(capacityData.reduce((sum, cd) => sum + cd.coverage_percentage, 0) / capacityData.length)
      : 0;
    const criticalDays = capacityData.filter(cd => cd.risk_level === 'critical').length;
    const safeDays = capacityData.filter(cd => cd.risk_level === 'safe').length;
    const capacityHealthScore = capacityData.length > 0
      ? Math.round((safeDays / capacityData.length) * 100)
      : 0;

    // Team patterns
    const teamStats = teams.map(team => {
      const teamRequests = vacationRequests.filter(vr => vr.team_id === team.id);
      const teamCapacity = capacityData.filter(cd => cd.team_id === team.id);
      const avgTeamCapacity = teamCapacity.length > 0
        ? Math.round(teamCapacity.reduce((sum, cd) => sum + cd.coverage_percentage, 0) / teamCapacity.length)
        : 0;
      
      return {
        team: team.name,
        requests: teamRequests.length,
        avgCapacity: avgTeamCapacity,
        criticalDays: teamCapacity.filter(cd => cd.risk_level === 'critical').length
      };
    });

    // Response time - calculated as placeholder since created_at not available
    const avgResponseDays = 0; // Would need created_at field in VacationRequest

    return {
      approvalRate,
      approved,
      rejected,
      pending,
      peakMonth,
      avgCapacity,
      criticalDays,
      capacityHealthScore,
      teamStats,
      avgResponseDays,
      vacationsByMonth
    };
  }, [vacationRequests, capacityData, teams, dateRange]);

  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Approval Rate</div>
                <div className="text-2xl font-bold flex items-center gap-2">
                  {analytics.approvalRate}%
                  {analytics.approvalRate >= 75 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-warning" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {analytics.approved} approved, {analytics.rejected} rejected
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <div className="text-sm text-muted-foreground">Capacity Health</div>
              <div className="text-2xl font-bold">{analytics.capacityHealthScore}%</div>
              <div className="text-xs text-muted-foreground mt-1">
                {analytics.criticalDays} critical days
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <div className="text-sm text-muted-foreground">Peak Month</div>
              <div className="text-2xl font-bold">{analytics.peakMonth?.month}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {analytics.peakMonth?.count} requests
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <div className="text-sm text-muted-foreground">Avg Response Time</div>
              <div className="text-2xl font-bold">{analytics.avgResponseDays} days</div>
              <div className="text-xs text-muted-foreground mt-1">
                For processed requests
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Performance
          </CardTitle>
          <CardDescription>
            Vacation patterns and capacity by team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.teamStats.map(stat => (
              <div key={stat.team} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{stat.team}</div>
                  <div className="text-sm text-muted-foreground">
                    {stat.requests} vacation requests
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium">{stat.avgCapacity}%</div>
                    <div className="text-xs text-muted-foreground">Avg Capacity</div>
                  </div>
                  {stat.criticalDays > 0 && (
                    <Badge variant="destructive">
                      {stat.criticalDays} critical
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Monthly Trends
          </CardTitle>
          <CardDescription>
            Vacation request distribution across months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {analytics.vacationsByMonth.map(month => {
              const maxCount = Math.max(...analytics.vacationsByMonth.map(m => m.count), 1);
              const percentage = (month.count / maxCount) * 100;

              return (
                <div key={month.month} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{month.month}</span>
                    <span className="text-muted-foreground">{month.count} requests</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
