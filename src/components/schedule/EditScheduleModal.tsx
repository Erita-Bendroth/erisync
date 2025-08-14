import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Clock, Plus, Trash2 } from "lucide-react";
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

interface WorkBlock {
  activity_type: string;
  hours: number;
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
  const [useHourSplit, setUseHourSplit] = useState(false);
  const [workBlocks, setWorkBlocks] = useState<WorkBlock[]>([
    { activity_type: "work", hours: 8 }
  ]);
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
      
      // Check if entry has hour split information in notes
      const hourSplitPattern = /Hours:\s*(.+)/;
      const match = entry.notes?.match(hourSplitPattern);
      if (match) {
        setUseHourSplit(true);
        try {
          const hoursData = JSON.parse(match[1]);
          if (Array.isArray(hoursData)) {
            setWorkBlocks(hoursData);
          }
        } catch (e) {
          console.error("Failed to parse hour split data");
        }
      } else {
        setUseHourSplit(false);
        setWorkBlocks([{ activity_type: "work", hours: 8 }]);
      }
    }
  }, [entry]);

  const addWorkBlock = () => {
    setWorkBlocks([...workBlocks, { activity_type: "work", hours: 1 }]);
  };

  const removeWorkBlock = (index: number) => {
    if (workBlocks.length > 1) {
      setWorkBlocks(workBlocks.filter((_, i) => i !== index));
    }
  };

  const updateWorkBlock = (index: number, field: keyof WorkBlock, value: string | number) => {
    const updated = [...workBlocks];
    updated[index] = { ...updated[index], [field]: value };
    setWorkBlocks(updated);
  };

  const getTotalHours = () => {
    return workBlocks.reduce((sum, block) => sum + block.hours, 0);
  };

  const handleSave = async () => {
    if (!entry) return;

    // No validation for total hours - allow flexible scheduling

    try {
      setLoading(true);
      
      let notes = formData.notes.trim();
      let primaryActivityType = formData.activity_type;
      
      if (useHourSplit) {
        // Store hour split in notes
        const hoursData = JSON.stringify(workBlocks);
        notes = `Hours: ${hoursData}${notes ? '\n' + notes : ''}`;
        
        // Set primary activity to the one with most hours
        const primaryActivity = workBlocks.reduce((prev, current) => 
          current.hours > prev.hours ? current : prev
        );
        primaryActivityType = primaryActivity.activity_type as any;
      }
      
      const { error } = await supabase
        .from("schedule_entries")
        .update({
          shift_type: formData.shift_type,
          activity_type: primaryActivityType,
          availability_status: formData.availability_status,
          notes: notes || null,
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

          {/* Hour split toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Split Hours</Label>
              <div className="text-sm text-muted-foreground">
                Divide the workday into different activities (flexible hours)
              </div>
            </div>
            <Switch
              checked={useHourSplit}
              onCheckedChange={setUseHourSplit}
            />
          </div>

          {useHourSplit ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Hour Breakdown (Total: {getTotalHours()}h)
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addWorkBlock}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Block
                </Button>
              </div>
              
              {workBlocks.map((block, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Activity</Label>
                    <Select
                      value={block.activity_type}
                      onValueChange={(value) => updateWorkBlock(index, 'activity_type', value)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
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
                  <div className="w-20">
                    <Label className="text-xs">Hours</Label>
                    <Input
                      type="number"
                      min="0.5"
                      max="8"
                      step="0.5"
                      value={block.hours}
                      onChange={(e) => updateWorkBlock(index, 'hours', parseFloat(e.target.value) || 0)}
                      className="h-8"
                    />
                  </div>
                  {workBlocks.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeWorkBlock(index)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
              
            </div>
          ) : (
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
          )}

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