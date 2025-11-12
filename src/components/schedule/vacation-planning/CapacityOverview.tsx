import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VacationRequest, DayCapacity } from '@/hooks/useVacationPlanning';
import { Users, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface CapacityOverviewProps {
  capacityData: DayCapacity[];
  vacationRequests: VacationRequest[];
  teams: Array<{ id: string; name: string }>;
}

export const CapacityOverview = ({ capacityData, vacationRequests, teams }: CapacityOverviewProps) => {
  const criticalDays = capacityData.filter(cd => cd.risk_level === 'critical').length;
  const warningDays = capacityData.filter(cd => cd.risk_level === 'warning').length;
  const pendingCount = vacationRequests.filter(vr => vr.status === 'pending').length;
  const approvedCount = vacationRequests.filter(vr => vr.status === 'approved').length;

  // Calculate average capacity
  const avgCapacity = capacityData.length > 0
    ? Math.round(capacityData.reduce((sum, cd) => sum + cd.coverage_percentage, 0) / capacityData.length)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
          <Clock className="h-4 w-4 text-warning" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pendingCount}</div>
          <p className="text-xs text-muted-foreground">
            {approvedCount} approved
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Capacity</CardTitle>
          <Users className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgCapacity}%</div>
          <Progress value={avgCapacity} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Critical Days</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{criticalDays}</div>
          <p className="text-xs text-muted-foreground">
            Below minimum capacity
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">At Risk Days</CardTitle>
          <AlertTriangle className="h-4 w-4 text-warning" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{warningDays}</div>
          <p className="text-xs text-muted-foreground">
            Low capacity buffer
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
