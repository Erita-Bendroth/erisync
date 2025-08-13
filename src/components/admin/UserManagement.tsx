import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, UserCog, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";

interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  country_code: string;
  requires_password_change: boolean;
  roles: string[];
  teams: string[];
}

const UserManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, [user]);

  useEffect(() => {
    if (hasPermission) {
      fetchUsers();
    }
  }, [hasPermission]);

  const checkPermissions = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (error) throw error;
      
      const roles = data?.map(r => r.role) || [];
      setHasPermission(roles.includes('admin'));
      
    } catch (error) {
      console.error("Error checking permissions:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
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

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch all team memberships
      const { data: teamMemberships, error: teamsError } = await supabase
        .from('team_members')
        .select(`
          user_id,
          teams!inner(name)
        `);

      if (teamsError) throw teamsError;

      // Combine the data
      const usersWithDetails = profiles?.map(profile => ({
        ...profile,
        roles: userRoles?.filter(ur => ur.user_id === profile.user_id).map(ur => ur.role) || [],
        teams: teamMemberships?.filter(tm => tm.user_id === profile.user_id).map(tm => tm.teams.name) || []
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

  const deleteUser = async (userId: string, email: string) => {
    try {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `User ${email} has been deleted`,
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

      // SECURITY: Additional authorization check
      if (!hasPermission) {
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

  if (!hasPermission) {
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <UserCog className="w-5 h-5 mr-2" />
          User Management
        </CardTitle>
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
                    <div className="flex flex-wrap gap-1">
                      {userData.roles.map((role) => (
                        <Badge key={role} variant="outline">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {userData.teams.slice(0, 2).map((team) => (
                        <Badge key={team} variant="secondary" className="text-xs">
                          {team}
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
                    {userData.requires_password_change && (
                      <Badge variant="destructive">Password Change Required</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Select 
                        value={userData.roles[0] || ''} 
                        onValueChange={(value) => updateUserRole(userData.user_id, value)}
                        disabled={userData.user_id === user?.id} // Prevent self-role modification
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="planner">Planner</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="teammember">Team Member</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={userData.user_id === user?.id} // Prevent self-deletion
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete user {userData.email}? This action cannot be undone and will remove all their data, schedules, and team memberships.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteUser(userData.user_id, userData.email)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete User
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default UserManagement;