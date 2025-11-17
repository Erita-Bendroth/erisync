import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TeamPeopleSelectorProps {
  teamId: string | null;
  selectedUserIds: string[];
  onTeamChange: (teamId: string) => void;
  onUserSelectionChange: (userIds: string[]) => void;
  mode: 'users' | 'team' | 'rotation';
}

export const TeamPeopleSelector = ({
  teamId,
  selectedUserIds,
  onTeamChange,
  onUserSelectionChange,
  mode,
}: TeamPeopleSelectorProps) => {
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [teamMembers, setTeamMembers] = useState<Array<{ user_id: string; first_name: string; last_name: string; initials: string }>>([]);

  useEffect(() => {
    const fetchTeams = async () => {
      const { data } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');
      
      if (data) {
        setTeams(data);
      }
    };

    fetchTeams();
  }, []);

  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!teamId) return;

      const { data } = await supabase
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

      if (data) {
        const members = data.map(m => ({
          user_id: m.user_id,
          first_name: (m.profiles as any)?.first_name || '',
          last_name: (m.profiles as any)?.last_name || '',
          initials: (m.profiles as any)?.initials || '',
        }));
        setTeamMembers(members);
      }
    };

    fetchTeamMembers();
  }, [teamId]);

  const toggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onUserSelectionChange(selectedUserIds.filter(id => id !== userId));
    } else {
      onUserSelectionChange([...selectedUserIds, userId]);
    }
  };

  const selectAll = () => {
    onUserSelectionChange(teamMembers.map(m => m.user_id));
  };

  const deselectAll = () => {
    onUserSelectionChange([]);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Team</Label>
        <Select value={teamId || ''} onValueChange={onTeamChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a team" />
          </SelectTrigger>
          <SelectContent>
            {teams.map(team => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode !== 'team' && teamMembers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Team Members</Label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={deselectAll}>
                Clear
              </Button>
            </div>
          </div>

          <ScrollArea className="h-48 border rounded-md p-4">
            <div className="space-y-3">
              {teamMembers.map(member => (
                <div key={member.user_id} className="flex items-center space-x-2">
                  <Checkbox
                    id={member.user_id}
                    checked={selectedUserIds.includes(member.user_id)}
                    onCheckedChange={() => toggleUser(member.user_id)}
                  />
                  <label
                    htmlFor={member.user_id}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {member.initials} ({member.first_name} {member.last_name})
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="text-xs text-muted-foreground">
            {selectedUserIds.length} of {teamMembers.length} selected
          </div>
        </div>
      )}

      {mode === 'team' && teamMembers.length > 0 && (
        <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md">
          Will create shifts for all {teamMembers.length} team members
        </div>
      )}
    </div>
  );
};
