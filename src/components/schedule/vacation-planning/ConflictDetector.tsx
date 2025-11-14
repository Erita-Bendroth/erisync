import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VacationRequest, DayCapacity } from '@/hooks/useVacationPlanning';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

interface Conflict {
  type: 'critical' | 'warning' | 'info';
  date: string;
  team_id: string;
  team_name: string;
  message: string;
  affected_requests: VacationRequest[];
  capacity?: DayCapacity;
}

interface ConflictDetectorProps {
  capacityData: DayCapacity[];
  vacationRequests: VacationRequest[];
  teams: Array<{ id: string; name: string }>;
}

export const ConflictDetector = ({ capacityData, vacationRequests, teams }: ConflictDetectorProps) => {
  const detectConflicts = (): Conflict[] => {
    const conflicts: Conflict[] = [];

    // Group capacity issues by date and team
    const criticalDays = capacityData.filter(cd => cd.risk_level === 'critical');
    const warningDays = capacityData.filter(cd => cd.risk_level === 'warning');

    // Critical capacity conflicts (below minimum)
    criticalDays.forEach(day => {
      const affectedRequests = vacationRequests.filter(
        vr => vr.team_id === day.team_id && 
             vr.requested_date === day.date && 
             vr.status === 'pending'
      );

      if (affectedRequests.length > 0) {
        conflicts.push({
          type: 'critical',
          date: day.date,
          team_id: day.team_id,
          team_name: day.team_name,
          message: `Critical: Only ${day.available} of ${day.required_capacity} required staff available`,
          affected_requests: affectedRequests,
          capacity: day
        });
      }
    });

    // Warning capacity conflicts (low buffer)
    warningDays.forEach(day => {
      const affectedRequests = vacationRequests.filter(
        vr => vr.team_id === day.team_id && 
             vr.requested_date === day.date && 
             vr.status === 'pending'
      );

      if (affectedRequests.length > 0) {
        conflicts.push({
          type: 'warning',
          date: day.date,
          team_id: day.team_id,
          team_name: day.team_name,
          message: `Warning: Low capacity buffer (${day.available}/${day.required_capacity})`,
          affected_requests: affectedRequests,
          capacity: day
        });
      }
    });

    // Detect overlapping requests (multiple pending for same day)
    const pendingByDate = vacationRequests
      .filter(vr => vr.status === 'pending')
      .reduce((acc, vr) => {
        const key = `${vr.team_id}-${vr.requested_date}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(vr);
        return acc;
      }, {} as Record<string, VacationRequest[]>);

    Object.entries(pendingByDate).forEach(([key, requests]) => {
      if (requests.length > 2) {
        const [team_id, date] = key.split('-');
        const team = teams.find(t => t.id === team_id);
        
        conflicts.push({
          type: 'info',
          date: date,
          team_id: team_id,
          team_name: team?.name || 'Unknown Team',
          message: `${requests.length} pending requests for the same day`,
          affected_requests: requests
        });
      }
    });

    return conflicts.sort((a, b) => {
      if (a.type !== b.type) {
        const order = { critical: 0, warning: 1, info: 2 };
        return order[a.type] - order[b.type];
      }
      return a.date.localeCompare(b.date);
    });
  };

  const conflicts = detectConflicts();

  if (conflicts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Conflict Detection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>No Conflicts Detected</AlertTitle>
            <AlertDescription>
              All pending vacation requests are within capacity limits.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const criticalCount = conflicts.filter(c => c.type === 'critical').length;
  const warningCount = conflicts.filter(c => c.type === 'warning').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Conflict Detection
          </CardTitle>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive">{criticalCount} Critical</Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="secondary">{warningCount} Warnings</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {conflicts.map((conflict, index) => {
          const Icon = conflict.type === 'critical' ? AlertTriangle : 
                       conflict.type === 'warning' ? AlertCircle : Info;
          const variant = conflict.type === 'critical' ? 'destructive' : 'default';

          return (
            <Alert key={index} variant={variant}>
              <Icon className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>{conflict.team_name}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {format(parseISO(conflict.date), 'MMM d, yyyy')}
                </span>
              </AlertTitle>
              <AlertDescription>
                <div className="space-y-2">
                  <p>{conflict.message}</p>
                  {conflict.affected_requests.length > 0 && (
                    <div className="text-xs">
                      <span className="font-medium">Affected requests: </span>
                      {conflict.affected_requests.map((req, i) => (
                        <span key={req.id}>
                          {req.profiles?.first_name} {req.profiles?.last_name}
                          {i < conflict.affected_requests.length - 1 && ', '}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          );
        })}
      </CardContent>
    </Card>
  );
};
