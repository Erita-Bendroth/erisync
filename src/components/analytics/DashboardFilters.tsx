import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, RefreshCw } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface DashboardFiltersProps {
  selectedTeams: string[];
  availableTeams: { id: string; name: string }[];
  onTeamsChange: (teams: string[]) => void;
  dateRange: { start: Date; end: Date };
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const DashboardFilters = ({
  selectedTeams,
  availableTeams,
  onTeamsChange,
  dateRange,
  onDateRangeChange,
  onRefresh,
  isLoading,
}: DashboardFiltersProps) => {
  const [startDate, setStartDate] = useState<Date>(dateRange.start);
  const [endDate, setEndDate] = useState<Date>(dateRange.end);

  const handlePresetChange = (preset: string) => {
    const end = new Date();
    let start = new Date();

    switch (preset) {
      case '7':
        start = subDays(end, 7);
        break;
      case '30':
        start = subDays(end, 30);
        break;
      case '60':
        start = subDays(end, 60);
        break;
      case '90':
        start = subDays(end, 90);
        break;
    }

    setStartDate(start);
    setEndDate(end);
    onDateRangeChange({ start, end });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            {/* Team Selection */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Team:</label>
              <Select
                value={selectedTeams[0] || ''}
                onValueChange={(value) => onTeamsChange([value])}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {availableTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Presets */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Period:</label>
              <Select onValueChange={handlePresetChange} defaultValue="30">
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="60">Last 60 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range */}
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('justify-start text-left font-normal')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: startDate, to: endDate }}
                    onSelect={(range) => {
                      if (range?.from) setStartDate(range.from);
                      if (range?.to) {
                        setEndDate(range.to);
                        if (range.from) {
                          onDateRangeChange({ start: range.from, end: range.to });
                        }
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
