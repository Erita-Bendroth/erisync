import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, TrendingUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { CoverageMetrics, VacationMetrics } from '@/hooks/useAnalytics';

interface OperationalInsightsProps {
  coverage?: CoverageMetrics;
  vacation?: VacationMetrics;
}

export const OperationalInsights = ({ coverage, vacation }: OperationalInsightsProps) => {
  const gaps = coverage?.gaps || [];
  const hasGaps = gaps.length > 0;

  // Generate insights
  const insights = [];

  if (hasGaps) {
    insights.push({
      title: 'Coverage Gaps Detected',
      description: `${gaps.length} day(s) with insufficient coverage in the next 60 days`,
      icon: <AlertTriangle className="h-4 w-4" />,
      variant: 'destructive' as const,
    });
  }

  if (vacation) {
    const approvalRate = vacation.total_requests > 0
      ? ((vacation.approved / vacation.total_requests) * 100).toFixed(1)
      : '0';

    insights.push({
      title: 'Vacation Approval Rate',
      description: `${approvalRate}% of requests approved (${vacation.approved}/${vacation.total_requests})`,
      icon: <TrendingUp className="h-4 w-4" />,
      variant: 'default' as const,
    });

    if (vacation.pending > 5) {
      insights.push({
        title: 'Pending Requests Backlog',
        description: `${vacation.pending} vacation requests awaiting approval`,
        icon: <Calendar className="h-4 w-4" />,
        variant: 'default' as const,
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Key Insights Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {insights.map((insight, idx) => (
          <Alert key={idx} variant={insight.variant}>
            <div className="flex items-start gap-2">
              {insight.icon}
              <div>
                <h4 className="font-semibold text-sm">{insight.title}</h4>
                <AlertDescription className="text-xs">{insight.description}</AlertDescription>
              </div>
            </div>
          </Alert>
        ))}
      </div>

      {/* Coverage Gaps Table */}
      {hasGaps && (
        <Card>
          <CardHeader>
            <CardTitle>Coverage Gaps</CardTitle>
            <CardDescription>Dates requiring additional staff scheduling</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gaps.slice(0, 10).map((gap: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>{format(new Date(gap.date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{gap.scheduled_count}</TableCell>
                    <TableCell className="text-destructive font-medium">{gap.gap} needed</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {gaps.length > 10 && (
              <p className="text-xs text-muted-foreground mt-2">
                Showing 10 of {gaps.length} coverage gaps
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vacation Patterns */}
      {vacation && (
        <Card>
          <CardHeader>
            <CardTitle>Vacation Request Summary</CardTitle>
            <CardDescription>Last 6 months of vacation data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{vacation.total_requests}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">{vacation.approved}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{vacation.pending}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{vacation.rejected}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
