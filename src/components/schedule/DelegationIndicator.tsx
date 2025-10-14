import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCheck, Clock, X, User } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Delegation {
  id: string;
  delegate_id: string;
  start_date: string;
  end_date: string;
  status: string;
  profiles: {
    first_name: string;
    last_name: string;
    email: string;
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
    if (isManager) {
      fetchDelegations();
    }
  }, [userId, isManager]);

  const fetchDelegations = async () => {
    try {
      const { data, error } = await supabase
        .from("manager_delegations")
        .select(`
          id,
          delegate_id,
          start_date,
          end_date,
          status
        `)
        .eq("manager_id", userId)
        .eq("status", "active")
        .gte("end_date", new Date().toISOString())
        .order("start_date", { ascending: true });

      if (error) throw error;

      // Fetch delegate profiles separately
      if (data && data.length > 0) {
        const delegateIds = data.map(d => d.delegate_id);
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, email")
          .in("user_id", delegateIds);

        if (profilesError) throw profilesError;

        const delegationsWithProfiles = data.map(delegation => ({
          ...delegation,
          profiles: profiles?.find(p => p.user_id === delegation.delegate_id) || {
            first_name: "",
            last_name: "",
            email: "",
          },
        }));

        setDelegations(delegationsWithProfiles);
      }
    } catch (error: any) {
      console.error("Error fetching delegations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (delegationId: string) => {
    try {
      const { error: updateError } = await supabase
        .from("manager_delegations")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_by: userId,
        })
        .eq("id", delegationId);

      if (updateError) throw updateError;

      // Create audit log
      await supabase
        .from("delegation_audit_log")
        .insert({
          delegation_id: delegationId,
          action: "revoked",
          performed_by: userId,
        });

      toast({
        title: "Success",
        description: "Delegation revoked successfully",
      });

      fetchDelegations();
    } catch (error: any) {
      console.error("Error revoking delegation:", error);
      toast({
        title: "Error",
        description: "Failed to revoke delegation",
        variant: "destructive",
      });
    }
  };

  if (loading || delegations.length === 0 || !isManager) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCheck className="h-5 w-5" />
          Active Delegations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {delegations.map((delegation) => (
          <div
            key={delegation.id}
            className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
          >
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {delegation.profiles.first_name} {delegation.profiles.last_name}
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
              Revoke
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
