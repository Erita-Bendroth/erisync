import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format, startOfWeek, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Users, Loader2 } from 'lucide-react';
import { useScheduleAccessControl } from '@/hooks/useScheduleAccessControl';
import { cn } from '@/lib/utils';
import { CoverageSummaryPanel } from './CoverageSummaryPanel';
import { TeamSection } from './TeamSection';

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
  id?: string;
  date: string;
  user_id: string;
  team_id: string;
  availability_status: 'available' | 'unavailable';
  activity_type: string;
  shift_type: string;
  notes?: string;
}

interface IntegratedPlanningCalendarProps {
  onScheduleUpdate?: () => void;
  onCreatePartnership?: () => void;
}

interface QuickScheduleData {
  availability: 'available' | 'unavailable';
  shiftType: string;
  activityType: string;
  notes: string;
}

interface SelectedCell {
  userId: string;
  userName: string;
  date: Date;
  teamId: string;
}

export function IntegratedPlanningCalendar({ onScheduleUpdate, onCreatePartnership }: IntegratedPlanningCalendarProps) {
  const { user } = useAuth();
  const [partnerships, setPartnerships] = useState<PlanningPartnership[]>([]);
  const [selectedPartnershipId, setSelectedPartnershipId] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(false);
  type DateRangeType = '1M' | '3M' | '6M' | '1Y';
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>('1M');
  const [showPlanning, setShowPlanning] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [quickScheduleOpen, setQuickScheduleOpen] = useState(false);
  const [quickFormData, setQuickFormData] = useState<QuickScheduleData>({
    availability: 'available',
    shiftType: 'normal',
    activityType: 'work',
    notes: ''
  });
  const [teamNames, setTeamNames] = useState<Map<string, string>>(new Map());

  const { isAdmin, isPlanner, isManager, editableTeams, canViewActivityDetails } = useScheduleAccessControl({ viewMode: 'multi-team' });

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

  // Real-time subscription
  useEffect(() => {
    if (!selectedPartnershipId) return;
    
    const partnership = partnerships.find(p => p.id === selectedPartnershipId);
    if (!partnership) return;

    const channel = supabase
      .channel(`partnership-${selectedPartnershipId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'schedule_entries',
        filter: `team_id=in.(${partnership.team_ids.join(',')})`
      }, () => {
        console.log('Schedule changed, refreshing...');
        fetchPartnershipData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedPartnershipId, partnerships]);

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
        setShowPlanning(true); // Auto-expand if partnerships exist
      }
    } catch (error) {
      console.error('Error fetching partnerships:', error);
    }
  };

  const fetchPartnershipData = async () => {
    const partnership = partnerships.find(p => p.id === selectedPartnershipId);
    if (!partnership) return;

    setLoading(true);
    try {
      // Fetch team names
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', partnership.team_ids);

      if (teamsData) {
        const namesMap = new Map(teamsData.map(t => [t.id, t.name]));
        setTeamNames(namesMap);
      }

      // Fetch team members using RPC to bypass RLS
      const allMembers = [];
      for (const teamId of partnership.team_ids) {
        const { data, error } = await supabase
          .rpc('get_team_members_safe', { _team_id: teamId });
        
        if (error) {
          console.error(`Error fetching members for team ${teamId}:`, error);
          continue;
        }
        
        if (data) {
          // Map to expected structure
          const members = data.map(m => ({
            user_id: m.user_id,
            team_id: teamId,
            profiles: {
              first_name: m.first_name || m.initials || 'Unknown',
              last_name: m.last_name || '',
              initials: m.initials || '??'
            }
          }));
          allMembers.push(...members);
        }
      }

      // Fetch schedule entries
      const daysCount = getDaysCount(dateRangeType);
      const rangeEnd = addDays(currentWeekStart, daysCount - 1);
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedule_entries')
        .select('id, date, user_id, team_id, availability_status, activity_type, shift_type, notes')
        .in('team_id', partnership.team_ids)
        .gte('date', format(currentWeekStart, 'yyyy-MM-dd'))
        .lte('date', format(rangeEnd, 'yyyy-MM-dd'));

      if (scheduleError) throw scheduleError;

      console.log('Fetched team members:', allMembers.length);
      setTeamMembers(allMembers);
      setScheduleEntries(scheduleData || []);
    } catch (error) {
      console.error('Error fetching partnership data:', error);
      toast.error('Failed to load partnership schedule');
    } finally {
      setLoading(false);
    }
  };

  const canScheduleUser = (userId: string, teamId: string): boolean => {
    if (isAdmin || isPlanner) return true;
    if (isManager && editableTeams.has(teamId)) return true;
    return userId === user?.id;
  };

  const handleCellClick = (userId: string, date: Date, teamId: string) => {
    if (!canScheduleUser(userId, teamId)) return;

    const member = teamMembers.find(m => m.user_id === userId);
    if (!member || !member.profiles) return;

    const userName = member.profiles.first_name || 'Unknown';
    setSelectedCell({ userId, userName, date, teamId });
    
    // Pre-fill form with existing data if available
    const existing = scheduleEntries.find(
      e => e.user_id === userId && e.date === format(date, 'yyyy-MM-dd') && e.team_id === teamId
    );
    
    if (existing) {
      setQuickFormData({
        availability: existing.availability_status,
        shiftType: existing.shift_type || 'normal',
        activityType: existing.activity_type || 'work',
        notes: existing.notes || ''
      });
    } else {
      setQuickFormData({
        availability: 'available',
        shiftType: 'normal',
        activityType: 'work',
        notes: ''
      });
    }
    
    setQuickScheduleOpen(true);
  };

  const handleQuickSchedule = async () => {
    if (!selectedCell || !user) return;
    
    try {
      const scheduleEntry = {
        user_id: selectedCell.userId,
        team_id: selectedCell.teamId,
        date: format(selectedCell.date, 'yyyy-MM-dd'),
        availability_status: quickFormData.availability as 'available' | 'unavailable',
        activity_type: (quickFormData.availability === 'available' ? quickFormData.activityType : 'other') as 'work' | 'vacation' | 'other' | 'hotline_support' | 'out_of_office' | 'training' | 'flextime' | 'working_from_home',
        shift_type: (quickFormData.availability === 'available' ? quickFormData.shiftType : 'normal') as 'early' | 'late' | 'normal' | 'weekend',
        notes: quickFormData.notes,
        created_by: user.id
      };

      // Check if entry exists
      const { data: existing } = await supabase
        .from('schedule_entries')
        .select('id')
        .eq('user_id', selectedCell.userId)
        .eq('team_id', selectedCell.teamId)
        .eq('date', scheduleEntry.date)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('schedule_entries')
          .update(scheduleEntry)
          .eq('id', existing.id);
      } else {
        await supabase
          .from('schedule_entries')
          .insert([scheduleEntry]);
      }

      toast.success('Schedule updated successfully');
      setQuickScheduleOpen(false);
      fetchPartnershipData();
      onScheduleUpdate?.();
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error('Failed to update schedule');
    }
  };

  const getAvailabilityForUserAndDate = (userId: string, teamId: string, date: Date): 'available' | 'unavailable' | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const entry = scheduleEntries.find(
      e => e.user_id === userId && e.team_id === teamId && e.date === dateStr
    );
    return entry ? entry.availability_status : null;
  };

  const previousWeek = () => {
    const daysCount = getDaysCount(dateRangeType);
    setCurrentWeekStart(prev => addDays(prev, -daysCount));
  };

  const nextWeek = () => {
    const daysCount = getDaysCount(dateRangeType);
    setCurrentWeekStart(prev => addDays(prev, daysCount));
  };

  const daysCount = getDaysCount(dateRangeType);
  const displayDays = Array.from({ length: daysCount }, (_, i) => addDays(currentWeekStart, i));

  // Group members by team
  const teamGroups = useMemo(() => {
    const groups = new Map<string, TeamMember[]>();
    teamMembers.forEach(member => {
      const existing = groups.get(member.team_id) || [];
      groups.set(member.team_id, [...existing, member]);
    });
    return groups;
  }, [teamMembers]);

  // Calculate daily coverage for summary
  const dailyCoverage = useMemo(() => {
    return displayDays.slice(0, 5).map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayEntries = scheduleEntries.filter(e => e.date === dateStr);
      const available = dayEntries.filter(e => e.availability_status === 'available').length;
      const unavailable = dayEntries.filter(e => e.availability_status === 'unavailable').length;
      return {
        date,
        available,
        unavailable,
        total: teamMembers.length
      };
    });
  }, [displayDays, scheduleEntries, teamMembers]);

  // Team colors for visual distinction
  const teamColors = useMemo(() => {
    const colors = [
      'hsl(142, 76%, 36%)', // green
      'hsl(221, 83%, 53%)', // blue
      'hsl(262, 83%, 58%)', // purple
      'hsl(38, 92%, 50%)', // orange
      'hsl(346, 77%, 50%)', // pink
      'hsl(198, 93%, 60%)', // cyan
    ];
    const colorMap = new Map<string, string>();
    Array.from(teamGroups.keys()).forEach((teamId, index) => {
      colorMap.set(teamId, colors[index % colors.length]);
    });
    return colorMap;
  }, [teamGroups]);

  // Show empty state if no partnerships exist
  if (partnerships.length === 0) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Co-Planning Calendar</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">No Planning Partnerships Yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Planning partnerships allow multiple teams to coordinate schedules together, 
                seeing availability without compromising privacy on activity details.
              </p>
            </div>
            {isAdmin && (
              <Button variant="outline" onClick={onCreatePartnership}>
                <Users className="h-4 w-4 mr-2" />
                Create Your First Partnership
              </Button>
            )}
            {!isAdmin && (
              <p className="text-sm text-muted-foreground">
                Contact your administrator to set up co-planning partnerships.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedPartnership = partnerships.find(p => p.id === selectedPartnershipId);

  return (
    <>
      <Card className="border-primary/20">
        <CardHeader 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setShowPlanning(!showPlanning)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Co-Planning Calendar</CardTitle>
              <Badge variant="secondary">{partnerships.length} Partnership{partnerships.length !== 1 ? 's' : ''}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                View and schedule with partner teams
              </span>
              {showPlanning ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
          </div>
        </CardHeader>
        
        {showPlanning && (
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <Select value={selectedPartnershipId} onValueChange={setSelectedPartnershipId}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select partnership..." />
                </SelectTrigger>
                <SelectContent>
                  {partnerships.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.partnership_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
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
                <Button variant="outline" size="icon" onClick={previousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium min-w-[200px] text-center">
                  {format(currentWeekStart, 'MMM d, yyyy')} - {format(displayDays[displayDays.length - 1], 'MMM d, yyyy')}
                </div>
                <Button variant="outline" size="icon" onClick={nextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : teamMembers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No team members found in this partnership</p>
              </div>
            ) : (
              <div className="space-y-4">
              {/* Coverage Summary Panel - Only for managers/planners/admins */}
              {(isAdmin || isPlanner || isManager) && (
                <CoverageSummaryPanel
                  totalMembers={teamMembers.length}
                  dailyCoverage={dailyCoverage}
                  weekStart={currentWeekStart}
                />
              )}

                {/* Unified Scroll Container */}
                <div className="overflow-x-auto">
                  <div className="min-w-max">
                    {/* Week Headers - Sticky */}
                    <div className="sticky top-0 z-20 bg-background border-b pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-[200px] font-medium text-sm text-muted-foreground sticky left-0 z-10 bg-background">
                          Team / Member
                        </div>
                        <div className="flex gap-2">
                          {displayDays.map((day, index) => {
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                            return (
                              <div
                                key={index}
                                className={cn(
                                  "text-center p-2 rounded-lg border",
                                  isWeekend && "bg-muted/50"
                                )}
                              >
                                <div className="text-xs text-muted-foreground font-medium">
                                  {format(day, 'EEE')}
                                </div>
                                <div className="text-sm font-semibold">
                                  {format(day, 'MMM d')}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Team Sections with Vertical Scroll */}
                    <div className="max-h-[600px] overflow-y-auto">
                      <div className="space-y-3">
                        {Array.from(teamGroups.entries()).map(([teamId, members]) => {
                          console.log(`Rendering team ${teamNames.get(teamId)} (${teamId}) with ${members.length} members`);
                          return (
                            <TeamSection
                              key={teamId}
                              teamId={teamId}
                              teamName={teamNames.get(teamId) || 'Unknown Team'}
                              teamColor={teamColors.get(teamId) || 'hsl(var(--muted))'}
                              members={members}
                              scheduleEntries={scheduleEntries}
                              weekDates={displayDays}
                              onCellClick={handleCellClick}
                              canScheduleUser={canScheduleUser}
                              canViewActivityDetails={isAdmin || isPlanner || isManager}
                              currentUserId={user?.id || ''}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Quick Schedule Popover */}
      <Popover open={quickScheduleOpen} onOpenChange={setQuickScheduleOpen}>
        <PopoverContent className="w-80" align="center">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-1">Quick Schedule</h4>
              <p className="text-sm text-muted-foreground">
                {selectedCell?.userName} • {selectedCell && format(selectedCell.date, 'MMM d, yyyy')}
              </p>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label>Availability</Label>
                <Select 
                  value={quickFormData.availability} 
                  onValueChange={(v: 'available' | 'unavailable') => 
                    setQuickFormData({...quickFormData, availability: v})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">✅ Available</SelectItem>
                    <SelectItem value="unavailable">❌ Unavailable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {quickFormData.availability === 'available' && (
                <>
                  <div>
                    <Label>Shift Type</Label>
                    <Select 
                      value={quickFormData.shiftType} 
                      onValueChange={(v) => setQuickFormData({...quickFormData, shiftType: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal Shift</SelectItem>
                        <SelectItem value="early">Early Shift</SelectItem>
                        <SelectItem value="late">Late Shift</SelectItem>
                        <SelectItem value="weekend">Weekend Shift</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Activity</Label>
                    <Select 
                      value={quickFormData.activityType} 
                      onValueChange={(v) => setQuickFormData({...quickFormData, activityType: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="work">Work</SelectItem>
                        <SelectItem value="hotline_support">Hotline Support</SelectItem>
                        <SelectItem value="training">Training</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              
              {quickFormData.availability === 'unavailable' && (
                <div>
                  <Label>Reason (Optional)</Label>
                  <Textarea 
                    placeholder="e.g., Vacation, Training..."
                    value={quickFormData.notes}
                    onChange={(e) => setQuickFormData({...quickFormData, notes: e.target.value})}
                    rows={2}
                  />
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setQuickScheduleOpen(false)} 
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleQuickSchedule} className="flex-1">
                Save
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
