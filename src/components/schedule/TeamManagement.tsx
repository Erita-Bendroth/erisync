import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Users, Settings, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";

interface Team {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  is_manager: boolean;
  profiles: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

const TeamManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ [teamId: string]: TeamMember[] }>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>("");

  const [teamForm, setTeamForm] = useState({
    name: "",
    description: "",
  });

  const [memberForm, setMemberForm] = useState({
    user_id: "",
    team_id: "",
    is_manager: false,
  });

  useEffect(() => {
    fetchTeams();
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (teams.length > 0) {
      teams.forEach(team => fetchTeamMembers(team.id));
    }
  }, [teams]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("name");

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error("Error fetching teams:", error);
      toast({
        title: "Error",
        description: "Failed to load teams",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async (teamId: string) => {
    try {
      console.log(`Fetching team members for team: ${teamId}`);
      const { data, error } = await supabase
        .from("team_members")
        .select(`
          id,
          user_id,
          team_id,
          is_manager,
          created_at,
          profiles!inner (first_name, last_name, email)
        `)
        .eq("team_id", teamId);

      console.log(`Query result for team ${teamId}:`, { data, error });

      if (error) {
        console.error(`Error fetching team members for ${teamId}:`, error);
        throw error;
      }
      
      // Transform the data to match our interface
      const transformedData = data?.map(item => ({
        ...item,
        profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
      })) || [];
      
      console.log(`Transformed data for team ${teamId}:`, transformedData);
      setTeamMembers(prev => ({ ...prev, [teamId]: transformedData }));
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .order("first_name");

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from("teams")
        .insert([{
          name: teamForm.name,
          description: teamForm.description,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team created successfully",
      });

      setCreateTeamOpen(false);
      setTeamForm({ name: "", description: "" });
      fetchTeams();
    } catch (error: any) {
      console.error("Error creating team:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create team",
        variant: "destructive",
      });
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!memberForm.user_id || !memberForm.team_id) {
      toast({
        title: "Error",
        description: "Please select both user and team",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("team_members")
        .insert([{
          user_id: memberForm.user_id,
          team_id: memberForm.team_id,
          is_manager: memberForm.is_manager,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team member added successfully",
      });

      setAddMemberOpen(false);
      setMemberForm({ user_id: "", team_id: "", is_manager: false });
      fetchTeamMembers(memberForm.team_id);
    } catch (error: any) {
      console.error("Error adding team member:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add team member",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId: string, teamId: string) => {
    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team member removed successfully",
      });

      fetchTeamMembers(teamId);
    } catch (error: any) {
      console.error("Error removing team member:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove team member",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading teams...</h2>
          <p className="text-muted-foreground">Please wait</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team Management</h2>
          <p className="text-muted-foreground">
            Manage teams and their members
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Users className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Add a user to a team and set their role
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="user">User</Label>
                  <Select
                    value={memberForm.user_id}
                    onValueChange={(value) => setMemberForm({ ...memberForm, user_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.user_id} value={profile.user_id}>
                          {profile.first_name} {profile.last_name} ({profile.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team">Team</Label>
                  <Select
                    value={memberForm.team_id}
                    onValueChange={(value) => setMemberForm({ ...memberForm, team_id: value })}
                    required
                  >
                    <SelectTrigger>
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
                <div className="space-y-2">
                  <Label htmlFor="manager">Manager Role</Label>
                  <Select
                    value={memberForm.is_manager.toString()}
                    onValueChange={(value) => setMemberForm({ ...memberForm, is_manager: value === "true" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">Team Member</SelectItem>
                      <SelectItem value="true">Team Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setAddMemberOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Member</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={createTeamOpen} onOpenChange={setCreateTeamOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Create Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Team</DialogTitle>
                <DialogDescription>
                  Add a new team to organize your employees
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Team Name</Label>
                  <Input
                    id="name"
                    value={teamForm.name}
                    onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                    placeholder="Enter team name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={teamForm.description}
                    onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                    placeholder="Describe the team's purpose"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setCreateTeamOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Team</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6">
        {teams.map((team) => (
          <Card key={team.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    {team.name}
                  </CardTitle>
                  {team.description && (
                    <CardDescription>{team.description}</CardDescription>
                  )}
                </div>
                <Badge variant="secondary">
                  {teamMembers[team.id]?.length || 0} members
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {teamMembers[team.id]?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers[team.id].map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.profiles.first_name} {member.profiles.last_name}
                        </TableCell>
                        <TableCell>{member.profiles.email}</TableCell>
                        <TableCell>
                          <Badge variant={member.is_manager ? "default" : "secondary"}>
                            {member.is_manager ? "Manager" : "Member"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id, team.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No members in this team yet
                </p>
              )}
            </CardContent>
          </Card>
        ))}

        {teams.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first team to start organizing your employees
              </p>
              <Button onClick={() => setCreateTeamOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Team
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TeamManagement;