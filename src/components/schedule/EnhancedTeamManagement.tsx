import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Download, Users, Trash2, MoreHorizontal, Shield, Pencil, Settings, Plus, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { formatUserName } from "@/lib/utils";
import { TeamCapacityConfig } from '@/components/admin/TeamCapacityConfig';
import UserProfileOverview from "@/components/profile/UserProfileOverview";

interface Team {
  id: string;
  name: string;
  description?: string;
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
    initials?: string;
    user_id: string;
  };
  user_roles: Array<{
    role: string;
  }>;
}

interface UserRole {
  role: string;
}

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
  email?: string;
}

const EnhancedTeamManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ [key: string]: TeamMember[] }>({});
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editTeamForm, setEditTeamForm] = useState({ name: "", description: "" });
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [memberForm, setMemberForm] = useState({
    user_id: "",
    team_id: "",
    is_manager: false,
  });
  const [childTeamManagers, setChildTeamManagers] = useState<Map<string, Set<string>>>(new Map());

  useEffect(() => {
    fetchUserRoles();
  }, [user]);

  useEffect(() => {
    // Only fetch teams after user roles have been loaded
    if (userRoles.length > 0) {
      fetchTeamsAndMembers();
      fetchProfiles();
    }
  }, [user, userRoles]);

  const fetchUserRoles = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (error) throw error;
      setUserRoles(data || []);
    } catch (error) {
      console.error("Error fetching user roles:", error);
    }
  };

  const isManager = () => userRoles.some(role => role.role === "manager");
  const isPlanner = () => userRoles.some(role => role.role === "planner");
  const isTeamMember = () => userRoles.some(role => role.role === "teammember");
  const isAdmin = () => userRoles.some(role => role.role === "admin");
  const canEditTeams = () => isAdmin() || isPlanner();

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_all_basic_profiles');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  const fetchTeamsAndMembers = async () => {
    if (!user || userRoles.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch teams based on user role
      let teamsQuery = supabase.from('teams').select('*').order('name');
      let teamsData: Team[] = [];
      
      if (isManager() && !isPlanner() && !isAdmin()) {
        // Managers only see their DIRECTLY managed teams (not parent teams)
        const { data: managerTeams } = await supabase
          .from('team_members')
          .select('team_id, teams!inner(id, parent_team_id)')
          .eq('user_id', user?.id)
          .eq('is_manager', true);
        
        if (managerTeams && managerTeams.length > 0) {
          const allManagerTeamIds = managerTeams.map((t: any) => t.team_id);
          const directTeamIds: string[] = [];
          
          // Filter to only directly managed teams
          for (const tm of managerTeams as any[]) {
            const teamId = tm.team_id;
            
            // Check if this team has child teams
            const { data: childTeams } = await supabase
              .from('teams')
              .select('id')
              .eq('parent_team_id', teamId);
            
            if (childTeams && childTeams.length > 0) {
              // This team has children - check if user manages any child
              const childTeamIds = childTeams.map(c => c.id);
              const managesChildTeam = allManagerTeamIds.some(id => 
                childTeamIds.includes(id)
              );
              
              // Only include parent team if user doesn't manage any child teams
              if (!managesChildTeam) {
                directTeamIds.push(teamId);
              }
            } else {
              // No children, so this is a directly managed team
              directTeamIds.push(teamId);
            }
          }
          
          if (directTeamIds.length > 0) {
            const { data, error } = await supabase
              .from('teams')
              .select('*')
              .in('id', directTeamIds)
              .order('name');
            
            if (error) throw error;
            teamsData = data || [];
          }
        }
      } else {
        const { data, error: teamsError } = await teamsQuery;
        if (teamsError) throw teamsError;
        teamsData = data || [];
      }

      setTeams(teamsData);

      // Fetch child team managers for badge filtering
      const childManagersMap = new Map<string, Set<string>>();
      for (const team of teamsData) {
        const { data: childTeams } = await supabase
          .from('teams')
          .select('id')
          .eq('parent_team_id', team.id);
        
        if (childTeams && childTeams.length > 0) {
          const childTeamIds = childTeams.map(c => c.id);
          const { data: childManagers } = await supabase
            .from('team_members')
            .select('user_id')
            .in('team_id', childTeamIds)
            .eq('is_manager', true);
          
          if (childManagers) {
            childManagersMap.set(team.id, new Set(childManagers.map(m => m.user_id)));
          }
        }
      }
      setChildTeamManagers(childManagersMap);

      // Fetch members for each team
      const membersMap: { [key: string]: TeamMember[] } = {};
      
      for (const team of teamsData) {
        const { data: members, error: membersError } = await supabase
          .from('team_members')
          .select('id, user_id, team_id, is_manager')
          .eq('team_id', team.id);

        if (membersError) {
          console.error(`Error fetching members for team ${team.name}:`, membersError);
          continue;
        }

        // Get user roles and profiles separately
        const userIds = members?.map(m => m.user_id) || [];
        
        const [rolesResponse, profilesResponse] = await Promise.all([
          supabase
            .from('user_roles')
            .select('user_id, role')
            .in('user_id', userIds),
          supabase
            .from('profiles')
            .select('user_id, first_name, last_name, email, initials')
            .in('user_id', userIds) as any
        ]);

        const rolesMap = (rolesResponse.data || []).reduce((acc, role) => {
          if (!acc[role.user_id]) acc[role.user_id] = [];
          acc[role.user_id].push({ role: role.role });
          return acc;
        }, {} as { [key: string]: Array<{role: string}> });

        const profilesMap = (profilesResponse.data || []).reduce((acc, profile) => {
          acc[profile.user_id] = profile;
          return acc;
        }, {} as { [key: string]: { first_name: string; last_name: string; email: string; user_id: string; initials?: string } });

        // Filter out members with incomplete profile data and map them properly
        const membersWithRoles = (members || [])
          .filter(member => profilesMap[member.user_id])
          .map(member => ({
            ...member,
            profiles: profilesMap[member.user_id],
            user_roles: rolesMap[member.user_id] || []
          }));

        membersMap[team.id] = membersWithRoles;
      }

      setTeamMembers(membersMap);
    } catch (error) {
      console.error('Error fetching teams and members:', error);
      toast({
        title: "Error",
        description: "Failed to load teams and members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleTeamExpanded = (teamId: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);
  };

  // Check if user should show manager badge in this team
  const shouldShowManagerBadge = (userId: string, teamId: string, isManager: boolean): boolean => {
    if (!isManager) return false;
    
    // Get child team managers for this team
    const childManagers = childTeamManagers.get(teamId);
    if (!childManagers) return true;
    
    // Hide badge if user is a child team manager (they only manage child teams, not this parent team)
    return !childManagers.has(userId);
  };

  const removeTeamMember = async (memberId: string, teamId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team member removed successfully",
      });

      fetchTeamsAndMembers();
    } catch (error: any) {
      console.error('Error removing team member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove team member",
        variant: "destructive",
      });
    }
  };

  const downloadTeamData = async (teamId: string, format: 'excel' | 'pdf') => {
    try {
      const team = teams.find(t => t.id === teamId);
      const members = teamMembers[teamId] || [];
      
      if (!team) return;

      // Create data for export
      const exportData = members.map(member => ({
        Name: formatUserName(member.profiles.first_name, member.profiles.last_name, member.profiles.initials),
        Email: member.profiles.email,
        Role: member.user_roles.map(r => r.role).join(', '),
        'Team Manager': member.is_manager ? 'Yes' : 'No',
        Team: team.name
      }));

      if (format === 'excel') {
        // Create CSV content
        const headers = Object.keys(exportData[0] || {});
        const csvContent = [
          headers.join(','),
          ...exportData.map(row => headers.map(header => `"${row[header as keyof typeof row] || ''}"`).join(','))
        ].join('\n');
        
        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${team.name}_team_data.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'pdf') {
        // For PDF, we'll use a simple HTML to PDF approach
        const htmlContent = `
          <html>
            <head>
              <title>${team.name} Team Report</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; border-bottom: 2px solid #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f5f5f5; font-weight: bold; }
                tr:nth-child(even) { background-color: #f9f9f9; }
              </style>
            </head>
            <body>
              <h1>${team.name} Team Report</h1>
              <p>Generated on: ${new Date().toLocaleDateString()}</p>
              <p>Total Members: ${members.length}</p>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Team Manager</th>
                  </tr>
                </thead>
                <tbody>
                  ${members.map(member => `
                    <tr>
                      <td>${member.profiles.first_name} ${member.profiles.last_name}</td>
                      <td>${member.profiles.email}</td>
                      <td>${member.user_roles.map(r => r.role).join(', ')}</td>
                      <td>${member.is_manager ? 'Yes' : 'No'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </body>
          </html>
        `;
        
        // Create a new window for printing
        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          printWindow.print();
        }
      }

      toast({
        title: "Export Complete",
        description: `Team data exported as ${format.toUpperCase()}`,
      });

    } catch (error: any) {
      console.error('Error exporting team data:', error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export team data",
        variant: "destructive",
      });
    }
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setEditTeamForm({ name: team.name, description: team.description || "" });
    setEditTeamOpen(true);
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
      fetchTeamsAndMembers();
    } catch (error: any) {
      console.error("Error adding team member:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add team member",
        variant: "destructive",
      });
    }
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingTeam) return;

    // Validation: Check for empty name
    if (!editTeamForm.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Team name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    // Validation: Check for duplicate team names
    const duplicateTeam = teams.find(
      t => t.id !== editingTeam.id && t.name.toLowerCase() === editTeamForm.name.trim().toLowerCase()
    );

    if (duplicateTeam) {
      toast({
        title: "Validation Error",
        description: "A team with this name already exists",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('teams')
        .update({
          name: editTeamForm.name.trim(),
          description: editTeamForm.description.trim() || null,
        })
        .eq('id', editingTeam.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team updated successfully",
      });

      setEditTeamOpen(false);
      setEditingTeam(null);
      setEditTeamForm({ name: "", description: "" });
      fetchTeamsAndMembers();
    } catch (error: any) {
      console.error('Error updating team:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update team",
        variant: "destructive",
      });
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "planner":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "manager":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "teammember":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  if (!isManager() && !isPlanner()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Team Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Manager or Planner access required to view team management.
          </p>
        </CardContent>
      </Card>
    );
  }

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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Team Management
              </CardTitle>
              <CardDescription>
                Manage teams and their members
              </CardDescription>
            </div>
            {canEditTeams() && (
              <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
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
                              {formatUserName(profile.first_name, profile.last_name, profile.initials)} {profile.email ? `(${profile.email})` : ''}
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
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {teams.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No teams found</p>
            </div>
          ) : (
            teams.map((team) => {
              const members = teamMembers[team.id] || [];
              const isExpanded = expandedTeams.has(team.id);
              
              return (
                <div key={team.id} className="border rounded-lg">
                  <Collapsible open={isExpanded} onOpenChange={() => toggleTeamExpanded(team.id)}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <div className="flex items-center gap-2">
                            <div>
                              <h3 className="font-semibold text-lg">{team.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {team.description || `Auto-imported team: ${team.name}`}
                              </p>
                            </div>
                            {canEditTeams() && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditTeam(team);
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">
                            {members.length} member{members.length !== 1 ? 's' : ''}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                                <Download className="w-4 h-4 mr-2" />
                                Export
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => downloadTeamData(team.id, 'excel')}>
                                Export as Excel
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadTeamData(team.id, 'pdf')}>
                                Export as PDF
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="px-4 pb-4 space-y-6">
                        {/* Team Capacity Configuration */}
                        <div className="border-b pb-4">
                          <TeamCapacityConfig teamId={team.id} teamName={team.name} />
                        </div>
                        
                        {/* Team Members Table */}
                        <div>
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Team Members
                          </h4>
                          <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {members.map((member) => (
                              <TableRow key={member.id}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {formatUserName(member.profiles.first_name, member.profiles.last_name, member.profiles.initials)}
                                    {shouldShowManagerBadge(member.user_id, team.id, member.is_manager) && (
                                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                        Manager
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>{member.profiles.email}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {member.user_roles.map((roleObj, index) => (
                                      <Badge key={index} className={getRoleColor(roleObj.role)}>
                                        {roleObj.role}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {member.user_id !== user?.id && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="outline" size="sm">
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to remove {formatUserName(member.profiles.first_name, member.profiles.last_name, member.profiles.initials)} from {team.name}?
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction 
                                            onClick={() => removeTeamMember(member.id, team.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Remove
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        </div>
                        
                        {/* Team Member Overview - Working and Vacation Days */}
                        {canEditTeams() && members.length > 0 && (
                          <div className="space-y-4 pt-4 border-t">
                            <h4 className="text-lg font-medium flex items-center">
                              <BarChart3 className="w-5 h-5 mr-2 text-primary" />
                              Team Member Overview
                            </h4>
                            <div className="grid gap-4">
                              {members.map((member) => (
                                <UserProfileOverview
                                  key={member.user_id}
                                  userId={member.user_id}
                                  teamId={team.id}
                                  canView={true}
                                  showTeamContext={false}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Edit Team Dialog */}
      <Dialog open={editTeamOpen} onOpenChange={setEditTeamOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>
              Update the team name and description. Team name must be unique.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateTeam}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-team-name">Team Name *</Label>
                <Input
                  id="edit-team-name"
                  value={editTeamForm.name}
                  onChange={(e) => setEditTeamForm({ ...editTeamForm, name: e.target.value })}
                  placeholder="Enter team name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-team-description">Description</Label>
                <Textarea
                  id="edit-team-description"
                  value={editTeamForm.description}
                  onChange={(e) => setEditTeamForm({ ...editTeamForm, description: e.target.value })}
                  placeholder="Enter team description (optional)"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTeamOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnhancedTeamManagement;