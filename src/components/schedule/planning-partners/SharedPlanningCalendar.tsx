import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Check, X } from 'lucide-react';

interface PlanningPartnership {
  id: string;
  partnership_name: string;
  team_ids: string[];
}

interface TeamMember {
  user_id: string;
  team_id: string;
  profiles: {
    first_name: string;
    last_name: string;
  };
}

interface ScheduleEntry {
  date: string;
  user_id: string;
  availability_status: 'available' | 'unavailable';
}

type DateRangeType = '1M' | '3M' | '6M' | '1Y';

export function SharedPlanningCalendar() {
  const { user } = useAuth();
  const [partnerships, setPartnerships] = useState<PlanningPartnership[]>([]);
  const [selectedPartnershipId, setSelectedPartnershipId] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>('1M');
  const [loading, setLoading] = useState(false);

  const getDaysCount = (range: DateRangeType): number => {
    switch (range) {
      case '1M': return 30;
      case '3M': return 90;
      case '6M': return 180;
      case '1Y': return 365;
    }
  };

  useEffect(() => {
    if (user) {
      fetchPartnerships();
    }
  }, [user]);

  useEffect(() => {
    if (selectedPartnershipId) {
      fetchPartnershipData();
    }
  }, [selectedPartnershipId, currentWeekStart, dateRangeType]);

  const fetchPartnerships = async () => {
    try {
      const { data, error } = await supabase
        .from('team_planning_partners')
        .select('*')
        .order('partnership_name');

      if (error) throw error;
      setPartnerships(data || []);
      
      if (data && data.length > 0) {
        setSelectedPartnershipId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching partnerships:', error);
      toast.error('Failed to load planning partnerships');
    }
  };

  const fetchPartnershipData = async () => {
    const partnership = partnerships.find(p => p.id === selectedPartnershipId);
    if (!partnership) return;

    setLoading(true);
    try {
      // Fetch team members from all teams in the partnership
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select(`
          user_id,
          team_id,
          profiles!user_id(first_name, last_name)
        `)
        .in('team_id', partnership.team_ids);

      if (membersError) throw membersError;

      // Fetch schedule entries for the selected date range (availability only)
      const daysCount = getDaysCount(dateRangeType);
      const rangeEnd = addDays(currentWeekStart, daysCount - 1);
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedule_entries')
        .select('date, user_id, availability_status')
        .in('team_id', partnership.team_ids)
        .gte('date', format(currentWeekStart, 'yyyy-MM-dd'))
        .lte('date', format(rangeEnd, 'yyyy-MM-dd'));

      if (scheduleError) throw scheduleError;

      setTeamMembers(membersData || []);
      setScheduleEntries(scheduleData || []);
    } catch (error) {
      console.error('Error fetching partnership data:', error);
      toast.error('Failed to load partnership schedule');
    } finally {
      setLoading(false);
    }
  };

  const getAvailabilityForUserAndDate = (userId: string, date: Date): 'available' | 'unavailable' | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const entry = scheduleEntries.find(
      e => e.user_id === userId && e.date === dateStr
    );
    return entry ? entry.availability_status : null;
  };

  const selectedPartnership = partnerships.find(p => p.id === selectedPartnershipId);
  
  // Generate days array based on date range
  const daysCount = getDaysCount(dateRangeType);
  const displayDays = Array.from({ length: daysCount }, (_, i) => addDays(currentWeekStart, i));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Shared Planning Calendar
              </CardTitle>
              <CardDescription>
                View availability across partner teams without seeing activity details
              </CardDescription>
            </div>
            {partnerships.length > 0 && (
              <Select value={selectedPartnershipId} onValueChange={setSelectedPartnershipId}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select partnership" />
                </SelectTrigger>
                <SelectContent>
                  {partnerships.map(partnership => (
                    <SelectItem key={partnership.id} value={partnership.id}>
                      {partnership.partnership_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {partnerships.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No planning partnerships available</p>
              <p className="text-sm mt-2">Ask your manager to create a planning partnership</p>
            </div>
          ) : (
            <>
              {/* Date Range Selector */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">Timeframe:</span>
                  <div className="flex rounded-lg border bg-muted p-1">
                    {(['1M', '3M', '6M', '1Y'] as DateRangeType[]).map(range => (
                      <Button
                        key={range}
                        variant={dateRangeType === range ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setDateRangeType(range)}
                      >
                        {range}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -daysCount))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="font-medium">
                    {format(currentWeekStart, 'MMM d, yyyy')} - {format(displayDays[displayDays.length - 1], 'MMM d, yyyy')}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentWeekStart(addDays(currentWeekStart, daysCount))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-border p-2 text-left bg-muted/50 font-medium sticky left-0 bg-background z-10">
                          Team Member
                        </th>
                        {displayDays.map(day => (
                          <th
                            key={day.toISOString()}
                            className={`border border-border p-2 text-center bg-muted/50 font-medium min-w-[60px] ${
                              isSameDay(day, new Date()) ? 'bg-primary/10' : ''
                            }`}
                          >
                            <div className="text-xs">{format(day, 'EEE')}</div>
                            <div>{format(day, 'MMM d')}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map(member => (
                        <tr key={member.user_id}>
                          <td className="border border-border p-2 font-medium sticky left-0 bg-background z-10">
                            {member.profiles.first_name} {member.profiles.last_name}
                          </td>
                          {displayDays.map(day => {
                            const availability = getAvailabilityForUserAndDate(member.user_id, day);
                            return (
                              <td
                                key={day.toISOString()}
                                className={`border border-border p-2 text-center ${
                                  isSameDay(day, new Date()) ? 'bg-primary/5' : ''
                                }`}
                              >
                                {availability === 'available' && (
                                  <Check className="h-5 w-5 mx-auto text-green-600" />
                                )}
                                {availability === 'unavailable' && (
                                  <X className="h-5 w-5 mx-auto text-red-600" />
                                )}
                                {availability === null && (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4 text-red-600" />
                  <span>Unavailable</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">-</span>
                  <span>No entry</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
