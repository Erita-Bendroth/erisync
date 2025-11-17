import { useState, useEffect } from 'react';
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
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Users, Check, X, Loader2 } from 'lucide-react';
import { useScheduleAccessControl } from '@/hooks/useScheduleAccessControl';
import { cn } from '@/lib/utils';

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

export function IntegratedPlanningCalendar({ onScheduleUpdate }: IntegratedPlanningCalendarProps) {
  const { user } = useAuth();
  const [partnerships, setPartnerships] = useState<PlanningPartnership[]>([]);
  const [selectedPartnershipId, setSelectedPartnershipId] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(false);
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

  const { isAdmin, isPlanner, isManager, editableTeams } = useScheduleAccessControl({ viewMode: 'standard' });

  useEffect(() => {
    if (user) {
      fetchPartnerships();
    }
  }, [user]);

  useEffect(() => {
    if (selectedPartnershipId) {
      fetchPartnershipData();
    }
  }, [selectedPartnershipId, currentWeekStart]);

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

      // Fetch team members
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select(`
          user_id,
          team_id,
          profiles!user_id(first_name, last_name)
        `)
        .in('team_id', partnership.team_ids);

      if (membersError) throw membersError;

      // Fetch schedule entries
      const weekEnd = addDays(currentWeekStart, 6);
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedule_entries')
        .select('id, date, user_id, team_id, availability_status, activity_type, shift_type, notes')
        .in('team_id', partnership.team_ids)
        .gte('date', format(currentWeekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'));

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

  const canScheduleUser = (userId: string, teamId: string): boolean => {
    if (isAdmin || isPlanner) return true;
    if (isManager && editableTeams.has(teamId)) return true;
    return userId === user?.id;
  };

  const handleCellClick = (userId: string, date: Date, teamId: string) => {
    if (!canScheduleUser(userId, teamId)) return;

    const member = teamMembers.find(m => m.user_id === userId);
    if (!member) return;

    const userName = `${member.profiles.first_name} ${member.profiles.last_name}`;
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
    setCurrentWeekStart(prev => addDays(prev, -7));
  };

  const nextWeek = () => {
    setCurrentWeekStart(prev => addDays(prev, 7));
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  if (partnerships.length === 0) {
    return null; // Hide if no partnerships
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
            <div className="flex items-center justify-between">
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

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={previousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[200px] text-center">
                  {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
                </span>
                <Button variant="outline" size="sm" onClick={nextWeek}>
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
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 font-medium">Team Member</th>
                      {weekDays.map(day => (
                        <th key={day.toISOString()} className="text-center p-3 font-medium min-w-[100px]">
                          <div className="text-xs text-muted-foreground">
                            {format(day, 'EEE')}
                          </div>
                          <div className="text-sm">
                            {format(day, 'MMM d')}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map(member => {
                      const availability = getAvailabilityForUserAndDate(member.user_id, member.team_id, weekDays[0]);
                      const isSchedulable = canScheduleUser(member.user_id, member.team_id);
                      
                      return (
                        <tr key={`${member.user_id}-${member.team_id}`} className="border-b border-border hover:bg-muted/50">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {member.profiles.first_name} {member.profiles.last_name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {teamNames.get(member.team_id) || 'Unknown Team'}
                              </Badge>
                            </div>
                          </td>
                          {weekDays.map(day => {
                            const availability = getAvailabilityForUserAndDate(member.user_id, member.team_id, day);
                            const isSchedulable = canScheduleUser(member.user_id, member.team_id);
                            
                            return (
                              <td
                                key={day.toISOString()}
                                className={cn(
                                  "border border-border p-2 text-center transition-colors",
                                  isSchedulable && "cursor-pointer hover:bg-primary/5",
                                  !isSchedulable && "cursor-default",
                                  availability === 'available' && "bg-green-50 dark:bg-green-950/20",
                                  availability === 'unavailable' && "bg-red-50 dark:bg-red-950/20"
                                )}
                                onClick={() => {
                                  if (isSchedulable) {
                                    handleCellClick(member.user_id, day, member.team_id);
                                  }
                                }}
                              >
                                {availability === 'available' && (
                                  <Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" />
                                )}
                                {availability === 'unavailable' && (
                                  <X className="h-5 w-5 text-red-600 dark:text-red-400 mx-auto" />
                                )}
                                {!availability && (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
