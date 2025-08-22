import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Trash2, MoreHorizontal, Edit, Shield, Key, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import EditUserModal from "./EditUserModal";
import RoleManagement from "./RoleManagement";
import SetTempPasswordModal from "./SetTempPasswordModal";

export interface Team {
  id: string;
  name: string;
}

export interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  country_code: string;
  requires_password_change: boolean;
  roles: Array<{ id: string; role: string; }>;
  teams: Team[];
}

const UserManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTempPasswordModal, setShowTempPasswordModal] = useState(false);
  const [tempPasswordUser, setTempPasswordUser] = useState<User | null>(null);

  useEffect(() => {
    checkPermissions();
    fetchUsers();
    fetchTeams();
  }, [user]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const checkPermissions = async () => {
    if (!user) return;
    
    try {
      console.log('Checking permissions for user:', user.id, user.email);
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      console.log('User roles query result:', { data, error });
      
      if (error) {
        console.error('Error fetching user roles:', error);
        throw error;
      }
      
      const roles = data?.map(r => r.role) || [];
      console.log('User roles:', roles);
      setHasAdminAccess(roles.includes('admin') || roles.includes('planner'));
      
    } catch (error) {
      console.error("Error checking permissions:", error);
      setHasAdminAccess(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log('Fetching users...');
      
      // Fetch users with their profiles, roles, and teams
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          email,
          first_name,
          last_name,
          country_code,
          requires_password_change
        `);

      console.log('Profiles query result:', { profiles, error: profilesError });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role');

      if (rolesError) throw rolesError;

      // Fetch all team memberships with team details
      const { data: teamMemberships, error: teamsError } = await supabase
        .from('team_members')
        .select(`
          user_id,
          teams!inner(id, name)
        `);

      if (teamsError) throw teamsError;

      // Combine the data
      const usersWithDetails = profiles?.map(profile => ({
        ...profile,
        roles: userRoles?.filter(ur => ur.user_id === profile.user_id).map(ur => ({ id: ur.id, role: ur.role })) || [],
        teams: teamMemberships?.filter(tm => tm.user_id === profile.user_id).map(tm => tm.teams) || []
      })) || [];

      setUsers(usersWithDetails);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User has been deleted",
      });

      // Refresh the users list
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      // SECURITY: Prevent users from modifying their own roles
      if (user?.id === userId) {
        toast({
          title: "Error",
          description: "You cannot modify your own role",
          variant: "destructive",
        });
        return;
      }

      // Get current user's role to determine permissions
      const { data: currentUserRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id);

      const userRoles = currentUserRoles?.map(r => r.role) || [];
      const isAdmin = userRoles.includes('admin');
      const isPlanner = userRoles.includes('planner');
      const isManager = userRoles.includes('manager');

      // SECURITY: Restrict role assignments based on user permissions
      if (isManager && !isPlanner && !isAdmin) {
        // Managers can only assign teammember or manager roles to their team members
        if (!['teammember', 'manager'].includes(newRole)) {
          toast({
            title: "Error",
            description: "Managers can only assign teammember or manager roles",
            variant: "destructive",
          });
          return;
        }

        // Check if target user is in manager's team
        const { data: managerTeams } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user!.id)
          .eq('is_manager', true);

        if (managerTeams && managerTeams.length > 0) {
          const teamIds = managerTeams.map(t => t.team_id);
          const { data: targetUserTeams } = await supabase
            .from('team_members')
            .select('team_id')
            .eq('user_id', userId);

          const hasCommonTeam = targetUserTeams?.some(t => teamIds.includes(t.team_id));
          if (!hasCommonTeam) {
            toast({
              title: "Error",
              description: "You can only manage roles for users in your teams",
              variant: "destructive",
            });
            return;
          }
        } else {
          toast({
            title: "Error",
            description: "You don't manage any teams",
            variant: "destructive",
          });
          return;
        }
      } else if (!isAdmin && !isPlanner) {
        toast({
          title: "Error", 
          description: "Insufficient permissions to modify user roles",
          variant: "destructive",
        });
        return;
      }

      // First, remove all existing roles for this user
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Then add the new role - cast to the proper type
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: newRole as 'admin' | 'planner' | 'manager' | 'teammember'
        });

      if (insertError) throw insertError;

      // Log the role change for audit purposes
      console.log(`Role updated by ${user?.email}: User ${userId} role changed to ${newRole}`);

      toast({
        title: "Success",
        description: "User role updated successfully",
      });

      // Refresh the users list
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role. Please try again.",
        variant: "destructive",
      });
    }
  };

  const sendRandomPassword = async (userId: string, email: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('send-random-password', {
        body: { 
          userId,
          userEmail: email
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: data?.emailSent 
          ? `Random password generated and sent to ${email}`
          : "Random password generated successfully",
      });

      // Refresh the users list
      fetchUsers();
    } catch (error: any) {
      console.error('Error sending random password:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate random password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setEditingUser(null);
    setShowEditModal(false);
  };

  const handleSetTempPassword = (user: User) => {
    setTempPasswordUser(user);
    setShowTempPasswordModal(true);
  };

  const handleCloseTempPasswordModal = () => {
    setTempPasswordUser(null);
    setShowTempPasswordModal(false);
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

  if (!hasAdminAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Admin access required to manage users.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            User Management
          </CardTitle>
          <CardDescription>
            Manage user accounts, roles, and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading users...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Teams</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((userData) => (
                  <TableRow key={userData.user_id}>
                    <TableCell className="font-medium">{userData.email}</TableCell>
                    <TableCell>{userData.first_name} {userData.last_name}</TableCell>
                    <TableCell>{userData.country_code}</TableCell>
                    <TableCell>
                      <RoleManagement
                        userId={userData.user_id}
                        userName={`${userData.first_name} ${userData.last_name}`}
                        roles={userData.roles}
                        onRoleRemoved={fetchUsers}
                        canRemove={hasAdminAccess}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userData.teams.slice(0, 2).map((team) => (
                          <Badge key={team.id} variant="secondary" className="text-xs">
                            {team.name}
                          </Badge>
                        ))}
                        {userData.teams.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{userData.teams.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                     <TableCell>
                       <span className="text-muted-foreground text-sm">Active</span>
                     </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border border-border shadow-md z-50">
                           <DropdownMenuItem
                             onClick={() => handleEditUser(userData)}
                             className="cursor-pointer"
                           >
                             <Edit className="mr-2 h-4 w-4" />
                             Edit User
                           </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => sendRandomPassword(userData.user_id, userData.email)}
                              className="cursor-pointer"
                            >
                              <Key className="mr-2 h-4 w-4" />
                              Generate Random Password
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleSetTempPassword(userData)}
                              className="cursor-pointer"
                            >
                              <Lock className="mr-2 h-4 w-4" />
                              Set Temporary Password
                            </DropdownMenuItem>
                          {userData.user_id !== user?.id && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem 
                                  onSelect={(e) => e.preventDefault()}
                                  className="cursor-pointer text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete User
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the user account for {userData.first_name} {userData.last_name} ({userData.email}).
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => deleteUser(userData.user_id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete User
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <EditUserModal
        user={editingUser ? {
          ...editingUser,
          roles: editingUser.roles.map(r => r.role)
        } : null}
        teams={teams}
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        onUserUpdated={fetchUsers}
      />

      {tempPasswordUser && (
        <SetTempPasswordModal
          isOpen={showTempPasswordModal}
          onClose={handleCloseTempPasswordModal}
          userId={tempPasswordUser.user_id}
          userName={`${tempPasswordUser.first_name} ${tempPasswordUser.last_name}`}
          userEmail={tempPasswordUser.email}
          onSuccess={fetchUsers}
        />
      )}
    </div>
  );
};

export default UserManagement;