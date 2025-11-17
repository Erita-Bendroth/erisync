import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { CoverageAnalysis } from '@/hooks/useCoverageAnalysis';

interface CoverageAlertsProps {
  analysis: CoverageAnalysis;
  partnershipName?: string;
  partnershipConfig?: {
    min_staff_required: number;
    max_staff_allowed?: number | null;
  };
}

export function CoverageAlerts({ analysis, partnershipName, partnershipConfig }: CoverageAlertsProps) {
  const { gaps, belowThreshold, threshold, coveragePercentage } = analysis;

  // Categorize gaps by severity
  const criticalGaps = gaps.filter((gap) => gap.actual === 0);
  const warningGaps = gaps.filter((gap) => gap.actual > 0 && gap.deficit > 0);

  // Don't show alerts if coverage is good
  if (!belowThreshold && gaps.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Critical alert if coverage is very low */}
      {coveragePercentage < threshold - 20 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Critical Coverage Issue</AlertTitle>
          <AlertDescription>
            Coverage is only {coveragePercentage}%, significantly below the {threshold}% threshold.
            Immediate action required.
          </AlertDescription>
        </Alert>
      )}

      {/* Partnership capacity warning */}
      {partnershipName && partnershipConfig && belowThreshold && (
        <Alert variant="default" className="border-orange-600 dark:border-orange-400">
          <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertTitle>Partnership Below Minimum Capacity</AlertTitle>
          <AlertDescription>
            Partnership <strong>"{partnershipName}"</strong> has coverage below the configured minimum
            of {partnershipConfig.min_staff_required} staff on some days.
            {partnershipConfig.max_staff_allowed && (
              <span> Maximum allowed: {partnershipConfig.max_staff_allowed}</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Warning alert if below threshold but not critical */}
      {belowThreshold && coveragePercentage >= threshold - 20 && !partnershipConfig && (
        <Alert variant="default" className="border-yellow-600 dark:border-yellow-400">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertTitle>Coverage Below Threshold</AlertTitle>
          <AlertDescription>
            Coverage is {coveragePercentage}%, below the {threshold}% threshold.
            Consider assigning additional staff to fill gaps.
          </AlertDescription>
        </Alert>
      )}

      {/* Critical gaps (no staff at all) */}
      {criticalGaps.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {criticalGaps.length} Critical Gap{criticalGaps.length !== 1 ? 's' : ''}
          </AlertTitle>
          <AlertDescription>
            <div className="space-y-2 mt-2">
              <p>The following days have no staff assigned:</p>
              <div className="flex flex-wrap gap-2">
                {criticalGaps.slice(0, 5).map((gap, index) => (
                  <Badge key={`${gap.teamId}-${gap.date}-${index}`} variant="destructive">
                    {gap.teamName}: {new Date(gap.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Badge>
                ))}
                {criticalGaps.length > 5 && (
                  <Badge variant="outline">+{criticalGaps.length - 5} more</Badge>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Warning gaps (understaffed) */}
      {warningGaps.length > 0 && criticalGaps.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>
            {warningGaps.length} Understaffed Day{warningGaps.length !== 1 ? 's' : ''}
          </AlertTitle>
          <AlertDescription>
            Some days are below minimum staffing requirements but have partial coverage.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
