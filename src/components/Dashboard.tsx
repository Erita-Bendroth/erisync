import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, Clock, UserCheck, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { DelegationIndicator } from "@/components/schedule/DelegationIndicator";
import { formatUserName } from "@/lib/utils";

interface UserRole {
  role: string;
}

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
  initials?: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, initials")
        .eq("user_id", user?.id)
        .single() as any;

      if (profileError) {
        console.error("Error fetching profile:", profileError);
      } else {
        setProfile(profileData);
      }

      // Fetch user role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
        .single();

      if (roleError) {
        console.error("Error fetching role:", roleError);
        // User might not have a role assigned yet
      } else {
        setUserRole(roleData.role);
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to load user data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const roleVariant = (role: string) => {
    switch (role) {
      case "planner": return "default";
      case "manager": return "secondary";
      case "teammember": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {profile ? formatUserName(profile.first_name, profile.last_name) : 'Loading...'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {userRole && (
            <Badge variant={roleVariant(userRole)} className="capitalize">
              {userRole}
            </Badge>
          )}
        </div>
      </div>

      {/* Role-based message */}
      {!userRole && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <CardHeader>
            <CardTitle className="text-yellow-800 dark:text-yellow-200">
              Role Assignment Pending
            </CardTitle>
            <CardDescription className="text-yellow-700 dark:text-yellow-300">
              Your account has been created but no role has been assigned yet. 
              Please contact your administrator to assign you a role (Planner, Manager, or Team Member).
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Delegation Indicator for Managers */}
      {userRole === 'manager' && user && (
        <DelegationIndicator userId={user.id} isManager={true} />
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Schedule</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              entries for today
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              in your teams
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Now</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              team members available
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Actions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              items need attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="schedule" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          {(userRole === "planner" || userRole === "manager") && (
            <TabsTrigger value="manage">Manage</TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Schedule</CardTitle>
              <CardDescription>
                View and manage schedule entries for your team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Schedule view coming soon</p>
                <p className="text-sm">This will show the weekly schedule based on your role permissions</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="teams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Teams Overview</CardTitle>
              <CardDescription>
                View team information and member availability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Teams view coming soon</p>
                <p className="text-sm">This will show team members and their availability</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {(userRole === "planner" || userRole === "manager") && (
          <TabsContent value="manage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Management Tools</CardTitle>
                <CardDescription>
                  {userRole === "planner" 
                    ? "Manage all teams, roles, and schedule entries"
                    : "Manage your team's schedule and member availability"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Management tools coming soon</p>
                  <p className="text-sm">
                    {userRole === "planner" 
                      ? "Create teams, assign roles, and manage all schedule entries"
                      : "Add/edit schedule entries for your team members"
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Dashboard;