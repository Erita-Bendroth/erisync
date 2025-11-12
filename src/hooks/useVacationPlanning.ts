import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, endOfMonth, addMonths, eachDayOfInterval, format, parseISO } from 'date-fns';

export interface VacationRequest {
  id: string;
  user_id: string;
  team_id: string;
  requested_date: string;
  start_time: string | null;
  end_time: string | null;
  is_full_day: boolean;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  rejection_reason: string | null;
  approver_id: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  selected_planner_id: string | null;
  request_group_id: string | null;
  profiles?: {
    first_name: string;
    last_name: string;
    initials: string | null;
  };
  teams?: {
    name: string;
  };
}

export interface DayCapacity {
  date: string;
  team_id: string;
  team_name: string;
  total_members: number;
  on_vacation: number;
  available: number;
  required_capacity: number;
  coverage_percentage: number;
  risk_level: 'safe' | 'warning' | 'critical';
}

interface UseVacationPlanningProps {
  teamIds: string[];
  monthsToShow?: number;
  startDate?: Date;
}

export const useVacationPlanning = ({ 
  teamIds, 
  monthsToShow = 3,
  startDate = new Date()
}: UseVacationPlanningProps) => {
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [capacityData, setCapacityData] = useState<DayCapacity[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const dateRange = {
    start: startOfMonth(startDate),
    end: endOfMonth(addMonths(startDate, monthsToShow - 1))
  };

  const fetchVacationRequests = async () => {
    if (teamIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('vacation_requests')
        .select(`
          *,
          profiles!user_id(first_name, last_name, initials),
          teams!team_id(name)
        `)
        .in('team_id', teamIds)
        .gte('requested_date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('requested_date', format(dateRange.end, 'yyyy-MM-dd'))
        .order('requested_date', { ascending: true });

      if (error) throw error;
      setVacationRequests((data || []) as any);
    } catch (error) {
      console.error('Error fetching vacation requests:', error);
      toast({
        title: "Error",
        description: "Failed to load vacation requests",
        variant: "destructive"
      });
    }
  };

  const calculateCapacity = async () => {
    if (teamIds.length === 0) return;

    try {
      // Fetch team members for each team
      const { data: teamMembers, error: membersError } = await supabase
        .from('team_members')
        .select('team_id, user_id, teams(name)')
        .in('team_id', teamIds);

      if (membersError) throw membersError;

      // Fetch capacity config
      const { data: capacityConfig, error: configError } = await supabase
        .from('team_capacity_config')
        .select('*')
        .in('team_id', teamIds);

      if (configError) throw configError;

      // Generate all days in range
      const allDays = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
      
      const capacityByDay: DayCapacity[] = [];

      for (const team_id of teamIds) {
        const teamMembersList = teamMembers?.filter(tm => tm.team_id === team_id) || [];
        const config = capacityConfig?.find(c => c.team_id === team_id);
        const teamName = teamMembersList[0]?.teams?.name || 'Unknown Team';
        const requiredCapacity = config?.min_staff_required || 1;

        for (const day of allDays) {
          const dateStr = format(day, 'yyyy-MM-dd');
          
          // Count people on vacation this day
          const onVacationCount = vacationRequests.filter(vr => 
            vr.team_id === team_id &&
            vr.requested_date === dateStr &&
            (vr.status === 'approved' || vr.status === 'pending')
          ).length;

          const totalMembers = teamMembersList.length;
          const available = totalMembers - onVacationCount;
          const coveragePercentage = totalMembers > 0 ? (available / requiredCapacity) * 100 : 0;

          let riskLevel: 'safe' | 'warning' | 'critical' = 'safe';
          if (available < requiredCapacity) {
            riskLevel = 'critical';
          } else if (available < requiredCapacity * 1.5) {
            riskLevel = 'warning';
          }

          capacityByDay.push({
            date: dateStr,
            team_id,
            team_name: teamName,
            total_members: totalMembers,
            on_vacation: onVacationCount,
            available,
            required_capacity: requiredCapacity,
            coverage_percentage: Math.round(coveragePercentage),
            risk_level: riskLevel
          });
        }
      }

      setCapacityData(capacityByDay);
    } catch (error) {
      console.error('Error calculating capacity:', error);
    }
  };

  const approveRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('vacation_requests')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approver_id: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Vacation request approved"
      });

      await fetchVacationRequests();
      await calculateCapacity();
    } catch (error) {
      console.error('Error approving request:', error);
      toast({
        title: "Error",
        description: "Failed to approve request",
        variant: "destructive"
      });
    }
  };

  const rejectRequest = async (requestId: string, reason: string) => {
    try {
      const { error } = await supabase
        .from('vacation_requests')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
          approver_id: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Vacation request rejected"
      });

      await fetchVacationRequests();
      await calculateCapacity();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast({
        title: "Error",
        description: "Failed to reject request",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchVacationRequests();
      setLoading(false);
    };

    loadData();
  }, [teamIds.join(','), dateRange.start.toISOString(), dateRange.end.toISOString()]);

  useEffect(() => {
    if (vacationRequests.length >= 0) {
      calculateCapacity();
    }
  }, [vacationRequests]);

  return {
    vacationRequests,
    capacityData,
    loading,
    dateRange,
    approveRequest,
    rejectRequest,
    refresh: fetchVacationRequests
  };
};
