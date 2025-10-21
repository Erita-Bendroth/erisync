import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Moon, Calendar, PartyPopper, Briefcase } from 'lucide-react';
import { ShiftCounts } from '@/hooks/useShiftCounts';

interface ShiftCountsDisplayProps {
  shiftCounts: ShiftCounts;
  variant?: 'inline' | 'badge' | 'detailed';
  className?: string;
}

export const ShiftCountsDisplay = ({ 
  shiftCounts, 
  variant = 'inline',
  className = ''
}: ShiftCountsDisplayProps) => {
  const { weekend_shifts_count, night_shifts_count, holiday_shifts_count, total_shifts_count } = shiftCounts;

  if (variant === 'badge') {
    return (
      <TooltipProvider>
        <div className={`flex items-center gap-1 ${className}`}>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                <Calendar className="h-3 w-3" />
                {weekend_shifts_count}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Weekend Shifts</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                <Moon className="h-3 w-3" />
                {night_shifts_count}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Night Shifts</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                <PartyPopper className="h-3 w-3" />
                {holiday_shifts_count}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Holiday Shifts</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Weekend Shifts
          </span>
          <span className="font-semibold">{weekend_shifts_count}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Moon className="h-4 w-4" />
            Night Shifts
          </span>
          <span className="font-semibold">{night_shifts_count}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <PartyPopper className="h-4 w-4" />
            Holiday Shifts
          </span>
          <span className="font-semibold">{holiday_shifts_count}</span>
        </div>
        <div className="flex items-center justify-between text-sm border-t pt-2">
          <span className="flex items-center gap-2 font-medium">
            <Briefcase className="h-4 w-4" />
            Total Work Shifts
          </span>
          <span className="font-bold">{total_shifts_count}</span>
        </div>
      </div>
    );
  }

  // Inline variant
  return (
    <TooltipProvider>
      <div className={`flex items-center gap-2 text-xs ${className}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 cursor-help">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{weekend_shifts_count}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Weekend Shifts</TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 cursor-help">
              <Moon className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{night_shifts_count}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Night/Late Shifts</TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 cursor-help">
              <PartyPopper className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{holiday_shifts_count}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Holiday Shifts</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
