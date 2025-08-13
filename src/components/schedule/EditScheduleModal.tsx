import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ScheduleEntry {
  id: string;
  user_id: string;
  date: string;
  shift_type: string;
  activity_type: string;
  availability_status: string;
  notes?: string;
  profiles: {
    first_name: string;
    last_name: string;
  };
  teams: {
    name: string;
  };
}

interface EditScheduleModalProps {
  entry: ScheduleEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const shiftTypes = [
  { value: "normal", label: "Normal" },
  { value: "early", label: "Early" },
  { value: "late", label: "Late" }
];

const activityTypes = [
  { value: "work", label: "Work" },
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick Leave" },
  { value: "hotline_support", label: "Hotline Support" },
  { value: "out_of_office", label: "Out of Office" },
  { value: "training", label: "Training" },
  { value: "flextime", label: "Flextime" },
  { value: "working_from_home", label: "Working from Home" }
];

const availabilityStatuses = [
  { value: "available", label: "Available" },
  { value: "unavailable", label: "Unavailable" }
];

export const EditScheduleModal: React.FC<EditScheduleModalProps> = ({
  entry,
  isOpen,
  onClose,
  onSave
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<{
    shift_type: "normal" | "early" | "late";
    activity_type: "work" | "vacation" | "sick" | "hotline_support" | "out_of_office" | "training" | "flextime" | "working_from_home";
    availability_status: "available" | "unavailable";
    notes: string;
  }>({
    shift_type: "normal",
    activity_type: "work",
    availability_status: "available",
    notes: ""
  });

  useEffect(() => {
    if (entry) {
      setFormData({
        shift_type: (entry.shift_type as "normal" | "early" | "late") || "normal",
        activity_type: (entry.activity_type as "work" | "vacation" | "sick" | "hotline_support" | "out_of_office" | "training" | "flextime" | "working_from_home") || "work",
        availability_status: (entry.availability_status as "available" | "unavailable") || "available",
        notes: entry.notes || ""
      });
    }
  }, [entry]);

  const handleSave = async () => {
    if (!entry) return;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from("schedule_entries")
        .update({
          shift_type: formData.shift_type,
          activity_type: formData.activity_type,
          availability_status: formData.availability_status,
          notes: formData.notes.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", entry.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Schedule entry updated successfully",
      });

      onSave();
      onClose();
    } catch (error) {
      console.error("Error updating schedule entry:", error);
      toast({
        title: "Error",
        description: "Failed to update schedule entry",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  if (!entry) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Schedule Entry</DialogTitle>
          <DialogDescription>
            Editing shift for {entry.profiles.first_name} {entry.profiles.last_name} on{" "}
            {format(new Date(entry.date), "EEEE, MMMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="shift_type">Shift Type</Label>
            <Select
              value={formData.shift_type}
              onValueChange={(value: "normal" | "early" | "late") => setFormData({ ...formData, shift_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select shift type" />
              </SelectTrigger>
              <SelectContent>
                {shiftTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="activity_type">Activity Type</Label>
            <Select
              value={formData.activity_type}
              onValueChange={(value: "work" | "vacation" | "sick" | "hotline_support" | "out_of_office" | "training" | "flextime" | "working_from_home") => setFormData({ ...formData, activity_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select activity type" />
              </SelectTrigger>
              <SelectContent>
                {activityTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="availability_status">Availability Status</Label>
            <Select
              value={formData.availability_status}
              onValueChange={(value: "available" | "unavailable") => setFormData({ ...formData, availability_status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select availability" />
              </SelectTrigger>
              <SelectContent>
                {availabilityStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};