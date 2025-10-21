import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCheck, Clock, X, User } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatUserName } from "@/lib/utils";

interface Delegation {
  id: string;
  delegate_id: string;
  manager_id: string;
  start_date: string;
  end_date: string;
  status: string;
  type: "given" | "received";
  profiles: {
    first_name: string;
    last_name: string;
    email: string;
    initials?: string;
  };
}

interface DelegationIndicatorProps {
  userId: string;
  isManager: boolean;
}

export function DelegationIndicator({ userId, isManager }: DelegationIndicatorProps) {
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDelegations();
  }, [userId]);

  const fetchDelegations = async () => {
    try {
      // Fetch delegations given by this user
      const { data: givenDelegations, error: givenError } = await supabase
        .from("manager_delegations")
        .select(`
          id,
          delegate_id,
          manager_id,
          start_date,
          end_date,
          status
        `)
        .eq("manager_id", userId)
        .eq("status", "active")
        .gte("end_date", new Date().toISOString())
        .order("start_date", { ascending: true });

      if (givenError) throw givenError;

      // Fetch delegations received by this user
      const { data: receivedDelegations, error: receivedError } = await supabase
        .from("manager_delegations")
        .select(`
          id,
          delegate_id,
          manager_id,
          start_date,
          end_date,
          status
        `)
        .eq("delegate_id", userId)
        .eq("status", "active")
        .gte("end_date", new Date().toISOString())
        .order("start_date", { ascending: true });

      if (receivedError) throw receivedError;

      const allDelegations = [
        ...(givenDelegations || []).map(d => ({ ...d, type: "given" as const })),
        ...(receivedDelegations || []).map(d => ({ ...d, type: "received" as const })),
      ];

      // Fetch profiles for all relevant users
      if (allDelegations.length > 0) {
        const userIds = allDelegations.map(d => 
          d.type === "given" ? d.delegate_id : d.manager_id
        );
        const uniqueUserIds = [...new Set(userIds)];

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, email, initials")
          .in("user_id", uniqueUserIds) as any;

        if (profilesError) throw profilesError;

        const delegationsWithProfiles = allDelegations.map(delegation => ({
          ...delegation,
          profiles: profiles?.find(p => 
            p.user_id === (delegation.type === "given" ? delegation.delegate_id : delegation.manager_id)
          ) || {
            first_name: "",
            last_name: "",
            email: "",
          },
        }));

        setDelegations(delegationsWithProfiles);
      } else {
        setDelegations([]);
      }
    } catch (error: any) {
      console.error("Error fetching delegations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (delegationId: string) => {
    try {
      const delegation = delegations.find(d => d.id === delegationId);
      if (!delegation) {
        toast({
          title: "Error",
          description: "Delegation not found",
          variant: "destructive",
        });
        return;
      }

      console.log("Revoking delegation:", {
        delegationId,
        userId,
        delegationType: delegation.type,
      });

      // Use the secure function to revoke delegation
      const { data: revokeResult, error: revokeError } = await supabase
        .rpc("revoke_manager_delegation", {
          _delegation_id: delegationId,
          _revoked_by: userId,
        });

      if (revokeError) {
        console.error("RPC revoke error:", revokeError);
        throw new Error(revokeError.message || "Failed to revoke delegation");
      }

      console.log("Delegation revoked successfully:", revokeResult);

      // Get profiles for notification
      const { data: managerProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, initials")
        .eq("user_id", delegation.manager_id)
        .single() as any;

      const { data: delegateProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, initials")
        .eq("user_id", delegation.delegate_id)
        .single() as any;

      // Send cancellation notification to both parties
      if (managerProfile && delegateProfile) {
        console.log("Sending cancellation notifications...");
        try {
          await supabase.functions.invoke("send-delegation-notification", {
            body: {
              action: "cancelled",
              managerEmail: managerProfile.email,
              delegateEmail: delegateProfile.email,
              managerName: formatUserName(managerProfile.first_name, managerProfile.last_name, managerProfile.initials),
              delegateName: formatUserName(delegateProfile.first_name, delegateProfile.last_name, delegateProfile.initials),
              startDate: format(new Date(delegation.start_date), "PPP"),
              endDate: format(new Date(delegation.end_date), "PPP"),
            },
          });
          console.log("Cancellation notifications sent successfully");
        } catch (notifError) {
          console.error("Failed to send notifications:", notifError);
          // Don't fail the whole operation if notification fails
        }
      }

      const teamsRemoved = (revokeResult as any)?.teams_removed || 0;
      toast({
        title: "Success",
        description: teamsRemoved > 0
          ? `Delegation cancelled. Temporary access to ${teamsRemoved} team${teamsRemoved > 1 ? 's' : ''} has been removed. Both parties have been notified.`
          : "Delegation cancelled successfully. Both parties have been notified.",
      });

      // Refresh delegations list
      console.log("Refreshing delegations list...");
      fetchDelegations();
    } catch (error: any) {
      console.error("Error revoking delegation:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel delegation",
        variant: "destructive",
      });
    }
  };

  if (loading || delegations.length === 0) {
    return null;
  }

  const givenDelegations = delegations.filter(d => d.type === "given");
  const receivedDelegations = delegations.filter(d => d.type === "received");

  return (
    <div className="space-y-4 mb-6">
      {givenDelegations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-5 w-5" />
              Delegations You've Given
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {givenDelegations.map((delegation) => (
              <div
                key={delegation.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {formatUserName(delegation.profiles.first_name, delegation.profiles.last_name, delegation.profiles.initials)}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      Delegate
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      {format(new Date(delegation.start_date), "PP")} -{" "}
                      {format(new Date(delegation.end_date), "PP")}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(delegation.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {receivedDelegations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-5 w-5 text-primary" />
              Delegations You've Received
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {receivedDelegations.map((delegation) => (
              <div
                key={delegation.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-primary/5"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      From: {formatUserName(delegation.profiles.first_name, delegation.profiles.last_name, delegation.profiles.initials)}
                    </span>
                    <Badge variant="default" className="text-xs">
                      Active
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      {format(new Date(delegation.start_date), "PP")} -{" "}
                      {format(new Date(delegation.end_date), "PP")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
