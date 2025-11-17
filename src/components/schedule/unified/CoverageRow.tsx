import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TeamBreakdown {
  teamName: string;
  count: number;
  total: number;
  color: string;
}

interface CoverageRowProps {
  dates: string[];
  teamSize: number;
  scheduledCounts: Record<string, number>;
  teamBreakdowns?: Record<string, TeamBreakdown[]>;
  partnershipMode?: boolean;
  partnershipConfig?: {
    min_staff_required: number;
    max_staff_allowed?: number | null;
  };
}

export const CoverageRow: React.FC<CoverageRowProps> = ({
  dates,
  teamSize,
  scheduledCounts,
  teamBreakdowns,
  partnershipMode,
  partnershipConfig,
}) => {
  const getCoverageLevel = (count: number, total: number): 'good' | 'medium' | 'low' | 'critical' => {
    if (partnershipMode && partnershipConfig) {
      // Use partnership threshold
      const min = partnershipConfig.min_staff_required;
      if (count >= min) return 'good';
      if (count >= min * 0.8) return 'medium';
      if (count >= min * 0.5) return 'low';
      return 'critical';
    } else {
      // Use percentage-based logic (existing)
      const percentage = (count / total) * 100;
      if (percentage >= 70) return 'good';
      if (percentage >= 50) return 'medium';
      if (percentage >= 30) return 'low';
      return 'critical';
    }
  };

  return (
    <TooltipProvider>
      <div className="grid grid-cols-[200px_1fr] border-t-2 border-border bg-muted/50">
        <div className="flex items-center px-4 py-2 font-semibold text-sm border-r border-border">
          Coverage
        </div>
        <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(80px, 1fr))` }}>
          {dates.map((date) => {
            const count = scheduledCounts[date] || 0;
            const level = getCoverageLevel(count, teamSize);
            const breakdown = teamBreakdowns?.[date];
            
            return (
              <div
                key={date}
                className={cn(
                  'flex items-center justify-center px-2 py-2 border-r border-border text-xs font-medium gap-1',
                  level === 'critical' && 'bg-destructive/20 text-destructive',
                  level === 'low' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
                  level === 'medium' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
                  level === 'good' && 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                )}
              >
                <span>
                  {level === 'good' ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                </span>
                <span>
                  {count}/{teamSize}
                  {partnershipMode && partnershipConfig && (
                    <span className="text-[10px] opacity-75 ml-1">
                      (Min: {partnershipConfig.min_staff_required})
                    </span>
                  )}
                </span>
                {breakdown && breakdown.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        {breakdown.map((team) => (
                          <div key={team.teamName} className="flex items-center gap-2 text-xs">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: team.color }}
                            />
                            <span>{team.teamName}: {team.count}/{team.total}</span>
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
};
