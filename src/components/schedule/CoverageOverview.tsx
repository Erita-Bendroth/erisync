import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Download } from 'lucide-react';
import { CoverageAnalysis } from '@/hooks/useCoverageAnalysis';
import { format } from 'date-fns';

interface CoverageOverviewProps {
  analysis: CoverageAnalysis;
  onExportGaps?: () => void;
}

export function CoverageOverview({ analysis, onExportGaps }: CoverageOverviewProps) {
  const { coveragePercentage, gaps, belowThreshold, totalDays, coveredDays, threshold, isLoading } = analysis;

  const getCoverageColor = () => {
    if (coveragePercentage >= threshold) return 'text-green-600 dark:text-green-400';
    if (coveragePercentage >= threshold - 10) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getCoverageStatus = () => {
    if (coveragePercentage >= threshold) return 'Excellent';
    if (coveragePercentage >= threshold - 10) return 'Needs Attention';
    return 'Critical';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Coverage Analysis</CardTitle>
          <CardDescription>Analyzing schedule coverage...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-20 bg-muted animate-pulse rounded" />
            <div className="h-40 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Coverage Analysis</CardTitle>
            <CardDescription>
              {coveredDays} of {totalDays} days covered
            </CardDescription>
          </div>
          {gaps.length > 0 && onExportGaps && (
            <Button variant="outline" size="sm" onClick={onExportGaps}>
              <Download className="w-4 h-4 mr-2" />
              Export Gaps
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Coverage Percentage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Coverage</span>
            <span className={`text-2xl font-bold ${getCoverageColor()}`}>
              {coveragePercentage}%
            </span>
          </div>
          <Progress value={coveragePercentage} className="h-3" />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Threshold: {threshold}%</span>
            <Badge variant={belowThreshold ? 'destructive' : 'default'}>
              {getCoverageStatus()}
            </Badge>
          </div>
        </div>

        {/* Alert if below threshold */}
        {belowThreshold && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Coverage is below the {threshold}% threshold. {gaps.length} gap{gaps.length !== 1 ? 's' : ''} detected.
            </AlertDescription>
          </Alert>
        )}

        {/* No gaps message */}
        {gaps.length === 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              All shifts are adequately covered for the selected period.
            </AlertDescription>
          </Alert>
        )}

        {/* Coverage Gaps List */}
        {gaps.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Coverage Gaps</h4>
            <div className="max-h-64 overflow-y-auto space-y-2 border rounded-md p-3">
              {gaps.map((gap, index) => (
                <div
                  key={`${gap.teamId}-${gap.date}-${index}`}
                  className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                >
                  <div className="space-y-1 flex-1">
                    <div className="font-medium">
                      {format(new Date(gap.date), 'EEE, MMM d, yyyy')}
                    </div>
                    <div className="text-xs text-muted-foreground">{gap.teamName}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {gap.isHoliday && (
                      <Badge variant="outline" className="text-xs">
                        Holiday
                      </Badge>
                    )}
                    {gap.isWeekend && (
                      <Badge variant="outline" className="text-xs">
                        Weekend
                      </Badge>
                    )}
                    <Badge variant="destructive" className="text-xs">
                      Need {gap.deficit} more
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold">{totalDays}</div>
            <div className="text-xs text-muted-foreground">Total Days</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{coveredDays}</div>
            <div className="text-xs text-muted-foreground">Covered</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{gaps.length}</div>
            <div className="text-xs text-muted-foreground">Gaps</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
