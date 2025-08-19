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
import { TimeSelect } from "@/components/ui/time-select";

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
  start_time: string;
  end_time: string;
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
  const [sendNotification, setSendNotification] = useState(false);
  const [workBlocks, setWorkBlocks] = useState<WorkBlock[]>([
    { activity_type: "work", start_time: "09:00", end_time: "17:00" }
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
      
      // Check if entry has time split information in notes
      const timeSplitPattern = /Times:\s*(.+)/;
      const match = entry.notes?.match(timeSplitPattern);
      if (match) {
        setUseHourSplit(true);
        try {
          const timesData = JSON.parse(match[1]);
          if (Array.isArray(timesData)) {
            setWorkBlocks(timesData);
          }
        } catch (e) {
          console.error("Failed to parse time split data");
        }
      } else {
        setUseHourSplit(false);
        setWorkBlocks([{ activity_type: "work", start_time: "09:00", end_time: "17:00" }]);
      }
    }
  }, [entry]);

  const addWorkBlock = () => {
    setWorkBlocks([...workBlocks, { activity_type: "work", start_time: "09:00", end_time: "10:00" }]);
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
    return workBlocks.reduce((sum, block) => {
      const start = new Date(`2000-01-01T${block.start_time}:00`);
      const end = new Date(`2000-01-01T${block.end_time}:00`);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);
  };

  const handleSave = async () => {
    if (!entry) return;

    try {
      setLoading(true);

      let notes = formData.notes.trim();
      let primaryActivityType = formData.activity_type;

      if (useHourSplit) {
        const timesData = JSON.stringify(workBlocks);
        notes = `Times: ${timesData}${notes ? '\n' + notes : ''}`;
        const primaryActivity = workBlocks.reduce((prev, current) => {
          const prevStart = new Date(`2000-01-01T${prev.start_time}:00`);
          const prevEnd = new Date(`2000-01-01T${prev.end_time}:00`);
          const prevHours = (prevEnd.getTime() - prevStart.getTime()) / (1000 * 60 * 60);
          const currentStart = new Date(`2000-01-01T${current.start_time}:00`);
          const currentEnd = new Date(`2000-01-01T${current.end_time}:00`);
          const currentHours = (currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60);
          return currentHours > prevHours ? current : prev;
        });
        primaryActivityType = primaryActivity.activity_type as any;
      }

      // Create if temp entry, otherwise update
      if (entry.id.startsWith('temp-')) {
        const { data: authData } = await supabase.auth.getUser();
        const insertPayload = {
          user_id: entry.user_id,
          team_id: entry.team_id as any,
          date: format(new Date(entry.date), 'yyyy-MM-dd'),
          shift_type: formData.shift_type,
          activity_type: primaryActivityType,
          availability_status: formData.availability_status,
          notes: notes || null,
          created_by: authData.user?.id,
        };
        const { error } = await supabase.from('schedule_entries').insert(insertPayload);
        if (error) throw error;
        toast({ title: 'Success', description: 'Schedule entry created successfully' });
      } else {
        const { error } = await supabase
          .from('schedule_entries')
          .update({
            shift_type: formData.shift_type,
            activity_type: primaryActivityType,
            availability_status: formData.availability_status,
            notes: notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', entry.id);
        if (error) throw error;
        toast({ title: 'Success', description: 'Schedule entry updated successfully' });
      }

      // Send notification if requested
      if (sendNotification) {
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('user_id', entry.user_id)
            .maybeSingle();
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          const { data: currentUserProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', currentUser?.id)
            .maybeSingle();

          if (profileData?.email) {
            await supabase.functions.invoke('send-schedule-notification', {
              body: {
                userEmail: profileData.email,
                userName: `${profileData.first_name} ${profileData.last_name}`,
                scheduleDate: format(new Date(entry.date), 'PPP'),
                changeDetails: `Shift: ${formData.shift_type}, Activity: ${formData.activity_type}, Status: ${formData.availability_status}`,
                changedBy: currentUserProfile ? `${currentUserProfile.first_name} ${currentUserProfile.last_name}` : 'System',
              },
            });
          }
        } catch (notificationError) {
          console.error('Failed to send notification:', notificationError);
        }
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving schedule entry:', error);
      toast({ title: 'Error', description: 'Failed to save schedule entry', variant: 'destructive' });
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
              <Label>Split Time Schedule</Label>
              <div className="text-sm text-muted-foreground">
                Schedule exact times for different activities (e.g., 7:30-14:30)
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
                  Time Schedule (Total: {getTotalHours().toFixed(1)}h)
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addWorkBlock}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Time Block
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
                  <div className="w-24">
                    <Label className="text-xs">Start Time</Label>
                    <TimeSelect
                      value={block.start_time}
                      onChange={(val) => updateWorkBlock(index, 'start_time', val)}
                      className="h-8"
                    />
                  </div>
                  <div className="w-24">
                    <Label className="text-xs">End Time</Label>
                    <TimeSelect
                      value={block.end_time}
                      onChange={(val) => updateWorkBlock(index, 'end_time', val)}
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

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="sendNotification"
              checked={sendNotification}
              onChange={(e) => setSendNotification(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="sendNotification" className="text-sm cursor-pointer">
              Send email notification to user about this change
            </Label>
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