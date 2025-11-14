import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar, BarChart3, Plus } from 'lucide-react';
import { MultiMonthVacationCalendar } from './MultiMonthVacationCalendar';
import { VacationPipeline } from './VacationPipeline';
import { CapacityOverview } from './CapacityOverview';
import { ConflictDetector } from './ConflictDetector';
import { FairnessAnalysis } from './FairnessAnalysis';
import { WhatIfScenario } from './WhatIfScenario';
import { CoverageHeatmap } from './CoverageHeatmap';
import { RecommendationEngine } from './RecommendationEngine';
import { ExportTools } from './ExportTools';
import { VacationAnalytics } from './VacationAnalytics';
import { ManualVacationEntry } from './ManualVacationEntry';
import { useVacationPlanning } from '@/hooks/useVacationPlanning';
import { useScheduleAccessControl } from '@/hooks/useScheduleAccessControl';
import { addMonths, subMonths } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MultiSelectTeams } from '@/components/ui/multi-select-teams';

interface VacationPlanningDashboardProps {
  teamIds: string[];
  teams: Array<{ id: string; name: string }>;
}

export const VacationPlanningDashboard = ({ teamIds, teams }: VacationPlanningDashboardProps) => {
  const [startDate, setStartDate] = useState(new Date());
  const [monthsToShow, setMonthsToShow] = useState(3);
  const [view, setView] = useState<'calendar' | 'pipeline'>('calendar');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(teamIds);

  // Add access control for multi-team hierarchy
  const {
    canEditTeam,
    isAdmin,
    isPlanner,
    isManager,
  } = useScheduleAccessControl({ viewMode: 'multi-team' });

  const {
    vacationRequests,
    capacityData,
    loading,
    dateRange,
    approveRequest,
    rejectRequest,
    refresh
  } = useVacationPlanning({
    teamIds: selectedTeamIds.length > 0 ? selectedTeamIds : teamIds,
    monthsToShow,
    startDate
  });

  // Filter vacation requests to only show those the user can access
  const visibleVacationRequests = useMemo(() => {
    // Admins and planners see everything
    if (isAdmin || isPlanner) return vacationRequests;
    
    // Managers only see requests from teams they can edit
    return vacationRequests.filter(vr => canEditTeam(vr.team_id));
  }, [vacationRequests, canEditTeam, isAdmin, isPlanner]);

  // Filter capacity data similarly
  const visibleCapacityData = useMemo(() => {
    if (isAdmin || isPlanner) return capacityData;
    
    return capacityData.filter(cd => canEditTeam(cd.team_id));
  }, [capacityData, canEditTeam, isAdmin, isPlanner]);

  const handlePreviousMonth = () => {
    setStartDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setStartDate(prev => addMonths(prev, 1));
  };

  const handleToday = () => {
    setStartDate(new Date());
  };

  const pendingRequests = visibleVacationRequests.filter(vr => vr.status === 'pending');
  const approvedRequests = visibleVacationRequests.filter(vr => vr.status === 'approved');

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Vacation & Workforce Planning</CardTitle>
              <CardDescription>
                Plan and manage team vacations with capacity insights
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={monthsToShow.toString()}
                onValueChange={(value) => setMonthsToShow(parseInt(value))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Months</SelectItem>
                  <SelectItem value="4">4 Months</SelectItem>
                  <SelectItem value="5">5 Months</SelectItem>
                  <SelectItem value="6">6 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Team Selection Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium min-w-[60px]">Teams:</label>
              <div className="flex-1">
                <MultiSelectTeams
                  teams={teams}
                  selectedTeamIds={selectedTeamIds}
                  onValueChange={setSelectedTeamIds}
                  placeholder="Select teams to view"
                />
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedTeamIds(teamIds)}
              >
                Select All
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedTeamIds([])}
              >
                Clear
              </Button>
            </div>
            
            {/* Navigation and Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  onClick={() => setShowManualEntry(true)}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Entry
                </Button>
                <Button onClick={handlePreviousMonth} variant="outline" size="sm">
                  <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button onClick={handleToday} variant="outline" size="sm">
                Today
              </Button>
              <Button onClick={handleNextMonth} variant="outline" size="sm">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant={view === 'calendar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('calendar')}
              >
                <Calendar className="h-4 w-4 mr-1" />
                Calendar
              </Button>
              <Button
                variant={view === 'pipeline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('pipeline')}
              >
                <BarChart3 className="h-4 w-4 mr-1" />
                Pipeline
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Capacity Overview */}
      <CapacityOverview 
        capacityData={visibleCapacityData}
        vacationRequests={visibleVacationRequests}
        teams={teams}
      />

      {/* Analysis Tools Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ConflictDetector
          capacityData={visibleCapacityData}
          vacationRequests={visibleVacationRequests}
          teams={teams}
        />
        
        <WhatIfScenario
          vacationRequests={visibleVacationRequests}
          capacityData={visibleCapacityData}
          teams={teams}
        />

        <div className="space-y-4">
          <RecommendationEngine
            teams={teams}
            dateRange={dateRange}
          />
          <ExportTools
            vacationRequests={visibleVacationRequests}
            capacityData={visibleCapacityData}
            teams={teams}
            dateRange={dateRange}
          />
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="heatmap">Heat Map</TabsTrigger>
          <TabsTrigger value="fairness">Fairness</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <Card>
            <CardContent className="pt-6">
              <MultiMonthVacationCalendar
                startDate={startDate}
                monthsToShow={monthsToShow}
                vacationRequests={visibleVacationRequests}
                capacityData={visibleCapacityData}
                teams={teams}
                loading={loading}
                onApprove={approveRequest}
                onReject={rejectRequest}
                onRefresh={refresh}
                canEditTeam={canEditTeam}
                isAdmin={isAdmin}
                isPlanner={isPlanner}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline">
          <Card>
            <CardContent className="pt-6">
              <VacationPipeline
                vacationRequests={visibleVacationRequests}
                capacityData={visibleCapacityData}
                teams={teams}
                loading={loading}
                onApprove={approveRequest}
                onReject={rejectRequest}
                onRefresh={refresh}
                canEditTeam={canEditTeam}
                isAdmin={isAdmin}
                isPlanner={isPlanner}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heatmap">
          <CoverageHeatmap
            capacityData={visibleCapacityData}
            teams={teams}
            dateRange={dateRange}
          />
        </TabsContent>

        <TabsContent value="fairness">
          <FairnessAnalysis
            vacationRequests={visibleVacationRequests}
            teams={teams}
            dateRange={dateRange}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <VacationAnalytics
            vacationRequests={visibleVacationRequests}
            capacityData={visibleCapacityData}
            teams={teams}
            dateRange={dateRange}
          />
        </TabsContent>
      </Tabs>

      {/* Manual Vacation Entry Modal */}
      <ManualVacationEntry
        open={showManualEntry}
        onOpenChange={setShowManualEntry}
        teams={teams}
        onSuccess={refresh}
        canEditTeam={canEditTeam}
        isAdmin={isAdmin}
        isPlanner={isPlanner}
      />
    </div>
  );
};
