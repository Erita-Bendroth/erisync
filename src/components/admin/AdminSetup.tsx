import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Shield, UserPlus, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import BulkUserImport from "./BulkUserImport";
import UserManagement from "./UserManagement";
import UserCreation from "./UserCreation";

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
}

const AdminSetup = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserRoles, setCurrentUserRoles] = useState<string[]>([]);

  useEffect(() => {
    fetchProfiles();
    fetchUserRoles();
    fetchCurrentUserRoles();
  }, [user]);

  const fetchCurrentUserRoles = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (error) throw error;
      setCurrentUserRoles(data?.map(r => r.role) || []);
    } catch (error) {
      console.error("Error fetching current user roles:", error);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("first_name");
      
      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  const fetchUserRoles = async () => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*");
      
      if (error) throw error;
      setUserRoles(data || []);
    } catch (error) {
      console.error("Error fetching user roles:", error);
    }
  };

  const assignRole = async (userId: string, role: string) => {
    try {
      setLoading(true);
      
      // First check if user already has this role
      const existingRole = userRoles.find(ur => ur.user_id === userId && ur.role === role);
      if (existingRole) {
        toast({
          title: "Role already assigned",
          description: "This user already has this role",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("user_roles")
        .insert([{ 
          user_id: userId, 
          role: role as "manager" | "planner" | "teammember" 
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${role} role assigned successfully`,
      });

      fetchUserRoles();
    } catch (error: any) {
      console.error("Error assigning role:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign role",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const makeCurrentUserAdmin = async () => {
    if (!user) return;
    await assignRole(user.id, "planner");
  };

  const getUserRoles = (userId: string) => {
    return userRoles.filter(ur => ur.user_id === userId).map(ur => ur.role);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
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

  // Check if current user has admin privileges
  const hasAdminAccess = currentUserRoles.some(role => 
    ['admin', 'planner', 'manager'].includes(role)
  );

  // Only show admin setup to users who are not just team members
  const isOnlyTeamMember = currentUserRoles.length === 1 && currentUserRoles.includes('teammember');
  
  if (isOnlyTeamMember) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          Admin access required. Contact your administrator for access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UserCreation onUserCreated={() => { fetchProfiles(); fetchUserRoles(); }} />
      <UserManagement />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Admin Setup
          </CardTitle>
          <CardDescription>
            Set up initial admin access and user roles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border rounded-lg bg-muted/50">
            <h3 className="font-semibold mb-2">Admin Access</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Only administrators and planners can manage roles and teams. Contact your administrator if you need elevated access.
            </p>
          </div>

          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">User Role Management</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Assign and manage roles for all users in the system.
            </p>
            
            <div className="space-y-3">
              {profiles.map((profile) => {
                const roles = getUserRoles(profile.user_id);
                const isCurrentUser = profile.user_id === user?.id;
                
                return (
                  <div key={profile.user_id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">
                        {profile.first_name} {profile.last_name}
                        {isCurrentUser && <span className="text-muted-foreground"> (You)</span>}
                      </p>
                      <p className="text-sm text-muted-foreground">{profile.email}</p>
                      <div className="flex gap-1 mt-1">
                        {roles.map((role) => (
                          <Badge key={role} className={getRoleColor(role)}>
                            {role}
                          </Badge>
                        ))}
                        {roles.length === 0 && (
                          <Badge variant="outline">No roles assigned</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Select onValueChange={(role) => assignRole(profile.user_id, role)}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Add role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planner">Planner</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="teammember">Team Member</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk User Import</CardTitle>
          <CardDescription>
            Import multiple users from CSV files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BulkUserImport />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
          <CardDescription>
            After setting up roles, here's what to do next
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  1
                </div>
                <div>
                  <h4 className="font-medium">Create Teams</h4>
                  <p className="text-sm text-muted-foreground">
                    Go to the Teams tab to create your organizational teams
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  2
                </div>
                <div>
                  <h4 className="font-medium">Assign Team Members</h4>
                  <p className="text-sm text-muted-foreground">
                    Add users to teams and designate team managers
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  3
                </div>
                <div>
                  <h4 className="font-medium">Start Scheduling</h4>
                  <p className="text-sm text-muted-foreground">
                    Begin adding schedule entries for your team members
                  </p>
                </div>
              </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSetup;