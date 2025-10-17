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
      console.log("Fetching eligible users for delegation, managerId:", managerId);
      
      // Use the security definer function to get eligible users
      const { data, error } = await supabase
        .rpc("get_eligible_delegation_users", {
          _requesting_user_id: managerId
        });

      if (error) {
        console.error("Error from get_eligible_delegation_users:", error);
        throw error;
      }

      console.log("Eligible users found:", data?.length || 0);

      if (!data || data.length === 0) {
        setUsers([]);
        toast({
          title: "No Eligible Users",
          description: "No users available for delegation. You may need appropriate permissions or there are no other users with delegatable roles.",
          variant: "default",
        });
        return;
      }

      // Map the data to the User interface format
      const mappedUsers = data.map(user => ({
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
      }));

      setUsers(mappedUsers);
    } catch (error: any) {
      console.error("Error fetching eligible delegation users:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load users",
        variant: "destructive",
      });
      setUsers([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("Delegation form submission started:", {
      managerId,
      selectedUserId,
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
    });

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
      console.log("Calling create_manager_delegation RPC function...");
      
      // Use the secure function to create delegation with automatic team access
      const { data: delegationResult, error: delegationError } = await supabase
        .rpc("create_manager_delegation", {
          _manager_id: managerId,
          _delegate_id: selectedUserId,
          _start_date: startDate.toISOString(),
          _end_date: endDate.toISOString(),
        });

      if (delegationError) {
        console.error("RPC function error:", delegationError);
        throw new Error(delegationError.message || "Failed to create delegation");
      }

      console.log("Delegation created successfully:", delegationResult);

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

      const teamsGranted = (delegationResult as any)?.teams_granted || 0;
      toast({
        title: "Success",
        description: teamsGranted > 0 
          ? `Delegation created and temporary access granted to ${teamsGranted} team${teamsGranted > 1 ? 's' : ''}`
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
            {users.length === 0 ? (
              <div className="p-4 text-center border rounded-md bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  No eligible users available for delegation. 
                  {/* This could be because you don't have the appropriate permissions or there are no other users with delegatable roles. */}
                </p>
              </div>
            ) : (
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
            )}
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
            <Button 
              type="submit" 
              disabled={loading || users.length === 0}
            >
              {loading ? "Creating..." : "Create Delegation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
