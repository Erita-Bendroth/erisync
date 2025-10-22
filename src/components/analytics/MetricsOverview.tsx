import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Users, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon: React.ReactNode;
}

const MetricCard = ({ title, value, trend, icon }: MetricCardProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className="text-xs text-muted-foreground flex items-center mt-1">
            {trend.isPositive ? (
              <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
            ) : (
              <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
            )}
            {Math.abs(trend.value)}% from last period
          </p>
        )}
      </CardContent>
    </Card>
  );
};

interface MetricsOverviewProps {
  capacity?: {
    total_members: number;
    work_days: number;
    utilization_rate: number;
  };
  coverage?: {
    gaps: any[];
  };
  vacation?: {
    pending: number;
    approved: number;
  };
  efficiency?: {
    total_changes: number;
  };
}

export const MetricsOverview = ({ capacity, coverage, vacation, efficiency }: MetricsOverviewProps) => {
  const coverageGapsCount = coverage?.gaps?.length || 0;
  const utilizationRate = capacity?.utilization_rate || 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Active Team Members"
        value={capacity?.total_members || 0}
        icon={<Users className="h-4 w-4 text-muted-foreground" />}
      />
      <MetricCard
        title="Utilization Rate"
        value={`${utilizationRate.toFixed(1)}%`}
        trend={{
          value: 5.2,
          isPositive: utilizationRate > 80,
        }}
        icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
      />
      <MetricCard
        title="Coverage Gaps"
        value={coverageGapsCount}
        icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
      />
      <MetricCard
        title="Pending Requests"
        value={vacation?.pending || 0}
        icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
      />
    </div>
  );
};
