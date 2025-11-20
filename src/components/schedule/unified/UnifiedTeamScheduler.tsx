import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Camera, Download, ZoomIn, ZoomOut, Calendar as CalendarIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
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
import { useHolidayRefetch } from '@/hooks/useHolidayRefetch';
import { useScheduleAccessControl } from '@/hooks/useScheduleAccessControl';
import { TeamFavoritesQuickAccess } from '../TeamFavoritesQuickAccess';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { ApplyTemplateDialog } from '../ApplyTemplateDialog';
import { EditScheduleModal } from '../EditScheduleModal';
import { CoverageOverview } from '../CoverageOverview';
import { CoverageHeatmap } from '../CoverageHeatmap';
import { CoverageAlerts } from '../CoverageAlerts';
import { TeamCoverageGrid } from '../TeamCoverageGrid';
import { ShiftTypeCounterRow } from './ShiftTypeCounterRow';
import { DateHeaderRow } from './DateHeaderRow';
import { WeeklyGridView } from './WeeklyGridView';
import { MonthlyGridView } from './MonthlyGridView';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useQueryClient } from '@tanstack/react-query';
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

export const UnifiedTeamScheduler: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectionMode, setSelectionMode] = useState<'partnership' | 'multi-team'>('partnership');
  const [selectedPartnershipId, setSelectedPartnershipId] = useState<string>('');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  
  // Access control for partnership views
  const accessControl = useScheduleAccessControl({ 
    viewMode: selectionMode === 'partnership' ? 'multi-team' : 'multi-team' 
  });
  const [allTeams, setAllTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [teamSections, setTeamSections] = useState<TeamSection[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [dateStart, setDateStart] = useState<Date>(getMonday(new Date()));
  const [rangeType, setRangeType] = useState<DateRangeType>('week');
  const [viewMode, setViewMode] = useState<'grid' | 'weekly' | 'monthly'>('grid');
  const [loading, setLoading] = useState(false);
  const [applyTemplateDialogOpen, setApplyTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [activeTab, setActiveTab] = useState('schedule');
  const [currentUserProfile, setCurrentUserProfile] = useState<{
    firstName: string;
    lastName: string;
    initials: string;
  }>({ firstName: '', lastName: '', initials: '' });
  const [partnershipConfig, setPartnershipConfig] = useState<{
    min_staff_required: number;
    max_staff_allowed?: number | null;
  } | null>(null);
  const [partnershipName, setPartnershipName] = useState<string>('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const queryClient = useQueryClient();

  const { favorites, refetchFavorites } = useTeamFavorites('multi-team');
  const { showHolidays, toggleHolidays } = useHolidayVisibility(user?.id);
  const holidayRefetchTrigger = useHolidayRefetch();

  // Load partnership capacity config
  useEffect(() => {
    if (selectionMode === 'partnership' && selectedPartnershipId) {
      loadPartnershipConfig();
    } else {
      setPartnershipConfig(null);
      setPartnershipName('');
    }
  }, [selectionMode, selectedPartnershipId]);

  const loadPartnershipConfig = async () => {
    try {
      // Load partnership name
      const { data: partnership } = await supabase
        .from('team_planning_partners')
        .select('partnership_name')
        .eq('id', selectedPartnershipId)
        .single();

      if (partnership) {
        setPartnershipName(partnership.partnership_name);
      }

      // Load capacity config
      const { data, error } = await supabase
        .from('partnership_capacity_config')
        .select('min_staff_required, max_staff_allowed')
        .eq('partnership_id', selectedPartnershipId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading partnership config:', error);
        return;
      }

      if (data) {
        setPartnershipConfig(data);
      }
    } catch (error) {
      console.error('Error loading partnership config:', error);
    }
  };

  // Auto-select view mode based on date range
  useEffect(() => {
    if (rangeType === 'week' || rangeType === '2weeks') {
      setViewMode('grid');
    } else if (rangeType === 'quarter') {
      setViewMode('weekly');
    } else {
      setViewMode('monthly');
    }
  }, [rangeType]);

  // Fetch all available teams for multi-team mode
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

    if (selectionMode === 'multi-team') {
      fetchAllTeams();
    }
  }, [selectionMode]);

  const {
    state,
    toggleUserSelection,
    toggleCellSelection,
    selectAllUsers,
    clearSelection,
    setClipboard,
    setHoveredCell,
    setEditingCell,
    startDrag,
    updateDragEnd,
    endDrag,
    selectRange,
  } = useSchedulerState();

  const {
    copyPattern,
    pastePattern,
    bulkAssignShift,
    clearCells,
  } = useSchedulerActions(scheduleEntries, setScheduleEntries, user?.id || '', teamSections);

  const { shiftTypes } = useShiftTypes(teamIds);
  const { templates } = useRotationTemplates(teamIds);
  
  const endDate = useMemo(() => {
    const end = new Date(dateStart);
    end.setDate(end.getDate() + getDaysCount(rangeType) - 1);
    return end;
  }, [dateStart, rangeType]);
  
  const coverageAnalysis = useCoverageAnalysis({
    teamIds,
    startDate: dateStart,
    endDate,
    scheduleData: scheduleEntries,
  });

  // Generate dates based on range type
  const dates = useMemo(() => {
    const count = getDaysCount(rangeType);
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(dateStart);
      date.setDate(date.getDate() + i);
      return date.toISOString().split('T')[0];
    });
  }, [dateStart, rangeType]);

  const debouncedEditingCell = useDebounce(state.editingCell, 300);

  const { onlineUsers } = useSchedulerPresence(
    selectedPartnershipId,
    'partnership',
    user?.id || '',
    currentUserProfile,
    debouncedEditingCell
  );

  const cellsBeingEdited = useMemo(() => {
    return onlineUsers.reduce((acc, user) => {
      if (user.editing_cell) {
        if (!acc[user.editing_cell]) {
          acc[user.editing_cell] = [];
        }
        acc[user.editing_cell].push(user);
      }
      return acc;
    }, {} as Record<string, typeof onlineUsers>);
  }, [onlineUsers]);

  // Build drag selection rectangle as user drags
  useEffect(() => {
    if (state.isDragging && state.dragStart && state.hoveredCell) {
      // Get user IDs to include in selection
      const userIds = Array.from(state.selectedUsers);
      
      // If no users explicitly selected, use the user from drag start
      if (userIds.length === 0) {
        const [startUserId] = state.dragStart.split(':');
        userIds.push(startUserId);
      }
      
      // Build rectangular selection
      selectRange(state.dragStart, state.hoveredCell, userIds);
    }
  }, [state.isDragging, state.dragStart, state.hoveredCell, state.selectedUsers, selectRange]);

  // Open edit dialog when a cell is set to editing mode
  useEffect(() => {
    if (state.editingCell) {
      const [userId, date] = state.editingCell.split(':');
      
      // Find existing entry or create new one
      const existingEntry = scheduleEntries.find(
        e => e.user_id === userId && e.date === date
      );
      
      if (existingEntry) {
        setEditingEntry(existingEntry);
      } else {
        // Create new entry template
        const member = teamSections
          .flatMap(s => s.members)
          .find(m => m.user_id === userId);
        
        const teamId = teamSections.find(s => 
          s.members.some(m => m.user_id === userId)
        )?.teamId;
        
        if (member && teamId) {
          const teamName = teamSections.find(s => s.teamId === teamId)?.teamName || '';
          
          setEditingEntry({
            id: `temp-${userId}-${date}`,
            user_id: userId,
            team_id: teamId,
            date: date,
            shift_type: 'normal',
            activity_type: 'work',
            availability_status: 'available',
            notes: '',
            profiles: {
              first_name: member.first_name,
              last_name: member.last_name,
              initials: member.initials,
            },
            teams: {
              name: teamName,
            },
          });
        }
      }
      
      setEditDialogOpen(true);
    }
  }, [state.editingCell, scheduleEntries, teamSections]);

  useEffect(() => {
    if (user) {
      fetchCurrentUserProfile();
    }
  }, [user]);

  const fetchCurrentUserProfile = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, initials')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        setCurrentUserProfile({
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          initials: data.initials || '',
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  useEffect(() => {
    if (teamIds.length > 0) {
      fetchTeamSections();
      fetchScheduleEntries();
    }
  }, [teamIds, dateStart, rangeType, holidayRefetchTrigger]);

  const fetchTeamSections = async () => {
    setLoading(true);
    try {
      const sections: TeamSection[] = [];
      
      for (const teamId of teamIds) {
        const { data: team } = await supabase
          .from('teams')
          .select('name')
          .eq('id', teamId)
          .single();
        
        const { data: members, error } = await supabase
          .rpc('get_team_members_safe', { _team_id: teamId });

        if (error) {
          console.error('Error fetching members for team', teamId, ':', error);
          throw error;
        }

        // Log member data and validate
        console.log(`Team members for ${team?.name || teamId}:`, members);
        
        const validMembers = (members || []).map(m => ({
          user_id: m.user_id,
          first_name: m.first_name || 'Unknown',
          last_name: m.last_name || 'User',
          initials: m.initials || '??',
        }));

        sections.push({
          teamId,
          teamName: team?.name || 'Unknown Team',
          members: validMembers,
          color: getTeamColor(teamId),
        });
      }

      setTeamSections(sections);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduleEntries = async () => {
    if (teamIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('schedule_entries')
        .select('*')
        .in('team_id', teamIds)
        .gte('date', dates[0])
        .lte('date', dates[dates.length - 1]);

      if (error) throw error;
      setScheduleEntries(data || []);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      toast({
        title: "Error",
        description: "Failed to load schedule",
        variant: "destructive",
      });
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

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingEntry(null);
    setEditingCell(null);
  };

  const handleSaveEditDialog = async () => {
    await queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
    handleCloseEditDialog();
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const count = getDaysCount(rangeType);
    const newDate = new Date(dateStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? count : -count));
    setDateStart(newDate);
  };

  // Zoom controls
  const zoomLevels: DateRangeType[] = ['week', '2weeks', 'month', 'quarter', '6months', 'year'];

  const handleZoomIn = () => {
    const currentIndex = zoomLevels.indexOf(rangeType);
    if (currentIndex > 0) {
      const newRangeType = zoomLevels[currentIndex - 1];
      setRangeType(newRangeType);
      // Adjust start date to keep center date roughly the same
      const currentCenter = new Date(dateStart);
      currentCenter.setDate(currentCenter.getDate() + Math.floor(getDaysCount(rangeType) / 2));
      const newStart = new Date(currentCenter);
      newStart.setDate(newStart.getDate() - Math.floor(getDaysCount(newRangeType) / 2));
      setDateStart(getMonday(newStart));
    }
  };

  const handleZoomOut = () => {
    const currentIndex = zoomLevels.indexOf(rangeType);
    if (currentIndex < zoomLevels.length - 1) {
      const newRangeType = zoomLevels[currentIndex + 1];
      setRangeType(newRangeType);
      // Adjust start date to keep center date roughly the same
      const currentCenter = new Date(dateStart);
      currentCenter.setDate(currentCenter.getDate() + Math.floor(getDaysCount(rangeType) / 2));
      const newStart = new Date(currentCenter);
      newStart.setDate(newStart.getDate() - Math.floor(getDaysCount(newRangeType) / 2));
      setDateStart(getMonday(newStart));
    }
  };

  // Scroll to specific date
  const scrollToDate = (targetDate: Date) => {
    const dateStr = targetDate.toISOString().split('T')[0];
    const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    
    // For grid view, find the date column
    if (viewMode === 'grid') {
      const dateCell = document.querySelector(`[data-date="${dateStr}"]`);
      if (dateCell && scrollElement) {
        dateCell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
    
    // For weekly view, find the week containing the date
    if (viewMode === 'weekly') {
      const weekIndex = Math.floor(dates.indexOf(dateStr) / 7);
      const weekSection = document.querySelector(`[data-week-index="${weekIndex}"]`);
      if (weekSection && scrollElement) {
        weekSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    
    // For monthly view, find the month accordion
    if (viewMode === 'monthly') {
      const monthKey = dateStr.substring(0, 7); // "2025-11"
      const monthSection = document.querySelector(`[data-month="${monthKey}"]`);
      if (monthSection && scrollElement) {
        monthSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Helper to get automatic view mode based on range
  const getAutoViewMode = (range: DateRangeType): 'grid' | 'weekly' | 'monthly' => {
    if (range === 'week' || range === '2weeks') return 'grid';
    if (range === 'month' || range === 'quarter') return 'weekly';
    return 'monthly';
  };

  // Calculate coverage by date and team
  const scheduledCounts = useMemo(() => {
    return dates.reduce((acc, date) => {
      acc[date] = scheduleEntries.filter(
        e => e.date === date && e.availability_status === 'available'
      ).length;
      return acc;
    }, {} as Record<string, number>);
  }, [dates, scheduleEntries]);

  const teamBreakdowns = useMemo(() => {
    return dates.reduce((acc, date) => {
      acc[date] = teamSections.map(section => ({
        teamName: section.teamName,
        count: scheduleEntries.filter(
          e => e.date === date && 
          e.availability_status === 'available' &&
          section.members.some(m => m.user_id === e.user_id)
        ).length,
        total: section.members.length,
        color: section.color,
      }));
      return acc;
    }, {} as Record<string, any[]>);
  }, [dates, scheduleEntries, teamSections]);

  const totalMembers = teamSections.reduce((sum, section) => sum + section.members.length, 0);

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    
    teamSections.forEach(section => {
      const data = [
        ['Team', section.teamName],
        [],
        ['Member', ...dates.map(d => new Date(d).toLocaleDateString())],
      ];
      
      section.members.forEach(member => {
        const row = [
          `${member.first_name} ${member.last_name}`,
          ...dates.map(date => {
            const entry = scheduleEntries.find(e => e.user_id === member.user_id && e.date === date);
            return entry?.shift_type || entry?.activity_type || '';
          })
        ];
        data.push(row);
      });
      
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, section.teamName.substring(0, 31));
    });
    
    XLSX.writeFile(workbook, `schedule-${dateStart.toISOString().split('T')[0]}.xlsx`);
    toast({ title: 'Exported', description: 'Schedule exported to Excel' });
  };

  return (
    <>
      <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>Team Scheduler</CardTitle>
            <CardDescription>
              Collaborative scheduling across partnerships and multiple teams
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {!screenshotMode && (
              <>
                <div className="flex items-center gap-2 border-r pr-3">
                  <Switch 
                    id="show-holidays" 
                    checked={showHolidays} 
                    onCheckedChange={toggleHolidays}
                  />
                  <Label htmlFor="show-holidays" className="text-sm cursor-pointer">
                    Show Holidays
                  </Label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScreenshotMode(!screenshotMode)}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Screenshot
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToExcel}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </>
            )}
            {onlineUsers.length > 0 && (
              <OnlineUsersPanel users={onlineUsers} />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 mt-4">
          {/* Mode Selection Tabs */}
          <Tabs value={selectionMode} onValueChange={(v) => setSelectionMode(v as 'partnership' | 'multi-team')}>
            <TabsList>
              <TabsTrigger value="partnership">Partnership</TabsTrigger>
              <TabsTrigger value="multi-team">Multi-Team</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Conditional Team Selection */}
          {selectionMode === 'partnership' ? (
            <PartnershipSelector
              value={selectedPartnershipId}
              onChange={(id, ids) => {
                setSelectedPartnershipId(id);
                setTeamIds(ids);
              }}
            />
          ) : (
            <div className="space-y-3">
              {favorites.length > 0 && (
                <TeamFavoritesQuickAccess
                  favorites={favorites}
                  currentSelectedTeamIds={teamIds}
                  onApplyFavorite={(ids, name) => {
                    setTeamIds(ids);
                    toast({ 
                      title: 'Applied Favorite', 
                      description: `Viewing teams from "${name}"` 
                    });
                  }}
                />
              )}
              <MultiSelectTeams
                teams={allTeams}
                selectedTeamIds={teamIds}
                onValueChange={(ids) => setTeamIds(ids)}
                placeholder="Select teams to view"
              />
            </div>
          )}

          {/* Partnership Mode Notice */}
          {selectionMode === 'partnership' && !accessControl.isAdmin && !accessControl.isPlanner && !accessControl.isManager && (
            <Alert className="border-primary/50">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Partnership View: You can see shift types and availability for all teams in your partnership to coordinate shift swaps. Activity details are limited for privacy.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <DateRangeSelector
              startDate={dateStart}
              onStartDateChange={(date) => date && setDateStart(date)}
              rangeType={rangeType}
              onRangeTypeChange={(type) => setRangeType(type as DateRangeType)}
            />

            {/* Manual View Mode Toggle - only show for long date ranges */}
            {dates.length > 14 && (
              <div className="flex items-center gap-2 border-l pl-3">
                <Label className="text-sm text-muted-foreground">View:</Label>
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'weekly' | 'monthly')}>
                  <TabsList className="h-8">
                    <TabsTrigger value="grid" className="text-xs px-3">
                      Grid
                    </TabsTrigger>
                    <TabsTrigger value="weekly" className="text-xs px-3">
                      Weekly
                    </TabsTrigger>
                    <TabsTrigger value="monthly" className="text-xs px-3">
                      Monthly
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>{dates.length} days</span>
                  {viewMode !== getAutoViewMode(rangeType) && (
                    <Badge variant="outline" className="text-xs">Manual</Badge>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateDate('prev')}
                title="Previous period"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateStart(getMonday(new Date()))}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateDate('next')}
                title="Next period"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 border-l pl-2 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                title="Zoom out (show more days)"
                className="h-8 px-2"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                title="Zoom in (show fewer days)"
                className="h-8 px-2"
                disabled={rangeType === 'week'}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            {/* Jump to Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Jump to Date
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateStart}
                  onSelect={(date) => {
                    if (date) {
                      setDateStart(getMonday(date));
                      // Auto-scroll to that date in the view
                      setTimeout(() => {
                        scrollToDate(date);
                      }, 100);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {!screenshotMode && coverageAnalysis && (
          <CoverageAlerts 
            analysis={coverageAnalysis}
            partnershipName={selectionMode === 'partnership' ? partnershipName : undefined}
            partnershipConfig={selectionMode === 'partnership' ? partnershipConfig ?? undefined : undefined}
          />
        )}
      </CardHeader>

      <CardContent className="p-0">
        {!screenshotMode && (
          <div className="sticky top-0 z-20 bg-background border-b border-border">
            <QuickActionsToolbar
              hasSelection={state.selectedCells.size > 0}
              hasClipboard={state.clipboardPattern.length > 0}
              shiftTypes={shiftTypes}
              onSelectAll={handleSelectAll}
              onCopy={handleCopy}
              onPaste={handlePaste}
              onClear={handleClear}
              onQuickAssign={handleQuickAssign}
              onApplyTemplate={handleApplyTemplateClick}
            />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0">
            <TabsTrigger value="schedule" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
              Schedule
            </TabsTrigger>
            <TabsTrigger value="coverage" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
              Coverage Grid
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="mt-0">
            <div ref={scrollAreaRef} className="relative">
              {loading ? (
                <div className="flex items-center justify-center p-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              ) : viewMode === 'weekly' ? (
                <WeeklyGridView
                  teamSections={teamSections}
                  dates={dates}
                  scheduleEntries={scheduleEntries}
                  state={state}
                  cellsBeingEdited={cellsBeingEdited}
                  handlers={{
                    toggleUserSelection,
                    toggleCellSelection,
                    setEditingCell,
                    setHoveredCell,
                    startDrag,
                    endDrag,
                  }}
                  showHolidays={showHolidays}
                  shiftTypes={shiftTypes}
                  partnershipMode={selectionMode === 'partnership'}
                  partnershipConfig={partnershipConfig ?? undefined}
                  isPartnershipView={selectionMode === 'partnership'}
                  canViewActivityDetails={accessControl.isAdmin || accessControl.isPlanner}
                />
              ) : viewMode === 'monthly' ? (
                <MonthlyGridView
                  teamSections={teamSections}
                  dates={dates}
                  scheduleEntries={scheduleEntries}
                  shiftTypes={shiftTypes}
                  showHolidays={showHolidays}
                />
              ) : (
                <div className="relative">
                  <DateHeaderRow dates={dates} />
                  
                  <div className="space-y-8 mt-0 overflow-x-auto min-w-max">
                    <ShiftTypeCounterRow
                    dates={dates}
                    scheduleEntries={scheduleEntries}
                    shiftTypes={shiftTypes}
                    teamSections={teamSections}
                  />
                  {selectionMode === 'partnership' && partnershipConfig && (
                    <CoverageRow
                      dates={dates}
                      teamSize={totalMembers}
                      scheduledCounts={scheduledCounts}
                      teamBreakdowns={teamBreakdowns}
                      partnershipMode={true}
                      partnershipConfig={partnershipConfig}
                    />
                  )}
                  {teamSections.map((section) => (
                    <TeamSection
                      key={section.teamId}
                      teamId={section.teamId}
                      teamName={section.teamName}
                      teamColor={section.color}
                      members={section.members}
                      dates={dates}
                      scheduleEntries={scheduleEntries}
                      selectedUsers={state.selectedUsers}
                      selectedCells={state.selectedCells}
                      hoveredCell={state.hoveredCell}
                      editingCell={state.editingCell}
                      cellsBeingEdited={cellsBeingEdited}
                      onUserToggle={toggleUserSelection}
                      onCellClick={toggleCellSelection}
                      onCellDoubleClick={setEditingCell}
                      onCellHover={setHoveredCell}
                      onCellDragStart={startDrag}
                      onCellDragEnd={endDrag}
                      onSelectAllTeam={() => handleSelectAllTeam(section.teamId)}
                      showHolidays={showHolidays}
                      isPartnershipView={selectionMode === 'partnership'}
                      canViewActivityDetails={accessControl.isAdmin || accessControl.isPlanner}
                    />
                  ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="coverage" className="mt-0">
            <TeamCoverageGrid
              teamIds={teamIds}
              startDate={dateStart}
              endDate={endDate}
              showHolidays={showHolidays}
            />
          </TabsContent>

          <TabsContent value="analytics" className="mt-0 p-6 space-y-6">
            {coverageAnalysis && (
              <>
                <CoverageOverview analysis={coverageAnalysis} />
                <CoverageHeatmap
                  teamIds={teamIds}
                  startDate={dateStart}
                  endDate={endDate}
                  teams={teamSections.map(t => ({ id: t.teamId, name: t.teamName }))}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      </Card>

      {selectedTemplate && (
        <ApplyTemplateDialog
          open={applyTemplateDialogOpen}
          onOpenChange={setApplyTemplateDialogOpen}
          template={selectedTemplate}
          selectedUsers={teamSections
            .flatMap(s => s.members)
            .filter(m => state.selectedUsers.has(m.user_id))
            .map(m => ({ user_id: m.user_id, name: `${m.first_name} ${m.last_name}` }))}
          selectedDates={dates.filter(d => 
            Array.from(state.selectedCells).some(cellId => cellId.endsWith(`-${d}`))
          )}
          teamId={teamSections[0]?.teamId || ''}
          onApply={handleApplyTemplate}
        />
      )}

      {/* Edit Schedule Modal */}
      <EditScheduleModal
        entry={editingEntry}
        isOpen={editDialogOpen}
        onClose={handleCloseEditDialog}
        onSave={handleSaveEditDialog}
      />
    </>
  );
};

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

const getTeamColor = (teamId: string): string => {
  const colors = [
    'hsl(217, 91%, 60%)',
    'hsl(142, 71%, 45%)',
    'hsl(38, 92%, 50%)',
    'hsl(330, 81%, 60%)',
    'hsl(173, 80%, 40%)',
    'hsl(258, 90%, 66%)',
  ];
  
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) {
    hash = teamId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};
