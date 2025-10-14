import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
}

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
  email?: string; // Email may not be available for security reasons
}

interface ScheduleEntryFormProps {
  children: React.ReactNode;
  onSuccess?: () => void;
  editEntry?: any;
}

const ScheduleEntryForm: React.FC<ScheduleEntryFormProps> = ({ 
  children, 
  onSuccess,
  editEntry 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  
  const [formData, setFormData] = useState({
    user_id: "",
    team_id: "",
    date: "",
    shift_type: "normal",
    activity_type: "work",
    availability_status: "available",
    notes: "",
  });

  useEffect(() => {
    fetchUserRoles();
  }, [user]);

  useEffect(() => {
    if (open && hasPermission) {
      fetchTeams();
      fetchProfiles();
      
      // If editing, populate form
      if (editEntry) {
        setFormData({
          user_id: editEntry.user_id,
          team_id: editEntry.team_id,
          date: editEntry.date,
          shift_type: editEntry.shift_type,
          activity_type: editEntry.activity_type,
          availability_status: editEntry.availability_status,
          notes: editEntry.notes || "",
        });
        setSelectedDate(new Date(editEntry.date));
      }
    }
  }, [open, editEntry, hasPermission]);

  const fetchUserRoles = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (error) throw error;
      
      const roles = data?.map(r => r.role) || [];
      setUserRoles(roles);
      
      // Check if user has permission (planner or manager)
      const canSchedule = roles.includes('planner') || roles.includes('manager');
      setHasPermission(canSchedule);
      
    } catch (error) {
      console.error("Error fetching user roles:", error);
    }
  };

  const fetchTeams = async () => {
    try {
      const { data } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");
      
      setTeams(data || []);
    } catch (error) {
      console.error("Error fetching teams:", error);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data } = await supabase
        .rpc('get_all_basic_profiles');
      
      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || !formData.user_id || !formData.team_id) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const scheduleData = {
        user_id: formData.user_id,
        team_id: formData.team_id,
        date: formData.date,
        shift_type: formData.shift_type as "early" | "late" | "normal",
        activity_type: formData.activity_type as "work" | "vacation" | "other" | "hotline_support" | "out_of_office" | "training" | "flextime" | "working_from_home",
        availability_status: (["work", "working_from_home", "hotline_support"].includes(formData.activity_type) ? "available" : "unavailable") as "available" | "unavailable",
        notes: formData.notes,
        created_by: user!.id,
      };

      let result;
      if (editEntry) {
        result = await supabase
          .from("schedule_entries")
          .update(scheduleData)
          .eq("id", editEntry.id);
      } else {
        result = await supabase
          .from("schedule_entries")
          .insert([scheduleData]);
      }

      if (result.error) throw result.error;

      toast({
        title: "Success",
        description: `Schedule entry ${editEntry ? "updated" : "created"} successfully`,
      });

      setOpen(false);
      setFormData({
        user_id: "",
        team_id: "",
        date: "",
        shift_type: "normal",
        activity_type: "work",
        availability_status: "available",
        notes: "",
      });
      setSelectedDate(undefined);
      
      if (onSuccess) onSuccess();
      
    } catch (error: any) {
      console.error("Error saving schedule entry:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save schedule entry",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Don't render if user doesn't have permission
  if (!hasPermission) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editEntry ? "Edit Schedule Entry" : "Add Schedule Entry"}
          </DialogTitle>
          <DialogDescription>
            {editEntry ? "Update the schedule entry details." : "Add a new schedule entry for a team member."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Employee</Label>
              <Select
                value={formData.user_id}
                onValueChange={(value) => setFormData({ ...formData, user_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.user_id} value={profile.user_id}>
                      {profile.first_name} {profile.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="team">Team</Label>
              <Select
                value={formData.team_id}
                onValueChange={(value) => setFormData({ ...formData, team_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shift-type">Shift Type</Label>
              <Select
                value={formData.shift_type}
                onValueChange={(value) => setFormData({ ...formData, shift_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="early">Early</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity-type">Activity</Label>
               <Select
                 value={formData.activity_type}
                 onValueChange={(value) => {
                   const availableTypes = ["work", "working_from_home", "hotline_support"];
                   setFormData({ 
                     ...formData, 
                     activity_type: value, 
                     availability_status: (availableTypes.includes(value) ? "available" : "unavailable") 
                   });
                 }}
               >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">Work</SelectItem>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="hotline_support">Hotline Support</SelectItem>
                  <SelectItem value="out_of_office">Out of Office</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="flextime">Flextime</SelectItem>
                  <SelectItem value="working_from_home">Working from Home</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : editEntry ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleEntryForm;