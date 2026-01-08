import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, addMonths, endOfYear, startOfDay, isSameDay } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, User, Clock, Users, Search, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface TargetShift {
  entryId: string;
  userId: string;
  userName: string;
  userInitials: string;
  date: string;
  shiftType: string;
  teamId: string;
  teamName: string;
}

interface SwapTargetSelectorProps {
  currentUserId: string;
  teamIds: string[];
  selectedShift: TargetShift | null;
  onSelectShift: (shift: TargetShift | null) => void;
}

const SHIFT_LABELS: Record<string, string> = {
  normal: 'Normal',
  early: 'Early',
  late: 'Late',
  night: 'Night',
  oncall: 'On-Call',
  weekend: 'Weekend',
  flex: 'Flex',
};

type DateRange = '7' | '14' | '30' | '90' | '180' | 'year';

export function SwapTargetSelector({
  currentUserId,
  teamIds,
  selectedShift,
  onSelectShift,
}: SwapTargetSelectorProps) {
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<TargetShift[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [shiftTypeFilter, setShiftTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>('30');

  useEffect(() => {
    fetchAvailableShifts();
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

  const fetchAvailableShifts = async () => {
    if (!teamIds.length) {
      setShifts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const today = startOfDay(new Date());
      const endDate = getEndDate();

      // Get shifts from team members (excluding current user)
      const { data: entries, error } = await supabase
        .from('schedule_entries')
        .select(`
          id,
          user_id,
          date,
          shift_type,
          team_id,
          availability_status,
          teams!inner(name)
        `)
        .in('team_id', teamIds)
        .neq('user_id', currentUserId)
        .gte('date', format(today, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .eq('availability_status', 'available')
        .in('shift_type', ['normal', 'early', 'late', 'weekend'])
        .order('date', { ascending: true });

      if (error) throw error;

      // Get user profiles for names
      const userIds = [...new Set((entries || []).map(e => e.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, initials')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const formattedShifts: TargetShift[] = (entries || []).map(entry => {
        const profile = profileMap.get(entry.user_id);
        return {
          entryId: entry.id,
          userId: entry.user_id,
          userName: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown',
          userInitials: profile?.initials || '??',
          date: entry.date,
          shiftType: entry.shift_type || 'normal',
          teamId: entry.team_id,
          teamName: (entry.teams as any)?.name || 'Unknown Team',
        };
      });

      setShifts(formattedShifts);
    } catch (error) {
      console.error('Error fetching available shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredShifts = shifts.filter(shift => {
    const matchesSearch = searchQuery === '' || 
      shift.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shift.teamName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesShiftType = shiftTypeFilter === 'all' || shift.shiftType === shiftTypeFilter;
    
    return matchesSearch && matchesShiftType;
  });

  // Group by date
  const groupedByDate = filteredShifts.reduce((acc, shift) => {
    if (!acc[shift.date]) acc[shift.date] = [];
    acc[shift.date].push(shift);
    return acc;
  }, {} as Record<string, TargetShift[]>);

  const shiftTypes = [...new Set(shifts.map(s => s.shiftType))];

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-3 text-sm">
        <p className="text-muted-foreground">
          <strong>Step 1:</strong> Select a colleague's shift that you'd like to take. 
          Only available work shifts are shown.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label className="sr-only">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        <Select value={shiftTypeFilter} onValueChange={setShiftTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Shift type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {shiftTypes.map(type => (
              <SelectItem key={type} value={type}>
                {SHIFT_LABELS[type] || type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
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

      {/* Shift list */}
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
        {Object.keys(groupedByDate).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No available shifts found in the selected range.</p>
            <p className="text-sm">Try expanding the date range or adjusting filters.</p>
          </div>
        ) : (
          Object.entries(groupedByDate).map(([date, dateShifts]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">
                  {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                </span>
                {isSameDay(new Date(date), new Date()) && (
                  <Badge variant="secondary" className="text-xs">Today</Badge>
                )}
              </div>
              
              <div className="grid gap-2 ml-6">
                {dateShifts.map(shift => {
                  const isSelected = selectedShift?.entryId === shift.entryId;
                  
                  return (
                    <Card
                      key={shift.entryId}
                      className={cn(
                        'cursor-pointer transition-all hover:border-primary/50',
                        isSelected && 'border-primary bg-primary/5 ring-1 ring-primary'
                      )}
                      onClick={() => onSelectShift(isSelected ? null : shift)}
                    >
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                            {shift.userInitials}
                          </div>
                          <div>
                            <p className="font-medium">{shift.userName}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{SHIFT_LABELS[shift.shiftType] || shift.shiftType}</span>
                              <span>•</span>
                              <span>{shift.teamName}</span>
                            </div>
                          </div>
                        </div>
                        
                        {isSelected && (
                          <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
