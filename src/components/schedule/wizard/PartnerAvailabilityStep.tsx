import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Users, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { format, eachDayOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import type { WizardData } from './BulkScheduleWizard';

interface PartnerAvailabilityStepProps {
  wizardData: WizardData;
  updateWizardData: (updates: Partial<WizardData>) => void;
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
  team_id: string;
  availability_status: 'available' | 'unavailable';
  shift_type: string;
}

interface DailyCoverage {
  date: Date;
  dateStr: string;
  available: number;
  unavailable: number;
  total: number;
  percentage: number;
  level: 'good' | 'medium' | 'low' | 'critical';
}

export function PartnerAvailabilityStep({ wizardData }: PartnerAvailabilityStepProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [partnerships, setPartnerships] = useState<any[]>([]);
  const [partnerTeamMembers, setPartnerTeamMembers] = useState<TeamMember[]>([]);
  const [partnerSchedules, setPartnerSchedules] = useState<ScheduleEntry[]>([]);
  const [dailyCoverage, setDailyCoverage] = useState<DailyCoverage[]>([]);
  const [hasPartnerships, setHasPartnerships] = useState(false);

  useEffect(() => {
    if (user && wizardData.selectedTeam && wizardData.startDate && wizardData.endDate) {
      fetchPartnerAvailability();
    }
  }, [user, wizardData.selectedTeam, wizardData.startDate, wizardData.endDate]);

  const fetchPartnerAvailability = async () => {
    setLoading(true);
    try {
      // Find partnerships that include the selected team
      const { data: partnershipData, error: partnershipError } = await supabase
        .from('team_planning_partners')
        .select('*')
        .contains('team_ids', [wizardData.selectedTeam]);

      if (partnershipError) throw partnershipError;

      if (!partnershipData || partnershipData.length === 0) {
        setHasPartnerships(false);
        setLoading(false);
        return;
      }

      setHasPartnerships(true);
      setPartnerships(partnershipData);

      // Get all partner team IDs (excluding the current team)
      const allPartnerTeamIds = new Set<string>();
      partnershipData.forEach(partnership => {
        partnership.team_ids.forEach((teamId: string) => {
          if (teamId !== wizardData.selectedTeam) {
            allPartnerTeamIds.add(teamId);
          }
        });
      });

      const partnerTeamIds = Array.from(allPartnerTeamIds);

      // Fetch partner team members
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select(`
          user_id,
          team_id,
          profiles!team_members_user_id_fkey(first_name, last_name)
        `)
        .in('team_id', partnerTeamIds);

      if (membersError) throw membersError;

      setPartnerTeamMembers(membersData || []);

      // Fetch schedules for the date range
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedule_entries')
        .select('date, user_id, team_id, availability_status, shift_type')
        .in('team_id', partnerTeamIds)
        .gte('date', format(wizardData.startDate!, 'yyyy-MM-dd'))
        .lte('date', format(wizardData.endDate!, 'yyyy-MM-dd'));

      if (scheduleError) throw scheduleError;

      setPartnerSchedules(scheduleData || []);

      // Calculate daily coverage
      calculateDailyCoverage(membersData || [], scheduleData || []);
    } catch (error) {
      console.error('Error fetching partner availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDailyCoverage = (members: TeamMember[], schedules: ScheduleEntry[]) => {
    if (!wizardData.startDate || !wizardData.endDate) return;

    const dateRange = eachDayOfInterval({
      start: wizardData.startDate,
      end: wizardData.endDate
    });

    // Filter out excluded days
    const filteredDates = dateRange.filter(date => 
      !wizardData.excludedDays.includes(date.getDay())
    );

    const coverage: DailyCoverage[] = filteredDates.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const daySchedules = schedules.filter(s => s.date === dateStr);
      
      const available = daySchedules.filter(s => s.availability_status === 'available').length;
      const unavailable = daySchedules.filter(s => s.availability_status === 'unavailable').length;
      const total = members.length;
      const percentage = total > 0 ? (available / total) * 100 : 0;

      let level: 'good' | 'medium' | 'low' | 'critical' = 'good';
      if (percentage < 30) level = 'critical';
      else if (percentage < 50) level = 'low';
      else if (percentage < 80) level = 'medium';

      return {
        date,
        dateStr,
        available,
        unavailable,
        total,
        percentage,
        level
      };
    });

    setDailyCoverage(coverage);
  };

  const getCoverageLevelColor = (level: string) => {
    switch (level) {
      case 'good': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900';
      case 'medium': return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900';
      case 'low': return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900';
      case 'critical': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900';
      default: return 'text-muted-foreground';
    }
  };

  const getCoverageIcon = (level: string) => {
    switch (level) {
      case 'good': return <CheckCircle className="h-4 w-4" />;
      case 'medium': return <Info className="h-4 w-4" />;
      case 'low': return <AlertTriangle className="h-4 w-4" />;
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      default: return null;
    }
  };

  const criticalDays = dailyCoverage.filter(d => d.level === 'critical');
  const lowDays = dailyCoverage.filter(d => d.level === 'low');
  const warningCount = criticalDays.length + lowDays.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasPartnerships) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Users className="h-6 w-6 text-primary" />
          <h3 className="text-lg font-semibold">Partner Team Availability</h3>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Your team is not part of any planning partnerships. Schedule generation will proceed without considering partner team coverage.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Users className="h-6 w-6 text-primary" />
          <h3 className="text-lg font-semibold">Partner Team Availability</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Review how your schedule will impact partner team coverage across {partnerships.length} partnership{partnerships.length !== 1 ? 's' : ''}.
        </p>
      </div>

      {/* Summary Alerts */}
      {warningCount > 0 && (
        <div className="space-y-2">
          {criticalDays.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Critical Coverage Alert:</strong> {criticalDays.length} day{criticalDays.length !== 1 ? 's' : ''} with less than 30% partner team availability. 
                Consider adjusting your schedule to avoid creating severe coverage gaps.
              </AlertDescription>
            </Alert>
          )}
          
          {lowDays.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Low Coverage Warning:</strong> {lowDays.length} day{lowDays.length !== 1 ? 's' : ''} with 30-50% partner team availability. 
                Your schedule may create coverage challenges for partner teams.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Coverage Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Partner Team Coverage ({partnerTeamMembers.length} total members)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {dailyCoverage.map((day, index) => (
              <div
                key={index}
                className={cn(
                  "p-3 rounded-lg border-2 transition-all",
                  getCoverageLevelColor(day.level)
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium">
                    {format(day.date, 'EEE')}
                  </div>
                  {getCoverageIcon(day.level)}
                </div>
                <div className="text-sm font-semibold mb-1">
                  {format(day.date, 'MMM d')}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>Available:</span>
                    <span className="font-medium">{day.available}/{day.total}</span>
                  </div>
                  <div className="text-xs font-semibold">
                    {Math.round(day.percentage)}% coverage
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Partnership Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Partnerships</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {partnerships.map(partnership => (
              <div key={partnership.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{partnership.partnership_name}</span>
                <Badge variant="secondary" className="ml-auto">
                  {partnership.team_ids.length} teams
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Guidance */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Tip:</strong> This information helps you coordinate with partner teams. 
          {warningCount === 0 
            ? " Your schedule looks well-coordinated with partner team availability!"
            : " Consider adjusting dates or consulting with partner team planners to optimize overall coverage."
          }
        </AlertDescription>
      </Alert>
    </div>
  );
}
