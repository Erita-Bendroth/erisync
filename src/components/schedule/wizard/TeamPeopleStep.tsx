import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "./BulkScheduleWizard";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  initials?: string;
}

interface TeamPeopleStepProps {
  wizardData: WizardData;
  updateWizardData: (updates: Partial<WizardData>) => void;
}

export const TeamPeopleStep = ({ wizardData, updateWizardData }: TeamPeopleStepProps) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    if (wizardData.selectedTeam) {
      fetchUsers();
    }
  }, [wizardData.selectedTeam]);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error("Error fetching teams:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Step 1: Get team members
      const { data: membersData, error: membersError } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", wizardData.selectedTeam);

      if (membersError) {
        console.error("Error fetching team members:", membersError);
        throw membersError;
      }

      if (!membersData || membersData.length === 0) {
        setUsers([]);
        return;
      }

      // Step 2: Get profiles for those users using RPC function
      const userIds = membersData.map(member => member.user_id);
      
      const { data: profilesData, error: profilesError } = await supabase
        .rpc('get_multiple_basic_profile_info', { _user_ids: userIds });

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw profilesError;
      }

      // Transform the data to match the expected User interface
      const userList = profilesData?.map((profile: any) => ({
        id: profile.user_id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        initials: profile.initials
      })) || [];

      setUsers(userList);
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserToggle = (userId: string) => {
    const newSelection = wizardData.selectedUsers.includes(userId)
      ? wizardData.selectedUsers.filter(id => id !== userId)
      : [...wizardData.selectedUsers, userId];
    updateWizardData({ selectedUsers: newSelection });
  };

  const handleSelectAll = () => {
    updateWizardData({ selectedUsers: users.map(u => u.id) });
  };

  const handleDeselectAll = () => {
    updateWizardData({ selectedUsers: [] });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Who should be scheduled?</h2>
        <p className="text-muted-foreground">
          {wizardData.mode === "team" 
            ? "Select the team to schedule" 
            : "Select the team and specific people to schedule"}
        </p>
      </div>

      <div className={cn(
        "grid gap-6",
        wizardData.mode === "team" ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"
      )}>
        {/* Team Selection */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team" className="text-base font-medium">Select Team</Label>
            <Select
              value={wizardData.selectedTeam}
              onValueChange={(value) => {
                updateWizardData({ selectedTeam: value, selectedUsers: [] });
              }}
            >
              <SelectTrigger id="team" className="h-11">
                <SelectValue placeholder="Choose a team..." />
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

          {wizardData.selectedTeam && wizardData.mode === "team" && (
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> All members of {teams.find(t => t.id === wizardData.selectedTeam)?.name} will be scheduled.
              </p>
            </div>
          )}
        </div>

        {/* People Selection - Only show if not "team" mode */}
        {wizardData.mode !== "team" && wizardData.selectedTeam && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">
                Select People ({wizardData.selectedUsers.length} selected)
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={loading}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDeselectAll}
                  disabled={loading}
                >
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No team members found
                </div>
              ) : (
                users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => handleUserToggle(user.id)}
                  >
                    <Checkbox
                      checked={wizardData.selectedUsers.includes(user.id)}
                      onCheckedChange={() => handleUserToggle(user.id)}
                    />
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">
                        {user.initials || `${user.first_name?.[0]}${user.last_name?.[0]}`}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">
                        {user.first_name} {user.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
