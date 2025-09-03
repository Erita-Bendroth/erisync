import React, { useState, useEffect } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Badge
} from "@/components/ui";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import BulkUserImport from "./BulkUserImport";
import UserManagement from "./UserManagement";
import UserCreation from "./UserCreation";
import AdminHolidayManager from "./AdminHolidayManager";

const AdminSetup = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [currentUserRoles, setCurrentUserRoles] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [managedTeamIds, setManagedTeamIds] = useState([]);

  useEffect(() => {
    if (user) fetchCurrentUserRoles();
  }, [user]);

  useEffect(() => {
    if (user && currentUserRole && currentUserRoles.length > 0) {
      fetchProfiles();
      fetchUserRoles();
    }
  }, [user, currentUserRole, managedTeamIds]);

  const fetchCurrentUserRoles = async () => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (error) return console.error("Error fetching roles:", error);

    const roles = data.map(r => r.role);
    setCurrentUserRoles(roles);

    if (roles.includes("admin")) setCurrentUserRole("admin");
    else if (roles.includes("planner")) setCurrentUserRole("planner");
    else if (roles.includes("manager")) setCurrentUserRole("manager");

    if (roles.includes("manager") && !roles.includes("admin") && !roles.includes("planner")) {
      const { data: managerTeams } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id)
        .eq("is_manager", true);
      setManagedTeamIds(managerTeams.map(t => t.team_id));
    }
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, email")
      .order("first_name");
    if (error) return console.error("Error fetching profiles:", error);

    let filtered = data;
    if (currentUserRole === "manager" && managedTeamIds.length > 0) {
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("user_id")
        .in("team_id", managedTeamIds);
      const managedUserIds = teamMembers.map(tm => tm.user_id);
      managedUserIds.push(user.id);
      filtered = filtered.filter(p => managedUserIds.includes(p.user_id));
    }
    setProfiles(filtered);
  };

  const fetchUserRoles = async () => {
    const { data, error } = await supabase.from("user_roles").select("*");
    if (error) return console.error("Error fetching user roles:", error);
    setUserRoles(data);
  };

  const getUserRoles = userId =>
    userRoles.filter(ur => ur.user_id === userId).map(ur => ur.role);

  const getAvailableRoles = () => {
    if (["admin", "planner"].includes(currentUserRole)) {
      return [
        { value: "admin", label: "Admin" },
        { value: "planner", label: "Planner" },
        { value: "manager", label: "Manager" },
        { value: "teammember", label: "Team Member" }
      ];
    } else if (currentUserRole === "manager") {
      return [
        { value: "manager", label: "Manager" },
        { value: "teammember", label: "Team Member" }
      ];
    }
    return [];
  };

  const assignRole = async (userId, role) => {
    if (user.id === userId) return toast({ title: "Error", description: "You cannot modify your own role", variant: "destructive" });

    const existingRole = userRoles.find(ur => ur.user_id === userId && ur.role === role);
    if (existingRole) return toast({ title: "Role already assigned", description: "This user already has this role", variant: "destructive" });

    const { error } = await supabase.from("user_roles").insert([{ user_id: userId, role }]);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });

    toast({ title: "Success", description: `${role} role assigned successfully` });
    fetchUserRoles();
  };

  const getRoleColor = role => {
    const colors = {
      admin: "bg-red-100 text-red-800",
      planner: "bg-blue-100 text-blue-800",
      manager: "bg-green-100 text-green-800",
      teammember: "bg-gray-100 text-gray-800"
    };
    return colors[role] || colors.teammember;
  };

  const isOnlyTeamMember = currentUserRoles.length === 1 && currentUserRoles.includes("teammember");
  if (isOnlyTeamMember) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Admin access required. Contact your administrator for access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UserCreation onUserCreated={() => { fetchProfiles(); fetchUserRoles(); }} />
      <UserManagement />
      <AdminHolidayManager />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Admin Setup
          </CardTitle>
          <CardDescription>Set up initial admin access and user roles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border rounded-lg bg-muted/50">
            <h3 className="font-semibold mb-2">Admin Access</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Only administrators and planners can manage roles and teams.
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">User Role Management</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Assign and manage roles for all users in the system.
            </p>
            <div className="space-y-3">
              {profiles.map(profile => {
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
                        {roles.length > 0 ? roles.map(role => (
                          <Badge key={role} className={getRoleColor(role)}>
                            {role}
                          </Badge>
                        )) : <Badge variant="outline">No roles assigned</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Select onValueChange={role => assignRole(profile.user_id, role)}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Add role" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(getAvailableRoles()) &&
                            getAvailableRoles()
                              .filter(roleObj => typeof roleObj?.value === 'string' && roleObj.value.trim() !== '')
                              .map(roleObj => (
                                <SelectItem key={roleObj.value} value={roleObj.value}>
                                  {roleObj.label}
                                </SelectItem>
                              ))}
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
          <CardDescription>Import multiple users from CSV files</CardDescription>
        </CardHeader>
        <CardContent>
          <BulkUserImport />
        </CardContent>
      </Card>
    </div>
  );
};

