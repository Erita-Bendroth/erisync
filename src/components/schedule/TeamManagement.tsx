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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Users, Settings, Trash2, Download, BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import UserProfileOverview from "@/components/profile/UserProfileOverview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { format, addDays, startOfWeek, startOfYear, endOfYear } from "date-fns";

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
    user_id: string;
    initials: string;
    email?: string; // Email may not be available for security reasons
  };
}

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
  email?: string; // Email may not be available for security reasons
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
  const [userRole, setUserRole] = useState<string>("");
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

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
    if (user) {
      fetchUserRole().then((role) => {
        if (role) {
          fetchTeams(role);
          fetchProfiles();
        }
      });
    }
  }, [user?.id]); // Only re-run when user ID actually changes

  // Fetch team members when teams list changes, but avoid infinite loops
  useEffect(() => {
    if (teams.length > 0 && !loading) {
      console.log("Fetching members for teams:", teams.map(t => ({ name: t.name, id: t.id })));
      teams.forEach(team => {
        fetchTeamMembers(team.id);
      });
    }
  }, [teams.length]); // Only depend on the count, not the entire array

  const fetchTeams = async (currentUserRole?: string) => {
    try {
      console.log("Fetching teams...");
      console.log("Current user:", user);
      const roleToUse = currentUserRole || userRole;
      console.log("User role:", roleToUse);
      console.log("Supabase session:", await supabase.auth.getSession());
      
      let query = supabase
        .from("teams")
        .select("*")
        .order("name");

      // Role-based team filtering
      if (roleToUse === 'teammember') {
        console.log("Fetching teams for team member...");
        const { data: userTeamMemberships, error: membershipError } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", user!.id);
        
        console.log("User team memberships:", userTeamMemberships, "Error:", membershipError);
        
        if (userTeamMemberships && userTeamMemberships.length > 0) {
          const teamIds = userTeamMemberships.map(tm => tm.team_id);
          console.log("Filtering teams to only show team IDs:", teamIds);
          query = query.in("id", teamIds);
        } else {
          // User is not part of any teams, return empty array
          console.log("User not in any teams, showing empty list");
          setTeams([]);
          return;
        }
      } else if (roleToUse === 'manager') {
        console.log("Fetching teams for manager...");
        const { data: managedTeams, error: managerError } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", user!.id)
          .eq("is_manager", true);
        
        console.log("Manager team memberships:", managedTeams, "Error:", managerError);
        
        if (managedTeams && managedTeams.length > 0) {
          const teamIds = managedTeams.map(tm => tm.team_id);
          console.log("Filtering teams to only show managed team IDs:", teamIds);
          query = query.in("id", teamIds);
        } else {
          // Manager doesn't manage any teams, return empty array
          console.log("Manager doesn't manage any teams, showing empty list");
          setTeams([]);
          return;
        }
      } else {
        console.log("User has admin/planner role, showing all teams");
      }

      const { data, error } = await query;

      console.log("Teams query result:", { data, error });
      console.log("Data length:", data?.length);

      if (error) {
        console.error("Teams query error:", error);
        throw error;
      }
      setTeams(data || []);
      console.log("Teams set:", data);
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
      
      // First get team members
      const { data: membersData, error: membersError } = await supabase
        .from("team_members")
        .select("id, user_id, team_id, is_manager, created_at")
        .eq("team_id", teamId);

      if (membersError) {
        console.error(`Error fetching team members for ${teamId}:`, membersError);
        throw membersError;
      }

      console.log(`Raw team members for ${teamId}:`, membersData);

      // Then get profiles for those users
      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(member => member.user_id);
        
        const { data: profilesData, error: profilesError } = await supabase
          .rpc('get_multiple_basic_profile_info', { _user_ids: userIds });

        if (profilesError) {
          console.error(`Error fetching profiles:`, profilesError);
          throw profilesError;
        }

        // Combine the data - show email if available
        const transformedData = membersData.map(member => {
          const profile = profilesData?.find(p => p.user_id === member.user_id);
          return {
            ...member,
            profiles: profile || { first_name: '', last_name: '', user_id: member.user_id, initials: '', email: null }
          };
        });

        console.log(`Transformed data for team ${teamId}:`, transformedData);
        setTeamMembers(prev => ({ ...prev, [teamId]: transformedData }));
      } else {
        console.log(`No members found for team ${teamId}`);
        setTeamMembers(prev => ({ ...prev, [teamId]: [] }));
      }
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  };

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

  const fetchUserRole = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;
      
      // Get the most relevant role (prioritize admin/planner over teammember)
      const roles = data || [];
      let role = "";
      if (roles.some(r => r.role === "admin")) role = "admin";
      else if (roles.some(r => r.role === "planner")) role = "planner";
      else if (roles.some(r => r.role === "manager")) role = "manager";
      else if (roles.some(r => r.role === "teammember")) role = "teammember";
      
      setUserRole(role);
      console.log("User role set to:", role, "from roles:", roles.map(r => r.role));
      return role; // Return the role for immediate use
    } catch (error) {
      console.error("Error fetching user role:", error);
      return "";
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

  const downloadTeamData = async (teamId: string, teamName: string) => {
    try {
      const currentYear = new Date().getFullYear();
      const yearStart = format(startOfYear(new Date()), 'yyyy-MM-dd');
      const yearEnd = format(endOfYear(new Date()), 'yyyy-MM-dd');

      // Get all team members
      const members = teamMembers[teamId] || [];
      if (members.length === 0) {
        toast({
          title: "No Data",
          description: "No team members found",
          variant: "destructive",
        });
        return;
      }

      const userIds = members.map(m => m.user_id);

      // Fetch schedule data for all team members
      const { data, error } = await supabase
        .from('schedule_entries')
        .select('*')
        .in('user_id', userIds)
        .eq('team_id', teamId)
        .gte('date', yearStart)
        .lte('date', yearEnd)
        .order('date');

      if (error) throw error;

      // Calculate totals for each member
      const memberSummaries = members.map(member => {
        const memberEntries = data?.filter(entry => entry.user_id === member.user_id) || [];
        
        let totalWorkDays = 0;
        let totalHours = 0;
        let vacationDays = 0;
        
        memberEntries.forEach(entry => {
          if (entry.activity_type === 'work' || entry.activity_type === 'hotline_support' || entry.activity_type === 'flextime' || entry.activity_type === 'working_from_home') {
            totalWorkDays++;
            totalHours += calculateHoursFromScheduleEntry(entry);
          } else if (entry.activity_type === 'vacation') {
            vacationDays++;
          }
        });
        
          return {
            name: `${member.profiles.first_name} ${member.profiles.last_name}`,
            email: member.profiles.email || 'Email restricted',
            totalWorkDays,
            totalHours,
            vacationDays
          };
      });

      // Prepare worksheet data
      const worksheetData = [
        [`${teamName} Team Report - ${currentYear}`],
        [''],
        ['Employee', 'Email', 'Date', 'Activity Type', 'Shift Type', 'Availability Status', 'Hours', 'Notes'],
        ...(data?.map(entry => {
          const member = members.find(m => m.user_id === entry.user_id);
          const hours = calculateHoursFromScheduleEntry(entry);
          
          return [
            member ? `${member.profiles.first_name} ${member.profiles.last_name}` : 'Unknown',
            member?.profiles.email || 'Email restricted',
            entry.date,
            entry.activity_type.replace('_', ' '),
            entry.shift_type,
            entry.availability_status,
            hours,
            entry.notes || ''
          ];
        }) || []),
        [''],
        ['Summary by Employee:'],
        ['Employee', 'Total Work Days', 'Total Hours', 'Vacation Days'],
        ...memberSummaries.map(summary => [
          summary.name,
          summary.totalWorkDays,
          summary.totalHours.toFixed(1),
          summary.vacationDays
        ])
      ];

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Set column widths
      ws['!cols'] = [
        { width: 20 }, // Employee
        { width: 25 }, // Email
        { width: 12 }, // Date
        { width: 15 }, // Activity Type
        { width: 12 }, // Shift Type
        { width: 18 }, // Availability Status
        { width: 8 },  // Hours
        { width: 30 }  // Notes
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Team Report');
      
      // Generate Excel file and download
      const fileName = `${teamName}_Team_Report_${currentYear}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Success",
        description: "Team report downloaded successfully"
      });
    } catch (error) {
      console.error('Error downloading team data:', error);
      toast({
        title: "Error",
        description: "Failed to download team report",
        variant: "destructive"
      });
    }
  };

  const calculateHoursFromScheduleEntry = (entry: any): number => {
    // Check if entry has time split information
    const timeSplitPattern = /Times:\s*(.+)/;
    const match = entry.notes?.match(timeSplitPattern);
    
    if (match) {
      try {
        const timesData = JSON.parse(match[1]);
        if (Array.isArray(timesData)) {
          return timesData.reduce((total, block) => {
            const start = new Date(`2000-01-01T${block.start_time}:00`);
            const end = new Date(`2000-01-01T${block.end_time}:00`);
            const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            return total + hours;
          }, 0);
        }
      } catch (e) {
        console.error('Failed to parse time split data');
      }
    }
    
    // Default hours based on shift type
    switch (entry.shift_type) {
      case 'early':
        return 8; // Assume 8 hours for early shift
      case 'late':
        return 8; // Assume 8 hours for late shift
      case 'normal':
      default:
        return 8; // Default 8 hours
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
          {(userRole === 'admin' || userRole === 'planner') && (
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
                           {profile.first_name} {profile.last_name} {profile.email ? `(${profile.email})` : ''}
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

          {(userRole === 'admin' || userRole === 'planner') && (
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
          )}
        </div>
      </div>

      <div className="space-y-4">
        {teams.map((team) => {
          const isExpanded = expandedTeams.has(team.id);
          const memberCount = teamMembers[team.id]?.length || 0;
          
          const toggleTeam = () => {
            const newExpanded = new Set(expandedTeams);
            if (isExpanded) {
              newExpanded.delete(team.id);
            } else {
              newExpanded.add(team.id);
            }
            setExpandedTeams(newExpanded);
          };

          return (
            <Card key={team.id} className="border border-border/50 hover:border-border transition-colors">
              <Collapsible open={isExpanded} onOpenChange={toggleTeam}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="transition-transform duration-200">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="flex items-center text-lg">
                            <Users className="w-5 h-5 mr-2 text-primary" />
                            {team.name} ({memberCount})
                          </CardTitle>
                          {team.description && (
                            <CardDescription className="mt-1">
                              {team.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="ml-4">
                        {memberCount} {memberCount === 1 ? 'member' : 'members'}
                      </Badge>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="animate-accordion-down data-[state=closed]:animate-accordion-up">
                  <CardContent className="pt-0">
                    {memberCount > 0 ? (
                      <div className="space-y-4">
                        <div className="rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="font-semibold">Name</TableHead>
                                <TableHead className="font-semibold">Email</TableHead>
                                <TableHead className="font-semibold">Role</TableHead>
                                <TableHead className="w-[100px] font-semibold">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {teamMembers[team.id].map((member) => (
                                <TableRow key={member.id} className="hover:bg-muted/30">
                                  <TableCell className="font-medium">
                                    {userRole === 'teammember' 
                                      ? `${member.profiles.first_name.charAt(0)}${member.profiles.last_name.charAt(0)}`.toUpperCase()
                                      : `${member.profiles.first_name} ${member.profiles.last_name}`
                                    }
                                  </TableCell>
                                   <TableCell className="text-muted-foreground">
                                     {member.profiles.email || 'Email restricted'}
                                   </TableCell>
                                  <TableCell>
                                    <Badge variant={member.is_manager ? "default" : "secondary"}>
                                      {member.is_manager ? "Manager" : "Member"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {(userRole === 'admin' || userRole === 'planner') && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveMember(member.id, team.id)}
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        
                        {/* Team Summary Overview */}
                        {(userRole === 'admin' || userRole === 'planner' || userRole === 'manager') && (
                          <div className="space-y-4 pt-4 border-t">
                            <h4 className="text-lg font-medium flex items-center">
                              <BarChart3 className="w-5 h-5 mr-2 text-primary" />
                              Team Member Overview
                            </h4>
                            <div className="grid gap-4">
                              {teamMembers[team.id]?.map((member) => (
                                <UserProfileOverview
                                  key={member.user_id}
                                  userId={member.user_id}
                                  teamId={team.id}
                                  canView={true}
                                  showTeamContext={false}
                                />
                              ))}
                            </div>
                            <div className="pt-4 border-t">
                              <Button
                                onClick={() => downloadTeamData(team.id, team.name)}
                                variant="outline"
                                size="sm"
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Download Team Report (Excel)
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No members in this team yet</p>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}

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