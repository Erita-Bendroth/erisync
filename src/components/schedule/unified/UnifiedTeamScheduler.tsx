import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { QuickActionsToolbar } from './QuickActionsToolbar';
import { SchedulerGrid } from './SchedulerGrid';
import { OnlineUsersPanel } from './OnlineUsersPanel';
import { useSchedulerState, ScheduleEntry } from '@/hooks/useSchedulerState';
import { useSchedulerActions } from '@/hooks/useSchedulerActions';
import { useSchedulerPresence } from '@/hooks/useSchedulerPresence';
import { useDebounce } from '@/hooks/useDebounce';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

interface Team {
  id: string;
  name: string;
}

interface TeamMember {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
}

export const UnifiedTeamScheduler: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [showPartnerTeams, setShowPartnerTeams] = useState(false);
  const [loading, setLoading] = useState(false);
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
    selectRange,
  } = useSchedulerState();

  const {
    copyPattern,
    pastePattern,
    bulkAssignShift,
    clearCells,
  } = useSchedulerActions(scheduleEntries, setScheduleEntries, user?.id || '');

  // Generate dates for current week
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date.toISOString().split('T')[0];
  });

  useEffect(() => {
    if (user) {
      fetchTeams();
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
    if (selectedTeamId) {
      fetchTeamMembers();
      fetchScheduleEntries();
    }
  }, [selectedTeamId, weekStart]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setTeams(data || []);
      if (data && data.length > 0) {
        setSelectedTeamId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .rpc('get_team_members_safe', { _team_id: selectedTeamId });

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
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
    try {
      const startDate = weekStart.toISOString().split('T')[0];
      const endDate = new Date(weekStart);
      endDate.setDate(endDate.getDate() + 6);
      const endDateStr = endDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('schedule_entries')
        .select('*')
        .eq('team_id', selectedTeamId)
        .gte('date', startDate)
        .lte('date', endDateStr);

      if (error) throw error;
      setScheduleEntries(data || []);
    } catch (error) {
      console.error('Error fetching schedule entries:', error);
    }
  };

  const handleCopy = () => {
    const selectedCellIds = Array.from(state.selectedCells);
    const pattern = copyPattern(selectedCellIds);
    setClipboard(pattern);
    toast({
      title: "Pattern copied",
      description: `Copied ${pattern.length} cells`,
    });
  };

  const handlePaste = () => {
    const selectedCellIds = Array.from(state.selectedCells);
    pastePattern(state.clipboardPattern, selectedCellIds, selectedTeamId);
  };

  const handleQuickAssign = (shiftType: 'early' | 'late' | 'normal' | 'weekend') => {
    const selectedCellIds = Array.from(state.selectedCells);
    if (selectedCellIds.length === 0) {
      // Use selected users with all dates
      const userIds = Array.from(state.selectedUsers);
      const cellIds = userIds.flatMap(userId => 
        dates.map(date => `${userId}:${date}`)
      );
      bulkAssignShift(cellIds, shiftType, selectedTeamId);
    } else {
      bulkAssignShift(selectedCellIds, shiftType, selectedTeamId);
    }
  };

  const handleClear = () => {
    const selectedCellIds = Array.from(state.selectedCells);
    clearCells(selectedCellIds, selectedTeamId);
  };

  const handleSelectAll = () => {
    selectAllUsers(teamMembers.map(m => m.user_id));
  };

  const handleUpdateEntry = (entry: ScheduleEntry) => {
    setScheduleEntries(prev => {
      const existing = prev.findIndex(
        e => e.user_id === entry.user_id && e.date === entry.date && e.team_id === entry.team_id
      );
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], ...entry };
        return updated;
      }
      return [...prev, entry];
    });
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(weekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setWeekStart(newDate);
    clearSelection();
  };

  // Debounce editing cell to avoid spamming presence updates
  const debouncedEditingCell = useDebounce(state.editingCell, 300);

  // Enable presence tracking
  const { onlineUsers } = useSchedulerPresence(
    selectedTeamId,
    user?.id || '',
    currentUserProfile,
    debouncedEditingCell
  );

  // Calculate which cells are being edited by others
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Unified Team Scheduler
            </CardTitle>
            <CardDescription>
              Fast, collaborative team scheduling with multi-select and partner team visibility
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            {onlineUsers.length > 0 && <OnlineUsersPanel users={onlineUsers} />}
            <div className="flex items-center gap-2">
              <Switch
                id="partner-teams"
                checked={showPartnerTeams}
                onCheckedChange={setShowPartnerTeams}
              />
              <Label htmlFor="partner-teams">Show Partner Teams</Label>
            </div>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Week Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous Week
            </Button>
            <div className="text-sm font-medium">
              Week of {weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
              Next Week
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          {/* Quick Actions Toolbar */}
          <QuickActionsToolbar
            hasSelection={state.selectedCells.size > 0 || state.selectedUsers.size > 0}
            hasClipboard={state.clipboardPattern.length > 0}
            onSelectAll={handleSelectAll}
            onCopy={handleCopy}
            onPaste={handlePaste}
            onClear={handleClear}
            onQuickAssign={handleQuickAssign}
          />

          {/* Scheduler Grid */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading team members...</p>
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="flex items-center justify-center h-64 border border-border rounded-lg">
              <p className="text-muted-foreground">No team members found</p>
            </div>
          ) : (
            <SchedulerGrid
              teamMembers={teamMembers}
              dates={dates}
              scheduleEntries={scheduleEntries}
              selectedUsers={state.selectedUsers}
              selectedCells={state.selectedCells}
              hoveredCell={state.hoveredCell}
              editingCell={state.editingCell}
              onUserToggle={toggleUserSelection}
              onCellClick={toggleCellSelection}
              onCellDoubleClick={setEditingCell}
              onCellHover={setHoveredCell}
              onCellDragStart={startDrag}
              onCellDragEnd={endDrag}
              onUpdateEntry={handleUpdateEntry}
              teamId={selectedTeamId}
              currentUserId={user?.id || ''}
              cellsBeingEdited={cellsBeingEdited}
            />
          )}

          {/* Keyboard Shortcuts Help */}
          <div className="text-xs text-muted-foreground pt-4 border-t border-border">
            <p className="font-semibold mb-1">Keyboard Shortcuts:</p>
            <div className="grid grid-cols-2 gap-x-4">
              <p><kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+A</kbd> Select all team</p>
              <p><kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+C</kbd> Copy selection</p>
              <p><kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+V</kbd> Paste pattern</p>
              <p><kbd className="px-1 py-0.5 bg-muted rounded">Delete</kbd> Clear selection</p>
              <p><kbd className="px-1 py-0.5 bg-muted rounded">Double-click</kbd> Quick edit cell</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Helper function to get Monday of current week
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}
