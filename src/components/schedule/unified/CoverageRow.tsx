import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface CoverageRowProps {
  dates: string[];
  teamSize: number;
  scheduledCounts: Record<string, number>;
}

export const CoverageRow: React.FC<CoverageRowProps> = ({
  dates,
  teamSize,
  scheduledCounts,
}) => {
  const getCoverageLevel = (count: number, total: number): 'good' | 'medium' | 'low' | 'critical' => {
    const percentage = (count / total) * 100;
    if (percentage >= 70) return 'good';
    if (percentage >= 50) return 'medium';
    if (percentage >= 30) return 'low';
    return 'critical';
  };

  return (
    <div className="grid grid-cols-[200px_1fr] border-t-2 border-border bg-muted/50">
      <div className="flex items-center px-4 py-2 font-semibold text-sm border-r border-border">
        Coverage
      </div>
      <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(80px, 1fr))` }}>
        {dates.map((date) => {
          const count = scheduledCounts[date] || 0;
          const level = getCoverageLevel(count, teamSize);
          
          return (
            <div
              key={date}
              className={cn(
                'flex items-center justify-center px-2 py-2 border-r border-border text-xs font-medium',
                level === 'critical' && 'bg-destructive/20 text-destructive',
                level === 'low' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
                level === 'medium' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
                level === 'good' && 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
              )}
            >
              <span className="mr-1">
                {level === 'good' ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <AlertCircle className="h-3 w-3" />
                )}
              </span>
              {count}/{teamSize}
            </div>
          );
        })}
      </div>
    </div>
  );
};
