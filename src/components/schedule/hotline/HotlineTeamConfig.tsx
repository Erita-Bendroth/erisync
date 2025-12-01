import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { formatUserName } from "@/lib/utils";
import { format } from "date-fns";

interface TeamMember {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
}

interface HotlineTeamConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
}

export const HotlineTeamConfig = ({ open, onOpenChange, teamId, teamName }: HotlineTeamConfigProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [minStaffRequired, setMinStaffRequired] = useState(1);
  const [weekdayStart, setWeekdayStart] = useState("08:00");
  const [weekdayEnd, setWeekdayEnd] = useState("15:00");
  const [fridayStart, setFridayStart] = useState("08:00");
  const [fridayEnd, setFridayEnd] = useState("13:00");
  const [lastAssignments, setLastAssignments] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (open && teamId) {
      fetchTeamMembers();
      fetchConfig();
      fetchLastAssignments();
    }
  }, [open, teamId]);

  const fetchTeamMembers = async () => {
    try {
      const { data: members, error } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", teamId);

      if (error) throw error;

      if (!members || members.length === 0) return;

      const { data: profiles } = await supabase.rpc("get_multiple_basic_profile_info", {
        _user_ids: members.map(m => m.user_id),
      });

      setTeamMembers(profiles || []);
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  };

  const fetchConfig = async () => {
    try {
      const { data: config } = await supabase
        .from("hotline_team_config")
        .select("*")
        .eq("team_id", teamId)
        .single();

      if (config) {
        setMinStaffRequired(config.min_staff_required);
        setWeekdayStart(config.weekday_start_time);
        setWeekdayEnd(config.weekday_end_time);
        setFridayStart(config.friday_start_time);
        setFridayEnd(config.friday_end_time);
      }

      const { data: eligible } = await supabase
        .from("hotline_eligible_members")
        .select("user_id")
        .eq("team_id", teamId)
        .eq("is_active", true);

      if (eligible) {
        setSelectedMembers(new Set(eligible.map(e => e.user_id)));
      }
    } catch (error) {
      console.error("Error fetching config:", error);
    }
  };

  const fetchLastAssignments = async () => {
    try {
      const { data: assignments } = await supabase
        .from("duty_assignments")
        .select("user_id, date")
        .eq("team_id", teamId)
        .eq("duty_type", "hotline")
        .order("date", { ascending: false });

      if (assignments) {
        const map = new Map<string, string>();
        assignments.forEach(a => {
          if (!map.has(a.user_id)) {
            map.set(a.user_id, format(new Date(a.date), "MMM d, yyyy"));
          }
        });
        setLastAssignments(map);
      }
    } catch (error) {
      console.error("Error fetching last assignments:", error);
    }
  };

  const toggleMember = (userId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedMembers(newSelected);
  };

  const selectAll = () => {
    setSelectedMembers(new Set(teamMembers.map(m => m.user_id)));
  };

  const clearAll = () => {
    setSelectedMembers(new Set());
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Upsert config
      const { error: configError } = await supabase
        .from("hotline_team_config")
        .upsert({
          team_id: teamId,
          min_staff_required: minStaffRequired,
          weekday_start_time: weekdayStart,
          weekday_end_time: weekdayEnd,
          friday_start_time: fridayStart,
          friday_end_time: fridayEnd,
          created_by: user.id,
        });

      if (configError) throw configError;

      // Delete existing eligible members
      await supabase
        .from("hotline_eligible_members")
        .delete()
        .eq("team_id", teamId);

      // Insert new eligible members
      if (selectedMembers.size > 0) {
        const { error: membersError } = await supabase
          .from("hotline_eligible_members")
          .insert(
            Array.from(selectedMembers).map(userId => ({
              team_id: teamId,
              user_id: userId,
              added_by: user.id,
            }))
          );

        if (membersError) throw membersError;
      }

      toast({
        title: "Success",
        description: "Hotline configuration saved",
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving config:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hotline Configuration - {teamName}</DialogTitle>
          <DialogDescription>
            Configure hotline settings and select eligible team members
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Staff Required */}
          <div className="space-y-2">
            <Label>Staff Required Per Day</Label>
            <Select
              value={minStaffRequired.toString()}
              onValueChange={(v) => setMinStaffRequired(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 person</SelectItem>
                <SelectItem value="2">2 people</SelectItem>
                <SelectItem value="3">3 people</SelectItem>
                <SelectItem value="4">4 people</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Hotline Hours */}
          <div className="space-y-3">
            <Label>Hotline Hours</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Monday-Thursday</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={weekdayStart}
                    onChange={(e) => setWeekdayStart(e.target.value)}
                  />
                  <span>-</span>
                  <Input
                    type="time"
                    value={weekdayEnd}
                    onChange={(e) => setWeekdayEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Friday</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={fridayStart}
                    onChange={(e) => setFridayStart(e.target.value)}
                  />
                  <span>-</span>
                  <Input
                    type="time"
                    value={fridayEnd}
                    onChange={(e) => setFridayEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Eligible Members */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Eligible Members</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Clear All
                </Button>
              </div>
            </div>

            <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
              {teamMembers.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-2 hover:bg-accent rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedMembers.has(member.user_id)}
                      onCheckedChange={() => toggleMember(member.user_id)}
                    />
                    <span>
                      {formatUserName(member.first_name, member.last_name)} ({member.initials})
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {lastAssignments.get(member.user_id) ? (
                      `Last: ${lastAssignments.get(member.user_id)}`
                    ) : (
                      "Never assigned"
                    )}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-sm text-muted-foreground">
              {selectedMembers.size} of {teamMembers.length} selected
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || selectedMembers.size === 0}>
            {loading ? "Saving..." : "Save Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
