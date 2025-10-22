import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { EfficiencyMetrics } from '@/hooks/useAnalytics';

interface EfficiencyAnalyticsProps {
  efficiency?: EfficiencyMetrics;
}

const COLORS = {
  normal: 'hsl(var(--primary))',
  early: 'hsl(var(--secondary))',
  late: 'hsl(var(--accent))',
  work: 'hsl(var(--primary))',
  vacation: 'hsl(var(--secondary))',
  sick: 'hsl(var(--destructive))',
  other: 'hsl(var(--muted))',
};

export const EfficiencyAnalytics = ({ efficiency }: EfficiencyAnalyticsProps) => {
  if (!efficiency) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Efficiency Analytics</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Prepare shift distribution data
  const shiftData = Object.entries(efficiency.shift_distribution || {}).map(([type, count]) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    count,
    fill: COLORS[type as keyof typeof COLORS] || COLORS.normal,
  }));

  // Prepare activity distribution data
  const activityData = Object.entries(efficiency.activity_distribution || {}).map(([type, count]) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    count,
    fill: COLORS[type as keyof typeof COLORS] || COLORS.work,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Shift Type Distribution</CardTitle>
            <CardDescription>Breakdown of different shift types</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={shiftData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))">
                  {shiftData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Distribution</CardTitle>
            <CardDescription>Types of activities scheduled</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))">
                  {activityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule Changes</CardTitle>
          <CardDescription>Tracking schedule modifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Changes</span>
              <span className="text-2xl font-bold">{efficiency.total_changes || 0}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Lower change counts indicate more stable planning and better initial scheduling
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
