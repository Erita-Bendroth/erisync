import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { QuickActionsToolbar } from './QuickActionsToolbar';
import { TeamSection } from './TeamSection';
import { OnlineUsersPanel } from './OnlineUsersPanel';
import { CoverageRow } from './CoverageRow';
import { PartnershipSelector } from './PartnershipSelector';
import { DateRangeSelector, DateRangeType, getDaysCount } from './DateRangeSelector';
import { useSchedulerState, ScheduleEntry } from '@/hooks/useSchedulerState';
import { useSchedulerActions } from '@/hooks/useSchedulerActions';
import { useSchedulerPresence } from '@/hooks/useSchedulerPresence';
import { useShiftTypes } from '@/hooks/useShiftTypes';
import { useRotationTemplates } from '@/hooks/useRotationTemplates';
import { useDebounce } from '@/hooks/useDebounce';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { ApplyTemplateDialog } from '../ApplyTemplateDialog';

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
  const [selectedPartnershipId, setSelectedPartnershipId] = useState<string>('');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [teamSections, setTeamSections] = useState<TeamSection[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [dateStart, setDateStart] = useState<Date>(getMonday(new Date()));
  const [rangeType, setRangeType] = useState<DateRangeType>('week');
  const [loading, setLoading] = useState(false);
  const [applyTemplateDialogOpen, setApplyTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{
    firstName: string;
    lastName: string;
    initials: string;
  }>({ firstName: '', lastName: '', initials: '' });

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
    endDrag,
  } = useSchedulerState();

  const {
    copyPattern,
    pastePattern,
    bulkAssignShift,
    clearCells,
  } = useSchedulerActions(scheduleEntries, setScheduleEntries, user?.id || '');

  const { shiftTypes } = useShiftTypes(teamIds);
  const { templates } = useRotationTemplates(teamIds);

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
  }, [teamIds, dateStart, rangeType]);

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

        if (error) throw error;

        sections.push({
          teamId,
          teamName: team?.name || 'Unknown Team',
          members: members || [],
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
    const firstTeamId = teamIds[0];
    if (firstTeamId) {
      pastePattern(state.clipboardPattern, Array.from(state.selectedCells), firstTeamId);
      toast({ title: "Pasted", description: "Schedule pattern applied" });
    }
  };

  const handleQuickAssign = (shiftType: string) => {
    if (state.selectedCells.size === 0) {
      toast({ title: "No cells selected", description: "Please select cells to assign" });
      return;
    }
    const firstTeamId = teamIds[0];
    if (firstTeamId) {
      bulkAssignShift(Array.from(state.selectedCells), shiftType as any, firstTeamId);
      toast({ title: "Assigned", description: `${shiftType} shift assigned` });
    }
  };

  const handleClear = () => {
    if (state.selectedCells.size === 0) {
      toast({ title: "No cells selected", description: "Please select cells to clear" });
      return;
    }
    clearCells(Array.from(state.selectedCells), teamIds[0]);
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

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>Partnership Scheduler</CardTitle>
            <CardDescription>
              Collaborative scheduling across planning partnerships
            </CardDescription>
          </div>
          {onlineUsers.length > 0 && (
            <OnlineUsersPanel users={onlineUsers} />
          )}
        </div>

        <div className="flex flex-col gap-4 mt-4">
          <PartnershipSelector
            value={selectedPartnershipId}
            onChange={(id, ids) => {
              setSelectedPartnershipId(id);
              setTeamIds(ids);
            }}
          />

          <div className="flex items-center justify-between gap-4">
            <DateRangeSelector
              startDate={dateStart}
              onStartDateChange={(date) => date && setDateStart(date)}
              rangeType={rangeType}
              onRangeTypeChange={(type) => setRangeType(type as DateRangeType)}
            />

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateDate('prev')}
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
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
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

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-muted-foreground">Loading teams...</div>
          </div>
        ) : teamSections.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-muted-foreground">
              No teams in this partnership
            </div>
          </div>
        ) : (
          <>
            {/* Header Row with Dates */}
            <div className="grid grid-cols-[200px_1fr] border-b border-border bg-muted/30 sticky top-0 z-10">
              <div className="px-4 py-2 font-semibold text-sm border-r border-border">
                Team Members
              </div>
              <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(80px, 1fr))` }}>
                {dates.map((date) => {
                  const dateObj = new Date(date);
                  return (
                    <div
                      key={date}
                      className="px-2 py-2 text-center border-r border-border text-xs font-medium"
                    >
                      <div>{dateObj.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div className="text-muted-foreground">
                        {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Team Sections */}
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
              />
            ))}

            {/* Coverage Row */}
            <CoverageRow
              dates={dates}
              teamSize={totalMembers}
              scheduledCounts={scheduledCounts}
              teamBreakdowns={teamBreakdowns}
            />
          </>
        )}

        {/* Keyboard Shortcuts Info */}
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold">Shortcuts:</span> Click to select • Double-click to edit • Drag to select range
          </div>
        </div>
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
  </div>
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
