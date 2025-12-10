import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CoverageImpactWarning as CoverageWarning } from '@/hooks/useCoverageImpact';
import { format, parseISO } from 'date-fns';

interface CoverageImpactWarningProps {
  warnings: CoverageWarning[];
  loading?: boolean;
  acknowledged?: boolean;
  onAcknowledgeChange?: (acknowledged: boolean) => void;
  showAcknowledge?: boolean;
}

const SHIFT_LABELS: Record<string, string> = {
  late: 'Late Shift',
  early: 'Early Shift',
  weekend: 'Weekend',
  normal: 'Normal',
};

export function CoverageImpactWarningDisplay({
  warnings,
  loading = false,
  acknowledged = false,
  onAcknowledgeChange,
  showAcknowledge = true,
}: CoverageImpactWarningProps) {
  if (loading) {
    return (
      <Alert className="border-muted">
        <Info className="h-4 w-4 animate-pulse" />
        <AlertTitle>Analyzing coverage impact...</AlertTitle>
      </Alert>
    );
  }

  if (warnings.length === 0) {
    return null;
  }

  const hasCritical = warnings.some((w) => w.isCritical);

  return (
    <Alert className={hasCritical ? 'border-destructive/50 bg-destructive/10' : 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20'}>
      {hasCritical ? (
        <AlertTriangle className="h-4 w-4 text-destructive" />
      ) : (
        <AlertCircle className="h-4 w-4 text-yellow-600" />
      )}
      <AlertTitle className={hasCritical ? 'text-destructive' : 'text-yellow-800 dark:text-yellow-400'}>
        Coverage Impact Warning
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p className="text-sm">
          {hasCritical
            ? 'Approving this request will cause understaffing on the following dates:'
            : 'This action may affect coverage levels:'}
        </p>

        <div className="space-y-2">
          {warnings.map((warning, idx) => (
            <div
              key={`${warning.date}-${warning.shiftType}-${idx}`}
              className="flex items-center gap-2 text-sm"
            >
              <Badge
                variant={warning.isCritical ? 'destructive' : 'outline'}
                className="text-xs shrink-0"
              >
                {warning.remainingStaff}/{warning.requiredStaff}
              </Badge>
              <span className="text-muted-foreground">
                {format(parseISO(warning.date), 'MMM d, yyyy')}:
              </span>
              <span className={warning.isCritical ? 'text-destructive' : 'text-yellow-700 dark:text-yellow-500'}>
                {SHIFT_LABELS[warning.shiftType] || warning.shiftType} drops to {warning.remainingStaff} of{' '}
                {warning.requiredStaff} ({warning.percentage}%)
              </span>
              {warning.isCritical && (
                <Badge variant="destructive" className="text-xs">
                  Critical
                </Badge>
              )}
            </div>
          ))}
        </div>

        {showAcknowledge && (
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Checkbox
              id="acknowledge-impact"
              checked={acknowledged}
              onCheckedChange={(checked) => onAcknowledgeChange?.(checked === true)}
            />
            <Label htmlFor="acknowledge-impact" className="text-sm cursor-pointer">
              I acknowledge this impact and want to proceed
            </Label>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
