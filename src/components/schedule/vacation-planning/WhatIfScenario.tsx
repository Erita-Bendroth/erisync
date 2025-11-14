import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VacationRequest, DayCapacity } from '@/hooks/useVacationPlanning';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Play, RotateCcw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface WhatIfScenarioProps {
  vacationRequests: VacationRequest[];
  capacityData: DayCapacity[];
  teams: Array<{ id: string; name: string }>;
}

interface ScenarioSelection {
  [requestId: string]: 'approve' | 'reject' | 'pending';
}

interface ImpactAnalysis {
  criticalDays: number;
  warningDays: number;
  safeDays: number;
  avgCapacity: number;
  capacityChange: number;
  affectedDates: Array<{
    date: string;
    team_name: string;
    before: { available: number; risk_level: string };
    after: { available: number; risk_level: string };
  }>;
}

export const WhatIfScenario = ({ vacationRequests, capacityData, teams }: WhatIfScenarioProps) => {
  const pendingRequests = useMemo(
    () => vacationRequests.filter(vr => vr.status === 'pending'),
    [vacationRequests]
  );

  const [selections, setSelections] = useState<ScenarioSelection>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const toggleSelection = (requestId: string, action: 'approve' | 'reject') => {
    setSelections(prev => ({
      ...prev,
      [requestId]: prev[requestId] === action ? 'pending' : action
    }));
  };

  const resetSelections = () => {
    setSelections({});
  };

  const analyzeImpact = (): ImpactAnalysis => {
    // Calculate what capacity would look like with selections applied
    const impactedDates = new Map<string, { team_id: string; change: number }>();

    Object.entries(selections).forEach(([requestId, action]) => {
      if (action === 'pending') return;

      const request = pendingRequests.find(r => r.id === requestId);
      if (!request) return;

      const key = `${request.requested_date}-${request.team_id}`;
      const existing = impactedDates.get(key) || { team_id: request.team_id, change: 0 };
      
      // If approving, capacity decreases; if rejecting, capacity stays same (already counted as pending)
      existing.change += action === 'approve' ? -1 : 0;
      impactedDates.set(key, existing);
    });

    // Recalculate capacity with changes
    const newCapacityData = capacityData.map(day => {
      const key = `${day.date}-${day.team_id}`;
      const impact = impactedDates.get(key);
      
      if (!impact) return day;

      const newAvailable = day.available + impact.change;
      const newCoverage = day.total_members > 0 ? (newAvailable / day.required_capacity) * 100 : 0;
      
      let newRiskLevel: 'safe' | 'warning' | 'critical' = 'safe';
      if (newAvailable < day.required_capacity) {
        newRiskLevel = 'critical';
      } else if (newAvailable < day.required_capacity * 1.5) {
        newRiskLevel = 'warning';
      }

      return {
        ...day,
        available: newAvailable,
        coverage_percentage: Math.round(newCoverage),
        risk_level: newRiskLevel
      };
    });

    const criticalDays = newCapacityData.filter(cd => cd.risk_level === 'critical').length;
    const warningDays = newCapacityData.filter(cd => cd.risk_level === 'warning').length;
    const safeDays = newCapacityData.filter(cd => cd.risk_level === 'safe').length;
    
    const newAvgCapacity = newCapacityData.length > 0
      ? newCapacityData.reduce((sum, cd) => sum + cd.coverage_percentage, 0) / newCapacityData.length
      : 0;

    const currentAvgCapacity = capacityData.length > 0
      ? capacityData.reduce((sum, cd) => sum + cd.coverage_percentage, 0) / capacityData.length
      : 0;

    const capacityChange = newAvgCapacity - currentAvgCapacity;

    // Find dates with significant changes
    const affectedDates = newCapacityData
      .map((newDay, index) => {
        const oldDay = capacityData[index];
        if (newDay.available !== oldDay.available || newDay.risk_level !== oldDay.risk_level) {
          const team = teams.find(t => t.id === newDay.team_id);
          return {
            date: newDay.date,
            team_name: team?.name || 'Unknown Team',
            before: { available: oldDay.available, risk_level: oldDay.risk_level },
            after: { available: newDay.available, risk_level: newDay.risk_level }
          };
        }
        return null;
      })
      .filter(Boolean) as ImpactAnalysis['affectedDates'];

    return {
      criticalDays,
      warningDays,
      safeDays,
      avgCapacity: Math.round(newAvgCapacity),
      capacityChange: Math.round(capacityChange * 10) / 10,
      affectedDates
    };
  };

  const impact = useMemo(() => {
    if (Object.keys(selections).length === 0) return null;
    return analyzeImpact();
  }, [selections, capacityData, pendingRequests]);

  const selectionCount = Object.values(selections).filter(s => s !== 'pending').length;

  if (pendingRequests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            What-If Scenario
          </CardTitle>
          <CardDescription>
            No pending requests to analyze
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              What-If Scenario
            </CardTitle>
            <CardDescription>
              Test different approval combinations to see capacity impact
            </CardDescription>
          </div>
          {selectionCount > 0 && (
            <Button variant="outline" size="sm" onClick={resetSelections}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Request Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Select actions for pending requests ({selectionCount} selected)
          </Label>
          <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-3">
            {pendingRequests.map(request => {
              const selection = selections[request.id] || 'pending';
              const team = teams.find(t => t.id === request.team_id);

              return (
                <div key={request.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded">
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {request.profiles?.first_name} {request.profiles?.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(request.requested_date), 'MMM d, yyyy')} • {team?.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={selection === 'approve' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleSelection(request.id, 'approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      variant={selection === 'reject' ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => toggleSelection(request.id, 'reject')}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Impact Analysis */}
        {impact && (
          <div className="space-y-4 pt-4 border-t">
            <Label className="text-sm font-medium">Projected Impact</Label>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">Avg Capacity</div>
                      <div className="text-2xl font-bold flex items-center gap-2">
                        {impact.avgCapacity}%
                        {impact.capacityChange > 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : impact.capacityChange < 0 ? (
                          <TrendingDown className="h-4 w-4 text-destructive" />
                        ) : (
                          <Minus className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {impact.capacityChange > 0 ? '+' : ''}{impact.capacityChange}% change
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Risk Days</div>
                  <div className="space-y-1 mt-2">
                    <div className="flex justify-between text-xs">
                      <span>Critical</span>
                      <Badge variant="destructive">{impact.criticalDays}</Badge>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Warning</span>
                      <Badge variant="secondary">{impact.warningDays}</Badge>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Safe</span>
                      <Badge variant="outline">{impact.safeDays}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Affected Dates */}
            {impact.affectedDates.length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Affected Dates ({impact.affectedDates.length})
                </Label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                  {impact.affectedDates.map((affected, index) => (
                    <div key={index} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                      <div>
                        <div className="font-medium">{format(parseISO(affected.date), 'MMM d')}</div>
                        <div className="text-xs text-muted-foreground">{affected.team_name}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {affected.before.available} → {affected.after.available}
                        </Badge>
                        {affected.before.risk_level !== affected.after.risk_level && (
                          <Badge 
                            variant={
                              affected.after.risk_level === 'critical' ? 'destructive' :
                              affected.after.risk_level === 'warning' ? 'secondary' : 'outline'
                            }
                          >
                            {affected.after.risk_level}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warning if impact is negative */}
            {impact.criticalDays > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Warning: Critical Capacity Issues</AlertTitle>
                <AlertDescription>
                  This scenario would create {impact.criticalDays} day(s) with critical capacity shortages.
                  Consider rejecting some requests or suggesting alternative dates.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
