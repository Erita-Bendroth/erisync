import React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DateHeaderRowProps {
  dates: string[];
}

export const DateHeaderRow: React.FC<DateHeaderRowProps> = ({ dates }) => {
  const isLongRange = dates.length > 14;
  
  return (
    <div className="grid grid-cols-[200px_auto] border-t border-border bg-muted/50 sticky top-0 z-10">
      <div className="px-4 py-3 border-r border-border font-semibold text-sm">
        Team Member
      </div>
      <div 
        className="grid gap-0" 
        style={{ 
          gridTemplateColumns: `repeat(${dates.length}, ${isLongRange ? '60px' : 'minmax(80px, 1fr)'})` 
        }}
      >
        {dates.map((date) => {
          const dateObj = new Date(date + 'T00:00:00');
          const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
          
          return (
            <div 
              key={date} 
              className={cn(
                "flex flex-col items-center justify-center px-2 py-3 border-r border-border",
                isWeekend && "bg-muted"
              )}
            >
              <div className="text-xs font-semibold">
                {format(dateObj, 'EEE')}
              </div>
              <div className="text-xs text-muted-foreground">
                {format(dateObj, 'MMM d')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
