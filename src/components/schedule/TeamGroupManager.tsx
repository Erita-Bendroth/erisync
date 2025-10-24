import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save } from "lucide-react";

interface TeamGroup {
  id: string;
  name: string;
  team_ids: string[];
}

export function TeamGroupManager() {
  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTeams();
    fetchGroups();
  }, []);

  const fetchTeams = async () => {
    const { data } = await supabase.from("teams").select("id, name").order("name");
    if (data) setTeams(data);
  };

  const fetchGroups = async () => {
    const { data, error } = await supabase
      .from("team_groups")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch team groups",
        variant: "destructive",
      });
    } else {
      setGroups(data || []);
    }
  };

  const saveGroup = async () => {
    if (!newGroupName.trim() || selectedTeams.length === 0) {
      toast({
        title: "Error",
        description: "Please provide a name and select at least one team",
        variant: "destructive",
      });
      return;
    }

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const groupData = {
      name: newGroupName,
      team_ids: selectedTeams,
      created_by: user.user.id,
    };

    if (editingId) {
      const { error } = await supabase
        .from("team_groups")
        .update(groupData)
        .eq("id", editingId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update group",
          variant: "destructive",
        });
      } else {
        toast({ title: "Success", description: "Team group updated" });
        resetForm();
        fetchGroups();
      }
    } else {
      const { error } = await supabase.from("team_groups").insert(groupData);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to create group",
          variant: "destructive",
        });
      } else {
        toast({ title: "Success", description: "Team group created" });
        resetForm();
        fetchGroups();
      }
    }
  };

  const editGroup = (group: TeamGroup) => {
    setNewGroupName(group.name);
    setSelectedTeams(group.team_ids);
    setEditingId(group.id);
  };

  const deleteGroup = async (groupId: string) => {
    const { error } = await supabase
      .from("team_groups")
      .delete()
      .eq("id", groupId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete group",
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Team group deleted" });
      fetchGroups();
    }
  };

  const resetForm = () => {
    setNewGroupName("");
    setSelectedTeams([]);
    setEditingId(null);
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeams((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Groups</CardTitle>
        <CardDescription>
          Create groups of teams for combined overview and reporting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create/Edit Form */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div className="space-y-2">
            <Label>Group Name</Label>
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g., Turbine Troubleshooting Central"
            />
          </div>

          <div className="space-y-2">
            <Label>Select Teams</Label>
            <div className="flex flex-wrap gap-2">
              {teams.map((team) => (
                <Badge
                  key={team.id}
                  variant={selectedTeams.includes(team.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleTeam(team.id)}
                >
                  {team.name}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveGroup}>
              <Save className="w-4 h-4 mr-2" />
              {editingId ? "Update Group" : "Create Group"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Existing Groups */}
        <div className="space-y-2">
          <Label>Existing Groups</Label>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team groups yet</p>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{group.name}</div>
                    <div className="flex flex-wrap gap-1">
                      {group.team_ids.map((teamId) => {
                        const team = teams.find((t) => t.id === teamId);
                        return team ? (
                          <Badge key={teamId} variant="secondary" className="text-xs">
                            {team.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => editGroup(group)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteGroup(group.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
