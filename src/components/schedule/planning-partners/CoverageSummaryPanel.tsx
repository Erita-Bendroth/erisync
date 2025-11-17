import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailyCoverage {
  date: Date;
  available: number;
  unavailable: number;
  total: number;
}

interface CoverageSummaryPanelProps {
  totalMembers: number;
  dailyCoverage: DailyCoverage[];
  weekStart: Date;
}

export function CoverageSummaryPanel({ totalMembers, dailyCoverage, weekStart }: CoverageSummaryPanelProps) {
  const getCoverageLevel = (available: number, total: number) => {
    const percentage = (available / total) * 100;
    if (percentage >= 80) return 'good';
    if (percentage >= 50) return 'medium';
    return 'low';
  };

  const getCoverageColor = (level: string) => {
    switch (level) {
      case 'good': return 'text-green-600 dark:text-green-400';
      case 'medium': return 'text-amber-600 dark:text-amber-400';
      case 'low': return 'text-red-600 dark:text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const getCoverageIcon = (level: string) => {
    switch (level) {
      case 'good': return <CheckCircle className="h-4 w-4" />;
      case 'medium': return <TrendingUp className="h-4 w-4" />;
      case 'low': return <AlertTriangle className="h-4 w-4" />;
      default: return null;
    }
  };

  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  return (
    <Card className="bg-muted/50 border-2">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">
            Week Coverage: {format(weekStart, 'MMM dd')} - {format(weekEndDate, 'MMM dd, yyyy')}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total Members</p>
              <p className="text-2xl font-bold">{totalMembers}</p>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">Daily Coverage</p>
            <div className="grid grid-cols-5 gap-2">
              {dailyCoverage.slice(0, 5).map((day, index) => {
                const level = getCoverageLevel(day.available, day.total);
                return (
                  <div
                    key={index}
                    className={cn(
                      "p-2 rounded-lg border text-center transition-colors",
                      level === 'good' && "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900",
                      level === 'medium' && "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900",
                      level === 'low' && "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900"
                    )}
                  >
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {getCoverageIcon(level)}
                      <p className="text-xs font-medium">{format(day.date, 'EEE')}</p>
                    </div>
                    <p className={cn("text-lg font-bold", getCoverageColor(level))}>
                      {day.available}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      of {day.total}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
