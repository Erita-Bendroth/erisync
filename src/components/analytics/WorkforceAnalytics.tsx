import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CapacityMetrics } from '@/hooks/useAnalytics';

interface WorkforceAnalyticsProps {
  capacity?: CapacityMetrics[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export const WorkforceAnalytics = ({ capacity }: WorkforceAnalyticsProps) => {
  if (!capacity || capacity.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workforce Analytics</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const firstTeamCapacity = capacity[0] as any;

  // Prepare data for activity breakdown pie chart
  const activityData = [
    { name: 'Work Days', value: firstTeamCapacity.work_days || 0, fill: COLORS[0] },
    { name: 'Vacation Days', value: firstTeamCapacity.vacation_days || 0, fill: COLORS[1] },
    { name: 'Sick Days', value: firstTeamCapacity.sick_days || 0, fill: COLORS[2] },
    { name: 'Other', value: firstTeamCapacity.other_days || 0, fill: COLORS[3] },
  ].filter(item => item.value > 0);

  // Prepare data for utilization comparison
  const utilizationData = capacity.map((item: any, idx: number) => ({
    team: `Team ${idx + 1}`,
    utilization: item.utilization_rate || 0,
    available: 100 - (item.utilization_rate || 0),
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activity Breakdown</CardTitle>
            <CardDescription>Distribution of scheduled activities</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={activityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {activityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team Utilization</CardTitle>
            <CardDescription>Capacity usage across teams</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={utilizationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="team" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="utilization" fill={COLORS[0]} name="Utilized %" />
                <Bar dataKey="available" fill={COLORS[3]} name="Available %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Capacity Summary</CardTitle>
          <CardDescription>Key workforce metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Members</p>
              <p className="text-2xl font-bold">{firstTeamCapacity.total_members || 0}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Days</p>
              <p className="text-2xl font-bold">{firstTeamCapacity.total_days || 0}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Work Days</p>
              <p className="text-2xl font-bold">{firstTeamCapacity.work_days || 0}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Utilization</p>
              <p className="text-2xl font-bold">{(firstTeamCapacity.utilization_rate || 0).toFixed(1)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
