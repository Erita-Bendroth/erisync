import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useRosterValidation, WeekValidation } from '@/hooks/useRosterValidation';

interface RosterValidationPanelProps {
  rosterId: string | null;
  partnershipId: string;
  cycleLength: number;
}

const SHIFT_LABELS: Record<string, string> = {
  late: 'Late Shift',
  early: 'Early Shift',
  weekend: 'Weekend',
  normal: 'Normal',
};

export function RosterValidationPanel({
  rosterId,
  partnershipId,
  cycleLength,
}: RosterValidationPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { isValid, warnings, totalWarnings, loading } = useRosterValidation(
    rosterId,
    partnershipId,
    cycleLength
  );

  if (loading) {
    return (
      <Alert className="border-muted">
        <Info className="h-4 w-4" />
        <AlertTitle>Validating staffing requirements...</AlertTitle>
      </Alert>
    );
  }

  if (!rosterId) {
    return null;
  }

  if (isValid) {
    return (
      <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800 dark:text-green-400">
          All staffing requirements met
        </AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-500">
          Each week has the required minimum staff assigned for all shift types.
        </AlertDescription>
      </Alert>
    );
  }

  // Group warnings by week
  const warningsByWeek = warnings.reduce<Record<number, WeekValidation[]>>((acc, warning) => {
    if (!acc[warning.weekNumber]) {
      acc[warning.weekNumber] = [];
    }
    acc[warning.weekNumber].push(warning);
    return acc;
  }, {});

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Alert className="border-destructive/50 bg-destructive/10">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <AlertTitle className="flex items-center justify-between">
          <span className="text-destructive">
            Staffing Warnings ({totalWarnings})
          </span>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2">
              {isExpanded ? 'Hide' : 'Show'} Details
            </Button>
          </CollapsibleTrigger>
        </AlertTitle>
        <CollapsibleContent>
          <AlertDescription className="mt-3 space-y-3">
            {Object.entries(warningsByWeek).map(([weekNum, weekWarnings]) => (
              <div key={weekNum} className="space-y-1">
                <div className="font-medium text-sm">Week {weekNum}</div>
                <div className="space-y-1">
                  {weekWarnings.map((warning, idx) => (
                    <div
                      key={`${warning.weekNumber}-${warning.shiftType}-${idx}`}
                      className="flex items-center gap-2 text-sm pl-4"
                    >
                      <Badge
                        variant={warning.assigned === 0 ? 'destructive' : 'outline'}
                        className="text-xs"
                      >
                        {warning.assigned}/{warning.required}
                      </Badge>
                      <span className="text-muted-foreground">
                        {SHIFT_LABELS[warning.shiftType] || warning.shiftType}:
                      </span>
                      <span className="text-destructive">
                        {warning.assigned === 0
                          ? 'No staff assigned'
                          : `Only ${warning.assigned} of ${warning.required} required`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </AlertDescription>
        </CollapsibleContent>
      </Alert>
    </Collapsible>
  );
}
