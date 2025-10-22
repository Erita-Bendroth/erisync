import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardFilters } from '@/components/analytics/DashboardFilters';
import { MetricsOverview } from '@/components/analytics/MetricsOverview';
import { WorkforceAnalytics } from '@/components/analytics/WorkforceAnalytics';
import { EfficiencyAnalytics } from '@/components/analytics/EfficiencyAnalytics';
import { OperationalInsights } from '@/components/analytics/OperationalInsights';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { subDays } from 'date-fns';

interface Team {
  id: string;
  name: string;
}

const Analytics = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date(),
  });

  // Fetch user and check permissions
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      setUser(user);

      // Check user roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const userRolesList = roles?.map(r => r.role) || [];
      setUserRoles(userRolesList);

      // Only admins, planners, and managers can access analytics
      if (!userRolesList.some(role => ['admin', 'planner', 'manager'].includes(role))) {
        navigate('/');
        return;
      }

      // Fetch accessible teams
      if (userRolesList.includes('admin') || userRolesList.includes('planner')) {
        const { data: allTeams } = await supabase
          .from('teams')
          .select('id, name')
          .order('name');
        
        setTeams(allTeams || []);
        if (allTeams && allTeams.length > 0) {
          setSelectedTeams([allTeams[0].id]);
        }
      } else if (userRolesList.includes('manager')) {
        // Get manager's accessible teams
        const { data: managerTeams } = await supabase
          .from('team_members')
          .select('team_id, teams(id, name)')
          .eq('user_id', user.id)
          .eq('is_manager', true);

        const accessibleTeams = managerTeams?.map(mt => ({
          id: (mt.teams as any).id,
          name: (mt.teams as any).name,
        })) || [];

        setTeams(accessibleTeams);
        if (accessibleTeams.length > 0) {
          setSelectedTeams([accessibleTeams[0].id]);
        }
      }
    };

    checkAuth();
  }, [navigate]);

  // Fetch analytics data
  const { data: analyticsData, isLoading, error, refetch } = useAnalytics({
    teamIds: selectedTeams,
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  if (!user || userRoles.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load analytics data. Please try again.
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  const capacity = analyticsData?.metrics?.capacity?.[0]?.data;
  const efficiency = analyticsData?.metrics?.efficiency;
  const coverage = analyticsData?.metrics?.coverage?.[0]?.data;
  const vacation = analyticsData?.metrics?.vacation?.[0]?.data;

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive insights into workforce, efficiency, and operations
          </p>
        </div>

        {/* Filters */}
        <DashboardFilters
          selectedTeams={selectedTeams}
          availableTeams={teams}
          onTeamsChange={setSelectedTeams}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          onRefresh={() => refetch()}
          isLoading={isLoading}
        />

        {/* Key Metrics Overview */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <MetricsOverview
            capacity={capacity}
            coverage={coverage}
            vacation={vacation}
            efficiency={efficiency}
          />
        )}

        {/* Detailed Analytics Tabs */}
        <Tabs defaultValue="workforce" className="space-y-4">
          <TabsList>
            <TabsTrigger value="workforce">Workforce</TabsTrigger>
            <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="workforce">
            {isLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <WorkforceAnalytics capacity={analyticsData?.metrics?.capacity} />
            )}
          </TabsContent>

          <TabsContent value="efficiency">
            {isLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <EfficiencyAnalytics efficiency={efficiency} />
            )}
          </TabsContent>

          <TabsContent value="insights">
            {isLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <OperationalInsights coverage={coverage} vacation={vacation} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Analytics;
