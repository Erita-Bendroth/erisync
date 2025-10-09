import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Download, Users, Trash2, MoreHorizontal, Shield, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";

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
  };
  user_roles: Array<{
    role: string;
  }>;
}

interface UserRole {
  role: string;
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

  useEffect(() => {
    if (user) {
      fetchUserRoles();
      fetchTeamsAndMembers();
    }
  }, [user?.id]); // Only re-run when user ID actually changes

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
  const isAdmin = () => userRoles.some(role => role.role === "admin");
  const isTeamMember = () => userRoles.some(role => role.role === "teammember");
  const canEditTeams = () => isAdmin() || isPlanner();

  const fetchTeamsAndMembers = async () => {
    try {
      setLoading(true);
      
      // Fetch teams based on user role
      let teamsQuery = supabase.from('teams').select('*').order('name');
      
      if (isManager() && !isPlanner()) {
        // Managers only see their assigned teams
        const { data: managerTeams } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user?.id)
          .eq('is_manager', true);
        
        if (managerTeams && managerTeams.length > 0) {
          const teamIds = managerTeams.map(t => t.team_id);
          teamsQuery = teamsQuery.in('id', teamIds);
        } else {
          setTeams([]);
          setLoading(false);
          return;
        }
      }

      const { data: teamsData, error: teamsError } = await teamsQuery;
      if (teamsError) throw teamsError;

      setTeams(teamsData || []);

      // Fetch members for each team
      const membersMap: { [key: string]: TeamMember[] } = {};
      
      for (const team of teamsData || []) {
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
            .select('user_id, first_name, last_name, email')
            .in('user_id', userIds)
        ]);

        const rolesMap = (rolesResponse.data || []).reduce((acc, role) => {
          if (!acc[role.user_id]) acc[role.user_id] = [];
          acc[role.user_id].push({ role: role.role });
          return acc;
        }, {} as { [key: string]: Array<{role: string}> });

        const profilesMap = (profilesResponse.data || []).reduce((acc, profile) => {
          acc[profile.user_id] = profile;
          return acc;
        }, {} as { [key: string]: { first_name: string; last_name: string; email: string } });

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
        Name: `${member.profiles.first_name} ${member.profiles.last_name}`,
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

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingTeam) return;

    try {
      const { error } = await supabase
        .from('teams')
        .update({
          name: editTeamForm.name,
          description: editTeamForm.description
        })
        .eq('id', editingTeam.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team updated successfully",
      });

      setEditTeamOpen(false);
      setEditingTeam(null);
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
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Team Management
          </CardTitle>
          <CardDescription>
            Manage teams and their members
          </CardDescription>
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
                        <div className="flex items-center gap-3 flex-1">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg">{team.name}</h3>
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
                            <p className="text-sm text-muted-foreground">
                              {team.description || `Auto-imported team: ${team.name}`}
                            </p>
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
                      <div className="px-4 pb-4">
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
                                    {member.profiles.first_name} {member.profiles.last_name}
                                    {member.is_manager && (
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
                                            Are you sure you want to remove {member.profiles.first_name} {member.profiles.last_name} from {team.name}?
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
              Update team name and description
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateTeam}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-team-name">Team Name</Label>
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
                  placeholder="Enter team description"
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