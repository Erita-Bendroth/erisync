import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface YearSelectionStepProps {
  selectedYear: number;
  selectedCountry: string;
  onSelectYear: (year: number) => void;
}

export const YearSelectionStep: React.FC<YearSelectionStepProps> = ({
  selectedYear,
  onSelectYear,
}) => {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <Calendar className="h-12 w-12 mx-auto text-primary mb-3" />
        <h3 className="text-lg font-semibold">Select Year</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which year to import holidays for
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
        {years.map((year) => {
          const isCurrent = year === currentYear;
          const isSelected = year === selectedYear;

          return (
            <Card
              key={year}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                isSelected && "ring-2 ring-primary bg-accent"
              )}
              onClick={() => onSelectYear(year)}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <span className="text-3xl font-bold">{year}</span>
                    {isSelected && (
                      <CheckCircle2 className="absolute -top-2 -right-6 h-5 w-5 text-primary" />
                    )}
                  </div>
                  {isCurrent && (
                    <Badge variant="secondary" className="text-xs">
                      Current Year
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground text-center">
          💡 <strong>Tip:</strong> You can import holidays for future years to plan ahead
        </p>
      </div>
    </div>
  );
};
