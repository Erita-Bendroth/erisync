import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Calendar } from 'lucide-react';

export type DateRangeType = 'week' | '2weeks' | 'month' | 'quarter' | '6months' | 'year';

interface DateRangeSelectorProps {
  startDate: Date;
  onStartDateChange: (date: Date | undefined) => void;
  rangeType: DateRangeType;
  onRangeTypeChange: (type: DateRangeType) => void;
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  startDate,
  onStartDateChange,
  rangeType,
  onRangeTypeChange,
}) => {
  return (
    <div className="flex items-center gap-3">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Label className="text-sm font-medium">View:</Label>
      <Select value={rangeType} onValueChange={onRangeTypeChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="week">1 Week (7 days)</SelectItem>
          <SelectItem value="2weeks">2 Weeks (14 days)</SelectItem>
          <SelectItem value="month">1 Month (30 days)</SelectItem>
          <SelectItem value="quarter">1 Quarter (90 days)</SelectItem>
          <SelectItem value="6months">6 Months (180 days)</SelectItem>
          <SelectItem value="year">1 Year (365 days)</SelectItem>
        </SelectContent>
      </Select>
      
      <Label className="text-sm font-medium">Start:</Label>
      <DatePicker
        date={startDate}
        onDateChange={onStartDateChange}
        placeholder="Select start date"
      />
    </div>
  );
};

export const getDaysCount = (type: DateRangeType): number => {
  switch (type) {
    case 'week': return 7;
    case '2weeks': return 14;
    case 'month': return 30;
    case 'quarter': return 90;
    case '6months': return 180;
    case 'year': return 365;
  }
};
