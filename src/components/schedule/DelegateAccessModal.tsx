import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, UserCheck, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DelegateAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  managerId: string;
  onSuccess: () => void;
}

interface User {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export function DelegateAccessModal({ open, onOpenChange, managerId, onSuccess }: DelegateAccessModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchEligibleUsers();
    }
  }, [open]);

  const fetchEligibleUsers = async () => {
    try {
      // Get current user's roles
      const { data: currentUserRoles, error: currentRoleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", managerId);

      if (currentRoleError) throw currentRoleError;

      const roles = currentUserRoles?.map(r => r.role) || [];
      const isAdmin = roles.includes("admin");
      const isPlanner = roles.includes("planner");
      const isManager = roles.includes("manager");

      // Determine eligible roles based on current user's role
      let eligibleRoles: Array<"admin" | "planner" | "manager"> = [];
      if (isAdmin) {
        eligibleRoles = ["admin", "planner", "manager"];
      } else if (isPlanner) {
        eligibleRoles = ["planner", "manager"];
      } else if (isManager) {
        eligibleRoles = ["manager"];
      }

      // Fetch all users with eligible roles, except the current user
      const { data: eligibleRoles_data, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", eligibleRoles)
        .neq("user_id", managerId);

      if (rolesError) throw rolesError;

      const eligibleUserIds = [...new Set(eligibleRoles_data?.map(r => r.user_id) || [])];

      if (eligibleUserIds.length === 0) {
        setUsers([]);
        return;
      }

      // Fetch profiles for eligible users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", eligibleUserIds)
        .order("first_name", { ascending: true });

      if (profilesError) throw profilesError;

      setUsers(profiles || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserId || !startDate || !endDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (endDate <= startDate) {
      toast({
        title: "Validation Error",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Check if delegate has access to delegator's teams
      const { data: delegatorTeams, error: teamsError } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", managerId)
        .eq("is_manager", true);

      if (teamsError) throw teamsError;

      const { data: delegateTeams, error: delegateTeamsError } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", selectedUserId);

      if (delegateTeamsError) throw delegateTeamsError;

      const delegatorTeamIds = delegatorTeams?.map(t => t.team_id) || [];
      const delegateTeamIds = delegateTeams?.map(t => t.team_id) || [];
      const missingTeamAccess = delegatorTeamIds.filter(id => !delegateTeamIds.includes(id));

      // Grant temporary team access if needed
      if (missingTeamAccess.length > 0) {
        const teamMemberInserts = missingTeamAccess.map(teamId => ({
          user_id: selectedUserId,
          team_id: teamId,
          is_manager: false,
        }));

        const { error: teamAccessError } = await supabase
          .from("team_members")
          .insert(teamMemberInserts);

        if (teamAccessError) {
          throw new Error(`Cannot grant team access: ${teamAccessError.message}. Please contact an admin.`);
        }
      }

      // Create delegation
      const { data: delegation, error: delegationError } = await supabase
        .from("manager_delegations")
        .insert({
          manager_id: managerId,
          delegate_id: selectedUserId,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: "active",
        })
        .select()
        .single();

      if (delegationError) throw delegationError;

      // Create audit log
      await supabase
        .from("delegation_audit_log")
        .insert({
          delegation_id: delegation.id,
          action: "created",
          performed_by: managerId,
          details: {
            delegate_id: selectedUserId,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            teams_granted: missingTeamAccess,
          },
        });

      // Send notification email
      const selectedUser = users.find(u => u.user_id === selectedUserId);
      const { data: currentUserProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("user_id", managerId)
        .single();

      if (selectedUser && currentUserProfile) {
        await supabase.functions.invoke("send-delegation-notification", {
          body: {
            action: "created",
            delegateEmail: selectedUser.email,
            delegateName: `${selectedUser.first_name} ${selectedUser.last_name}`,
            managerName: `${currentUserProfile.first_name} ${currentUserProfile.last_name}`,
            startDate: format(startDate, "PPP"),
            endDate: format(endDate, "PPP"),
          },
        });
      }

      toast({
        title: "Success",
        description: missingTeamAccess.length > 0 
          ? "Delegation created and team access granted successfully"
          : "Delegation created successfully",
      });

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Error creating delegation:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create delegation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedUserId("");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Delegate Manager Access
          </DialogTitle>
          <DialogDescription>
            Grant temporary manager permissions to another user
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            The delegate will have the same permissions as you for all your teams during the selected period.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delegate">Select User</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a user..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {user.first_name} {user.last_name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const compareDate = new Date(date);
                      compareDate.setHours(0, 0, 0, 0);
                      return compareDate < today;
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => {
                      if (!startDate) return true;
                      const compareDate = new Date(date);
                      compareDate.setHours(0, 0, 0, 0);
                      const compareStart = new Date(startDate);
                      compareStart.setHours(0, 0, 0, 0);
                      return compareDate < compareStart;
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Delegation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
