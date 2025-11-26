import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle, Calendar, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UserRole {
  role: string;
}

export const PendingRequestsCard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [vacationCount, setVacationCount] = useState(0);
  const [swapCount, setSwapCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);

  useEffect(() => {
    if (user) {
      fetchUserRoles();
    }
  }, [user]);

  useEffect(() => {
    if (user && userRoles.length > 0) {
      fetchCounts();
      setupRealtimeSubscriptions();
    }
  }, [user, userRoles]);

  const fetchUserRoles = async () => {
    try {
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);

      if (rolesData) {
        setUserRoles(rolesData);
      }
    } catch (error) {
      console.error("Error fetching user roles:", error);
    }
  };

  const fetchCounts = async () => {
    setLoading(true);
    await Promise.all([
      fetchVacationRequestCount(),
      fetchSwapRequestCount()
    ]);
    setLoading(false);
  };

  const fetchVacationRequestCount = async () => {
    try {
      const isAdmin = userRoles.some(r => r.role === 'admin');
      const isPlanner = userRoles.some(r => r.role === 'planner');
      const isManager = userRoles.some(r => r.role === 'manager');

      let query = supabase
        .from("vacation_requests")
        .select("id", { count: 'exact', head: true })
        .eq("status", "pending");

      if (!isAdmin && !isPlanner) {
        if (isManager) {
          // Managers see requests from their teams
          const { data: managedTeams } = await supabase.rpc('get_manager_accessible_teams', {
            _manager_id: user!.id
          });

          if (managedTeams && managedTeams.length > 0) {
            query = query.in("team_id", managedTeams);
          } else {
            // If no managed teams, show only own requests
            query = query.eq("user_id", user!.id);
          }
        } else {
          // Team members see only their own requests
          query = query.eq("user_id", user!.id);
        }
      }

      const { count } = await query;
      setVacationCount(count || 0);
    } catch (error) {
      console.error("Error fetching vacation request count:", error);
      setVacationCount(0);
    }
  };

  const fetchSwapRequestCount = async () => {
    try {
      const isAdmin = userRoles.some(r => r.role === 'admin');
      const isPlanner = userRoles.some(r => r.role === 'planner');
      const isManager = userRoles.some(r => r.role === 'manager');

      let query = supabase
        .from("shift_swap_requests")
        .select("id", { count: 'exact', head: true })
        .eq("status", "pending");

      if (!isAdmin && !isPlanner) {
        if (isManager) {
          // Managers see requests from their teams
          const { data: managedTeams } = await supabase.rpc('get_manager_accessible_teams', {
            _manager_id: user!.id
          });

          if (managedTeams && managedTeams.length > 0) {
            query = query.in("team_id", managedTeams);
          } else {
            // If no managed teams, show only requests they're involved in
            query = query.or(`requesting_user_id.eq.${user!.id},target_user_id.eq.${user!.id}`);
          }
        } else {
          // Team members see requests they're involved in
          query = query.or(`requesting_user_id.eq.${user!.id},target_user_id.eq.${user!.id}`);
        }
      }

      const { count } = await query;
      setSwapCount(count || 0);
    } catch (error) {
      console.error("Error fetching swap request count:", error);
      setSwapCount(0);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const vacationChannel = supabase
      .channel('vacation-requests-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vacation_requests'
        },
        () => {
          fetchVacationRequestCount();
        }
      )
      .subscribe();

    const swapChannel = supabase
      .channel('swap-requests-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shift_swap_requests'
        },
        () => {
          fetchSwapRequestCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(vacationChannel);
      supabase.removeChannel(swapChannel);
    };
  };

  const totalPending = vacationCount + swapCount;
  const hasRequests = totalPending > 0;

  return (
    <Card className={hasRequests ? "border-orange-200 dark:border-orange-900" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
          <CardDescription className="text-xs">
            {hasRequests ? "Requests requiring attention" : "All caught up!"}
          </CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          {hasRequests && (
            <Badge variant="destructive" className="h-6 px-2">
              {totalPending}
            </Badge>
          )}
          {hasRequests ? (
            <Bell className="h-5 w-5 text-orange-500" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-500" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : hasRequests ? (
          <div className="space-y-3">
            {vacationCount > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Vacation Requests</p>
                    <p className="text-xs text-muted-foreground">
                      {vacationCount} pending
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/schedule?tab=schedule&showRequests=true")}
                >
                  View
                </Button>
              </div>
            )}

            {swapCount > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                <div className="flex items-center space-x-3">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Shift Swap Requests</p>
                    <p className="text-xs text-muted-foreground">
                      {swapCount} pending
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/schedule?tab=schedule&showRequests=true")}
                >
                  View
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm text-muted-foreground">No pending requests</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
