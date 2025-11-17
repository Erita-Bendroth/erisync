import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Camera, Download, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { QuickActionsToolbar } from './QuickActionsToolbar';
import { TeamSection } from './TeamSection';
import { OnlineUsersPanel } from './OnlineUsersPanel';
import { CoverageRow } from './CoverageRow';
import { PartnershipSelector } from './PartnershipSelector';
import { DateRangeSelector, DateRangeType, getDaysCount } from './DateRangeSelector';
import { MultiSelectTeams } from '@/components/ui/multi-select-teams';
import { useSchedulerState, ScheduleEntry } from '@/hooks/useSchedulerState';
import { useSchedulerActions } from '@/hooks/useSchedulerActions';
import { useSchedulerPresence } from '@/hooks/useSchedulerPresence';
import { useShiftTypes } from '@/hooks/useShiftTypes';
import { useRotationTemplates } from '@/hooks/useRotationTemplates';
import { useDebounce } from '@/hooks/useDebounce';
import { useCoverageAnalysis } from '@/hooks/useCoverageAnalysis';
import { useTeamFavorites } from '@/hooks/useTeamFavorites';
import { useHolidayVisibility } from '@/hooks/useHolidayVisibility';
import { TeamFavoritesQuickAccess } from '../TeamFavoritesQuickAccess';
import { PlanningPartnershipManager } from '../planning-partners/PlanningPartnershipManager';
import { CoverageSummaryPanel } from '../planning-partners/CoverageSummaryPanel';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { ApplyTemplateDialog } from '../ApplyTemplateDialog';
import { CoverageOverview } from '../CoverageOverview';
import { CoverageHeatmap } from '../CoverageHeatmap';
import { CoverageAlerts } from '../CoverageAlerts';
import { TeamCoverageGrid } from '../TeamCoverageGrid';
import * as XLSX from 'xlsx';

interface TeamMember {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
}

interface TeamSection {
  teamId: string;
  teamName: string;
  members: TeamMember[];
  color: string;
}

interface UnifiedTeamSchedulerProps {
  partnershipDialogOpen?: boolean;
  setPartnershipDialogOpen?: (open: boolean) => void;
}

export const UnifiedTeamScheduler: React.FC<UnifiedTeamSchedulerProps> = ({ 
  partnershipDialogOpen, 
  setPartnershipDialogOpen 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectionMode, setSelectionMode] = useState<'single' | 'partnership' | 'multi-team'>('single');
  const [selectedPartnershipId, setSelectedPartnershipId] = useState<string>('');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [allTeams, setAllTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [teamSections, setTeamSections] = useState<TeamSection[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [dateStart, setDateStart] = useState<Date>(getMonday(new Date()));
  const [rangeType, setRangeType] = useState<DateRangeType>('week');
  const [loading, setLoading] = useState(false);
  const [applyTemplateDialogOpen, setApplyTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [activeTab, setActiveTab] = useState('schedule');
  const [showCoverageSummary, setShowCoverageSummary] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<{
    firstName: string;
    lastName: string;
    initials: string;
  }>({ firstName: '', lastName: '', initials: '' });

  const { favorites, refetchFavorites } = useTeamFavorites('multi-team');
  const { showHolidays, toggleHolidays } = useHolidayVisibility(user?.id);

  // Fetch all available teams
  useEffect(() => {
    const fetchAllTeams = async () => {
      try {
        const { data, error } = await supabase
          .from('teams')
          .select('id, name')
          .order('name');

        if (error) throw error;
        setAllTeams(data || []);
      } catch (error) {
        console.error('Error fetching teams:', error);
      }
    };

    fetchAllTeams();
  }, []);

  const state = useSchedulerState();
  const { copyPattern, pastePattern, bulkAssignShift, clearCells } = useSchedulerActions(
    teamSections,
    scheduleEntries,
    setScheduleEntries,
    dateStart
  );

  const { shiftTypes } = useShiftTypes();
  const { templates } = useRotationTemplates(teamIds);
  
  const debouncedScheduleEntries = useDebounce(scheduleEntries, 300);
  
  const dateEnd = useMemo(() => {
    const end = new Date(dateStart);
    end.setDate(end.getDate() + getDaysCount(rangeType) - 1);
    return end;
  }, [dateStart, rangeType]);

  const coverageAnalysis = useCoverageAnalysis({
    teamIds,
    startDate: dateStart,
    endDate: dateEnd,
    threshold: 1,
    preloadedScheduleEntries: debouncedScheduleEntries,
    preloadedTeams: teamSections.map(ts => ({ id: ts.teamId, name: ts.teamName })),
  });

  const { selectAllUsers, clearSelection, setClipboard } = state;
  const { onlineUsers } = useSchedulerPresence(teamIds, dateStart, dateEnd);

  useEffect(() => {
    if (teamIds.length > 0 && user) {
      fetchTeamSections();
      fetchScheduleEntries();
    }
  }, [teamIds, user]);

  useEffect(() => {
    if (teamIds.length > 0) {
      fetchScheduleEntries();
    }
  }, [dateStart, rangeType]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, initials')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setCurrentUserProfile({
          firstName: data.first_name,
          lastName: data.last_name,
          initials: data.initials || '',
        });
      }
    };

    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    if (teamIds.length === 0) return;

    const channel = supabase
      .channel(`unified-scheduler-${teamIds.join('-')}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'schedule_entries',
        filter: teamIds.length > 0 ? `team_id=in.(${teamIds.join(',')})` : undefined,
      }, () => {
        fetchScheduleEntries();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamIds]);

  const fetchTeamSections = async () => {
    if (teamIds.length === 0) return;
    
    try {
      const sections: TeamSection[] = [];
      
      for (const teamId of teamIds) {
        const { data: teamData } = await supabase
          .from('teams')
          .select('name')
          .eq('id', teamId)
          .single();

        const { data: membersData } = await supabase
          .from('team_members')
          .select(`
            user_id,
            profiles:user_id (
              first_name,
              last_name,
              initials
            )
          `)
          .eq('team_id', teamId);

        if (teamData && membersData) {
          sections.push({
            teamId,
            teamName: teamData.name,
            members: membersData.map((m: any) => ({
              user_id: m.user_id,
              first_name: m.profiles.first_name,
              last_name: m.profiles.last_name,
              initials: m.profiles.initials,
            })),
            color: getTeamColor(teamId),
          });
        }
      }

      setTeamSections(sections);
    } catch (error) {
      console.error('Error fetching team sections:', error);
    }
  };

  const fetchScheduleEntries = async () => {
    if (teamIds.length === 0) return;

    try {
      setLoading(true);
      const endDate = new Date(dateStart);
      endDate.setDate(endDate.getDate() + getDaysCount(rangeType));

      const { data, error } = await supabase
        .from('schedule_entries')
        .select('*')
        .in('team_id', teamIds)
        .gte('date', dateStart.toISOString().split('T')[0])
        .lt('date', endDate.toISOString().split('T')[0]);

      if (error) throw error;
      setScheduleEntries((data as ScheduleEntry[]) || []);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      toast({
        title: "Error",
        description: "Failed to load schedule",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (state.selectedCells.size === 0) {
      toast({ title: "No cells selected", description: "Please select cells to copy" });
      return;
    }
    const pattern = copyPattern(Array.from(state.selectedCells));
    setClipboard(pattern);
    toast({ title: "Copied", description: `Copied ${pattern.length} entries` });
  };

  const handlePaste = () => {
    if (!state.clipboardPattern || state.clipboardPattern.length === 0) {
      toast({ title: "Nothing to paste", description: "Please copy cells first" });
      return;
    }
    if (state.selectedCells.size === 0) {
      toast({ title: "No destination", description: "Please select target cells" });
      return;
    }
    pastePattern(state.clipboardPattern, Array.from(state.selectedCells));
    toast({ title: "Pasted", description: "Schedule pattern applied" });
  };

  const handleQuickAssign = (shiftType: string) => {
    if (state.selectedCells.size === 0) {
      toast({ title: "No cells selected", description: "Please select cells to assign" });
      return;
    }
    bulkAssignShift(Array.from(state.selectedCells), shiftType as any);
    toast({ title: "Assigned", description: `${shiftType} shift assigned` });
  };

  const handleClear = () => {
    if (state.selectedCells.size === 0) {
      toast({ title: "No cells selected", description: "Please select cells to clear" });
      return;
    }
    clearCells(Array.from(state.selectedCells));
    toast({ title: "Cleared", description: "Selected cells cleared" });
  };

  const handleSelectAll = () => {
    const allUserIds = teamSections.flatMap(section => section.members.map(m => m.user_id));
    selectAllUsers(allUserIds);
  };

  const handleSelectAllTeam = (teamId: string) => {
    const section = teamSections.find(s => s.teamId === teamId);
    if (section) {
      const userIds = section.members.map(m => m.user_id);
      selectAllUsers(userIds);
    }
  };

  const handleApplyTemplateClick = () => {
    if (templates.length === 0) {
      toast({
        title: 'No Templates',
        description: 'Create rotation templates first in Admin settings',
        variant: 'destructive',
      });
      return;
    }
    setSelectedTemplate(templates[0]);
    setApplyTemplateDialogOpen(true);
  };

  const handleApplyTemplate = async (entries: any[]) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const entriesToInsert = entries.map(entry => ({
        ...entry,
        created_by: userData.user.id,
      }));

      const { error } = await supabase
        .from('schedule_entries')
        .upsert(entriesToInsert, { onConflict: 'user_id,date,team_id' });

      if (error) throw error;

      await fetchScheduleEntries();
      clearSelection();
      
      toast({
        title: 'Success',
        description: `Applied rotation pattern to ${entries.length} entries`,
      });
    } catch (error) {
      console.error('Error applying template:', error);
      toast({
        title: 'Error',
        description: 'Failed to apply rotation pattern',
        variant: 'destructive',
      });
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const count = getDaysCount(rangeType);
    const newDate = new Date(dateStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? count : -count));
    setDateStart(newDate);
  };

  const coverageByDateTeam = useMemo(() => {
    const coverage: Record<string, Record<string, number>> = {};
    
    for (let i = 0; i < getDaysCount(rangeType); i++) {
      const date = new Date(dateStart);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      coverage[dateKey] = {};
      
      teamIds.forEach(teamId => {
        const count = scheduleEntries.filter(
          e => e.date === dateKey && 
               e.team_id === teamId && 
               e.availability_status === 'available'
        ).length;
        coverage[dateKey][teamId] = count;
      });
    }
    
    return coverage;
  }, [scheduleEntries, dateStart, rangeType, teamIds]);

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    teamSections.forEach(section => {
      const data: any[][] = [
        ['Name', ...Array.from({ length: getDaysCount(rangeType) }, (_, i) => {
          const d = new Date(dateStart);
          d.setDate(d.getDate() + i);
          return d.toLocaleDateString();
        })],
      ];

      section.members.forEach(member => {
        const row = [`${member.first_name} ${member.last_name}`];
        for (let i = 0; i < getDaysCount(rangeType); i++) {
          const d = new Date(dateStart);
          d.setDate(d.getDate() + i);
          const dateKey = d.toISOString().split('T')[0];
          const entry = scheduleEntries.find(
            e => e.user_id === member.user_id && 
                 e.date === dateKey && 
                 e.team_id === section.teamId
          );
          row.push(entry ? entry.shift_type || entry.activity_type : '');
        }
        data.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, section.teamName.substring(0, 31));
    });

    XLSX.writeFile(wb, `schedule-${dateStart.toISOString().split('T')[0]}.xlsx`);
  };

  const captureScreenshot = async () => {
    setScreenshotMode(true);
    
    setTimeout(async () => {
      const element = document.getElementById('scheduler-content');
      if (!element) return;

      try {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(element, {
          scale: 2,
          backgroundColor: '#ffffff',
        });

        const jsPDF = (await import('jspdf')).default;
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4',
        });

        const imgWidth = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`schedule-${dateStart.toISOString().split('T')[0]}.pdf`);

        toast({
          title: 'Screenshot saved',
          description: 'Schedule has been exported as PDF',
        });
      } catch (error) {
        console.error('Error capturing screenshot:', error);
        toast({
          title: 'Error',
          description: 'Failed to capture screenshot',
          variant: 'destructive',
        });
      } finally {
        setScreenshotMode(false);
      }
    }, 100);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle>Team Scheduler</CardTitle>
              
              {setPartnershipDialogOpen && (
                <Dialog open={partnershipDialogOpen} onOpenChange={setPartnershipDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Users className="w-4 h-4 mr-2" />
                      Manage Partnerships
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <PlanningPartnershipManager />
                  </DialogContent>
                </Dialog>
              )}
            </div>
            
            <Tabs value={selectionMode} onValueChange={(v) => setSelectionMode(v as any)}>
              <TabsList>
                <TabsTrigger value="single">Single Team</TabsTrigger>
                <TabsTrigger value="partnership">Partnership</TabsTrigger>
                <TabsTrigger value="multi-team">Multi-Team</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-wrap items-center gap-3">
              {selectionMode === 'single' ? (
                <Select 
                  value={teamIds[0] || ''} 
                  onValueChange={(value) => setTeamIds([value])}
                >
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Select a team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : selectionMode === 'partnership' ? (
                <PartnershipSelector
                  value={selectedPartnershipId}
                  onChange={(id, ids) => {
                    setSelectedPartnershipId(id);
                    setTeamIds(ids);
                  }}
                />
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <MultiSelectTeams
                    selectedTeams={teamIds}
                    onTeamsChange={setTeamIds}
                    placeholder="Select teams..."
                  />
                  <TeamFavoritesQuickAccess
                    favorites={favorites}
                    currentSelectedTeamIds={teamIds}
                    onApplyFavorite={(favorite) => setTeamIds(favorite.team_ids)}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <DateRangeSelector
                startDate={dateStart}
                onStartDateChange={(date) => date && setDateStart(date)}
                rangeType={rangeType}
                onRangeTypeChange={setRangeType}
              />

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigateDate('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigateDate('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Switch id="show-holidays" checked={showHolidays} onCheckedChange={toggleHolidays} />
                <Label htmlFor="show-holidays" className="text-sm">Holidays</Label>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowCoverageSummary(!showCoverageSummary)}>
                {showCoverageSummary ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                Coverage
              </Button>
              <Button variant="outline" size="sm" onClick={exportToExcel} disabled={teamSections.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={captureScreenshot} disabled={teamSections.length === 0}>
                <Camera className="h-4 w-4 mr-2" />
                Screenshot
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {showCoverageSummary && teamIds.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <CoverageSummaryPanel
              teamIds={teamIds}
              weekStart={dateStart}
              dailyCoverage={[]}
              totalMembers={teamSections.reduce((acc, ts) => acc + ts.members.length, 0)}
            />
          </CardContent>
        </Card>
      )}

      {!screenshotMode && (
        <QuickActionsToolbar
          onCopy={handleCopy}
          onPaste={handlePaste}
          onClear={handleClear}
          onQuickAssign={handleQuickAssign}
          onSelectAll={handleSelectAll}
          onClearSelection={clearSelection}
          onApplyTemplate={handleApplyTemplateClick}
          selectedCount={state.selectedCells.size}
          hasClipboard={!!state.clipboardPattern && state.clipboardPattern.length > 0}
          shiftTypes={shiftTypes}
        />
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="coverage-grid">Coverage Grid</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" id="scheduler-content" className="space-y-4">
          {loading && <div className="text-center py-8">Loading schedule...</div>}
          
          {!loading && teamSections.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Select teams to view their schedules
              </CardContent>
            </Card>
          )}

          {!loading && teamSections.map((section) => (
            <TeamSection
              key={section.teamId}
              section={section}
              dateStart={dateStart}
              daysCount={getDaysCount(rangeType)}
              scheduleEntries={scheduleEntries}
              state={state}
              onScheduleUpdate={fetchScheduleEntries}
              screenshotMode={screenshotMode}
              onSelectAllTeam={() => handleSelectAllTeam(section.teamId)}
              showHolidays={showHolidays}
            />
          ))}

          {!screenshotMode && <OnlineUsersPanel onlineUsers={onlineUsers} />}

          {teamSections.map(section => (
            <CoverageRow
              key={`coverage-${section.teamId}`}
              teamId={section.teamId}
              teamName={section.teamName}
              dateStart={dateStart}
              daysCount={getDaysCount(rangeType)}
              coverageData={coverageByDateTeam}
              color={section.color}
            />
          ))}
        </TabsContent>

        <TabsContent value="coverage-grid" className="space-y-4">
          <TeamCoverageGrid
            teams={teamSections.map(ts => ({ id: ts.teamId, name: ts.teamName }))}
            teamIds={teamIds}
            currentDate={dateStart}
            showHolidays={showHolidays}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <CoverageOverview analysis={coverageAnalysis} />
          <CoverageAlerts gaps={coverageAnalysis.gaps} />
          <CoverageHeatmap
            teams={teamSections.map(ts => ({ id: ts.teamId, name: ts.teamName }))}
            teamIds={teamIds}
            startDate={dateStart}
            endDate={dateEnd}
          />
        </TabsContent>
      </Tabs>

      {selectedTemplate && (
        <ApplyTemplateDialog
          open={applyTemplateDialogOpen}
          onOpenChange={setApplyTemplateDialogOpen}
          template={selectedTemplate}
          onApply={handleApplyTemplate}
          selectedCells={Array.from(state.selectedCells)}
          teamSections={teamSections}
          startDate={dateStart}
        />
      )}
    </div>
  );
};

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getTeamColor(teamId: string): string {
  const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];
  const hash = teamId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}
