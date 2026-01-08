import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Search, Check, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, addMonths, endOfYear } from 'date-fns';

export interface MyShift {
  entryId: string;
  date: string;
  shiftType: string;
  teamId: string;
  teamName: string;
}

interface MyShiftSelectorProps {
  currentUserId: string;
  teamIds: string[];
  selectedShift: MyShift | null;
  onSelectShift: (shift: MyShift | null) => void;
}

type DateRange = '7' | '14' | '30' | '90' | '180' | 'year';

export function MyShiftSelector({ 
  currentUserId, 
  teamIds, 
  selectedShift, 
  onSelectShift 
}: MyShiftSelectorProps) {
  const [loading, setLoading] = useState(true);
  const [myShifts, setMyShifts] = useState<MyShift[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [shiftTypeFilter, setShiftTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>('30');

  useEffect(() => {
    fetchMyShifts();
  }, [currentUserId, teamIds, dateRange]);

  const getEndDate = () => {
    const today = new Date();
    switch (dateRange) {
      case '7': return addDays(today, 7);
      case '14': return addDays(today, 14);
      case '30': return addDays(today, 30);
      case '90': return addMonths(today, 3);
      case '180': return addMonths(today, 6);
      case 'year': return endOfYear(today);
      default: return addDays(today, 30);
    }
  };

  const fetchMyShifts = async () => {
    if (!currentUserId || teamIds.length === 0) return;
    
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const endDate = format(getEndDate(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('schedule_entries')
        .select(`
          id,
          date,
          shift_type,
          team_id,
          teams:team_id (name)
        `)
        .eq('user_id', currentUserId)
        .in('team_id', teamIds)
        .gte('date', today)
        .lte('date', endDate)
        .in('shift_type', ['normal', 'early', 'late', 'weekend'])
        .order('date', { ascending: true });

      if (error) throw error;

      const shifts: MyShift[] = (data || []).map((entry: any) => ({
        entryId: entry.id,
        date: entry.date,
        shiftType: entry.shift_type,
        teamId: entry.team_id,
        teamName: entry.teams?.name || 'Unknown Team',
      }));

      setMyShifts(shifts);
    } catch (error) {
      console.error('Error fetching my shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredShifts = myShifts.filter(shift => {
    const matchesSearch = shift.teamName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = shiftTypeFilter === 'all' || shift.shiftType === shiftTypeFilter;
    return matchesSearch && matchesType;
  });

  const groupedByDate = filteredShifts.reduce((acc, shift) => {
    if (!acc[shift.date]) acc[shift.date] = [];
    acc[shift.date].push(shift);
    return acc;
  }, {} as Record<string, MyShift[]>);

  const getShiftTypeColor = (type: string) => {
    switch (type) {
      case 'early': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'late': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
      case 'weekend': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select which of your shifts you want to swap or offer
      </p>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by team..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={shiftTypeFilter} onValueChange={setShiftTypeFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Shift type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="early">Early</SelectItem>
            <SelectItem value="late">Late</SelectItem>
            <SelectItem value="weekend">Weekend</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Next 7 days</SelectItem>
            <SelectItem value="14">Next 14 days</SelectItem>
            <SelectItem value="30">Next 30 days</SelectItem>
            <SelectItem value="90">Next 3 months</SelectItem>
            <SelectItem value="180">Next 6 months</SelectItem>
            <SelectItem value="year">Rest of year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Shifts List */}
      <div className="max-h-[350px] overflow-y-auto space-y-4 pr-1">
        {Object.keys(groupedByDate).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No shifts found in this date range</p>
          </div>
        ) : (
          Object.entries(groupedByDate).map(([date, shifts]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {format(new Date(date), 'EEEE, MMM d, yyyy')}
                </span>
              </div>
              <div className="grid gap-2">
                {shifts.map((shift) => (
                  <Card
                    key={shift.entryId}
                    className={`p-3 cursor-pointer transition-all hover:border-primary ${
                      selectedShift?.entryId === shift.entryId
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : ''
                    }`}
                    onClick={() => onSelectShift(
                      selectedShift?.entryId === shift.entryId ? null : shift
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={getShiftTypeColor(shift.shiftType)}>
                          <Clock className="h-3 w-3 mr-1" />
                          {shift.shiftType}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {shift.teamName}
                        </div>
                      </div>
                      {selectedShift?.entryId === shift.entryId && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedShift && (
        <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
          <p className="text-sm font-medium">Selected shift:</p>
          <p className="text-sm text-muted-foreground">
            {format(new Date(selectedShift.date), 'EEEE, MMM d')} • {selectedShift.shiftType} shift • {selectedShift.teamName}
          </p>
        </div>
      )}
    </div>
  );
}
