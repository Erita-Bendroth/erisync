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
import { useDesktopNotifications } from "@/hooks/useDesktopNotifications";
import { formatUserName } from "@/lib/utils";
import { useShiftTypes } from "@/hooks/useShiftTypes";
import { useHotlineScheduler } from "@/hooks/useHotlineScheduler";
import { HotlineReassignmentDialog } from "@/components/schedule/hotline/HotlineReassignmentDialog";

interface ScheduleEntry {
  id: string;
  user_id: string;
  team_id: string;
  date: string;
  shift_type: string;
  activity_type: string;
  availability_status: string;
  notes?: string;
  created_by?: string;
  creator_name?: string;
  profiles?: {
    first_name: string;
    last_name: string;
    initials?: string;
  };
  teams?: {
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
  onDelete?: () => void;
}

// Shift types are now loaded dynamically from admin definitions

const activityTypes = [
  { value: "work", label: "Work" },
  { value: "vacation", label: "Vacation" },
  { value: "other", label: "Other" },
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
  onSave,
  onDelete
}) => {
  const { toast } = useToast();
  const { showScheduleChangeNotification } = useDesktopNotifications();
  const teamIds = entry?.team_id ? [entry.team_id] : [];
  const { shiftTypes, loading: loadingShiftTypes } = useShiftTypes(teamIds);
  const { detectHotlineInEntry, formatTimeWithoutSeconds } = useHotlineScheduler();
  const [loading, setLoading] = useState(false);
  const [useHourSplit, setUseHourSplit] = useState(false);
  const [sendNotification, setSendNotification] = useState(false);
  const [showHotlineReassignment, setShowHotlineReassignment] = useState(false);
  const [pendingAction, setPendingAction] = useState<'delete' | 'vacation' | null>(null);
  const [hotlineDetails, setHotlineDetails] = useState<{ start_time: string; end_time: string } | null>(null);
  const [workBlocks, setWorkBlocks] = useState<WorkBlock[]>([
    { activity_type: "work", start_time: "09:00", end_time: "17:00" }
  ]);
  const [formData, setFormData] = useState<{
    shift_type: "normal" | "early" | "late" | "weekend";
    activity_type: "work" | "vacation" | "other" | "hotline_support" | "out_of_office" | "training" | "flextime" | "working_from_home";
    availability_status: "available" | "unavailable";
    notes: string;
  }>({
    shift_type: "normal",
    activity_type: "work",
    availability_status: "available",
    notes: ""
  });

  // Auto-set availability based on activity type
  const getAutoAvailability = (activityType: string): "available" | "unavailable" => {
    const availableTypes = ["work", "working_from_home", "hotline_support"];
    return availableTypes.includes(activityType) ? "available" : "unavailable";
  };

  useEffect(() => {
    if (entry) {
      // Extract user notes (everything after the Times: JSON data)
      let userNotes = "";
      const timeSplitPattern = /Times:\s*(\[.*?\])(\n(.*))?/s;
      const match = entry.notes?.match(timeSplitPattern);
      
      if (match) {
        // Time split data exists - extract user notes if they exist
        userNotes = match[3] || "";
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
        // No time split data - use notes as-is
        userNotes = entry.notes || "";
        setUseHourSplit(false);
        setWorkBlocks([{ activity_type: "work", start_time: "09:00", end_time: "17:00" }]);
      }

      setFormData({
        shift_type: (entry.shift_type as "normal" | "early" | "late" | "weekend") || "normal",
        activity_type: (entry.activity_type as "work" | "vacation" | "other" | "hotline_support" | "out_of_office" | "training" | "flextime" | "working_from_home") || "work",
        availability_status: (entry.availability_status as "available" | "unavailable") || "available",
        notes: userNotes
      });
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

    // Check if changing to vacation from non-vacation AND entry has hotline
    const originalWasNotVacation = entry?.activity_type !== 'vacation';
    const changingToVacation = formData.activity_type === 'vacation';
    
    if (originalWasNotVacation && changingToVacation && !entry.id.startsWith('temp-')) {
      const { hasHotline, hotlineBlock } = detectHotlineInEntry(entry.notes || null);
      
      if (hasHotline && hotlineBlock) {
        // Show hotline reassignment dialog
        setHotlineDetails(hotlineBlock);
        setPendingAction('vacation');
        setShowHotlineReassignment(true);
        return;
      }
    }

    await performSave();
  };

  const performSave = async () => {
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

      // Use activity type directly - no mapping needed
      const dbActivityType = primaryActivityType as "work" | "vacation" | "other" | "hotline_support" | "out_of_office" | "training" | "flextime" | "working_from_home";

      // Create if temp entry, otherwise update
      if (entry.id.startsWith('temp-')) {
        const { data: authData } = await supabase.auth.getUser();
        const insertPayload = {
          user_id: entry.user_id,
          team_id: entry.team_id as any,
          date: format(new Date(entry.date), 'yyyy-MM-dd'),
          shift_type: formData.shift_type,
          activity_type: dbActivityType,
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
            activity_type: dbActivityType,
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
            .select('email, first_name, last_name, initials')
            .eq('user_id', entry.user_id)
            .maybeSingle() as any;
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          const { data: currentUserProfile } = await supabase
            .from('profiles')
          .select('first_name, last_name, initials')
            .eq('user_id', currentUser?.id)
            .maybeSingle() as any;

          if (profileData?.email) {
            await supabase.functions.invoke('send-schedule-notification', {
              body: {
                userEmail: profileData.email,
                userName: formatUserName(profileData.first_name, profileData.last_name, profileData.initials),
                scheduleDate: format(new Date(entry.date), 'PPP'),
                changeDetails: `Shift: ${formData.shift_type}, Activity: ${formData.activity_type}, Status: ${formData.availability_status}`,
                changedBy: currentUserProfile ? formatUserName(currentUserProfile.first_name, currentUserProfile.last_name, currentUserProfile.initials) : 'System',
              },
            });
          }
          
          // Show desktop notification if schedule change notifications are enabled
          if (profileData) {
            const changeType = entry.id.startsWith('temp-') ? 'created' : 'updated';
            showScheduleChangeNotification({
              employeeName: formatUserName(profileData.first_name, profileData.last_name, profileData.initials),
              date: format(new Date(entry.date), 'PPP'),
              changeType: changeType
            });
          }
        } catch (notificationError) {
          console.error('Failed to send notification:', notificationError);
        }
      } else {
        // Even if email notification is not requested, show desktop notification
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('first_name, last_name, initials')
            .eq('user_id', entry.user_id)
            .maybeSingle() as any;
            
          if (profileData) {
            const changeType = entry.id.startsWith('temp-') ? 'created' : 'updated';
            showScheduleChangeNotification({
              employeeName: formatUserName(profileData.first_name, profileData.last_name, profileData.initials),
              date: format(new Date(entry.date), 'PPP'),
              changeType: changeType
            });
          }
        } catch (error) {
          console.error('Failed to show desktop notification:', error);
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

  const handleDelete = async () => {
    if (!entry || entry.id.startsWith('temp-')) return;

    // Check if entry has hotline duty
    const { hasHotline, hotlineBlock } = detectHotlineInEntry(entry.notes || null);
    
    if (hasHotline && hotlineBlock) {
      // Show hotline reassignment dialog instead of deleting immediately
      setHotlineDetails(hotlineBlock);
      setPendingAction('delete');
      setShowHotlineReassignment(true);
      return;
    }

    await performDelete();
  };

  const performDelete = async () => {
    if (!entry || entry.id.startsWith('temp-')) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from('schedule_entries')
        .delete()
        .eq('id', entry.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Schedule entry deleted successfully' });
      
      onDelete?.();
      onSave();
      onClose();
    } catch (error) {
      console.error('Error deleting schedule entry:', error);
      toast({ title: 'Error', description: 'Failed to delete schedule entry', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleHotlineReassignment = async (newUserId: string | null) => {
    if (!entry || !hotlineDetails) return;

    try {
      setLoading(true);

      // If a new user was selected, reassign hotline to them
      if (newUserId) {
        const { data: authData } = await supabase.auth.getUser();
        
        // Check if the new user already has a schedule entry for this date
        const { data: existingEntry } = await supabase
          .from('schedule_entries')
          .select('id, notes, shift_type, activity_type')
          .eq('user_id', newUserId)
          .eq('team_id', entry.team_id)
          .eq('date', entry.date)
          .maybeSingle();

        if (existingEntry) {
          // Add hotline block to existing entry
          let timeBlocks: any[] = [];
          const timeSplitPattern = /Times:\s*(\[.*?\])/;
          const match = existingEntry.notes?.match(timeSplitPattern);
          
          if (match) {
            try {
              timeBlocks = JSON.parse(match[1]);
            } catch (e) {
              console.error('Failed to parse existing time blocks');
            }
          } else {
            // Create default time block based on shift type
            const shiftStart = existingEntry.shift_type === 'early' ? '06:00' : 
                              existingEntry.shift_type === 'late' ? '14:00' : '08:00';
            const shiftEnd = existingEntry.shift_type === 'early' ? '14:00' : 
                            existingEntry.shift_type === 'late' ? '22:00' : '16:00';
            timeBlocks = [{
              activity_type: existingEntry.activity_type,
              start_time: shiftStart,
              end_time: shiftEnd
            }];
          }

          // Add hotline time block
          timeBlocks.push({
            activity_type: "hotline_support",
            start_time: formatTimeWithoutSeconds(hotlineDetails.start_time),
            end_time: formatTimeWithoutSeconds(hotlineDetails.end_time)
          });

          const newNotes = `Times: ${JSON.stringify(timeBlocks)}`;

          await supabase
            .from('schedule_entries')
            .update({ notes: newNotes })
            .eq('id', existingEntry.id);
        } else {
          // Create new entry with just hotline
          const timeBlocks = [{
            activity_type: "hotline_support",
            start_time: formatTimeWithoutSeconds(hotlineDetails.start_time),
            end_time: formatTimeWithoutSeconds(hotlineDetails.end_time)
          }];

          await supabase.from('schedule_entries').insert({
            user_id: newUserId,
            team_id: entry.team_id,
            date: entry.date,
            shift_type: 'normal',
            activity_type: 'hotline_support',
            availability_status: 'available',
            notes: `Times: ${JSON.stringify(timeBlocks)}`,
            created_by: authData.user?.id
          });
        }

        toast({
          title: 'Hotline Reassigned',
          description: 'Hotline duty has been reassigned successfully'
        });
      }

      // Proceed with the original action (delete or vacation)
      if (pendingAction === 'delete') {
        await performDelete();
      } else if (pendingAction === 'vacation') {
        await performSave();
      }

      // Reset state
      setShowHotlineReassignment(false);
      setPendingAction(null);
      setHotlineDetails(null);
    } catch (error) {
      console.error('Error reassigning hotline:', error);
      toast({
        title: 'Error',
        description: 'Failed to reassign hotline duty',
        variant: 'destructive'
      });
      setLoading(false);
    }
  };

  const handleCancelReassignment = () => {
    setShowHotlineReassignment(false);
    setPendingAction(null);
    setHotlineDetails(null);
  };

  if (!entry) return null;

  return (
    <>
      <HotlineReassignmentDialog
        open={showHotlineReassignment}
        onOpenChange={setShowHotlineReassignment}
        teamId={entry.team_id}
        date={entry.date}
        originalUserId={entry.user_id}
        originalUserName={entry.profiles ? formatUserName(entry.profiles.first_name, entry.profiles.last_name, entry.profiles.initials) : 'User'}
        hotlineTimeBlock={hotlineDetails || { start_time: '08:00', end_time: '15:00' }}
        onReassigned={handleHotlineReassignment}
        onCancel={handleCancelReassignment}
      />

      <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Schedule Entry</DialogTitle>
          <DialogDescription>
            Editing shift for {entry.profiles ? formatUserName(entry.profiles.first_name, entry.profiles.last_name, entry.profiles.initials) : 'User'} on{" "}
            {format(new Date(entry.date), "EEEE, MMMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>
        
        {entry.creator_name && (
          <div className="mt-2 p-2 bg-muted rounded-md text-sm">
            <span className="text-muted-foreground">Scheduled by:</span>{' '}
            <span className="font-medium">{entry.creator_name}</span>
          </div>
        )}
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="shift_type">Shift Type</Label>
            {loadingShiftTypes ? (
              <div className="h-10 bg-muted animate-pulse rounded-md" />
            ) : (
              <Select
                value={formData.shift_type}
                onValueChange={(value: "normal" | "early" | "late" | "weekend") => setFormData({ ...formData, shift_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select shift type" />
                </SelectTrigger>
                <SelectContent>
                  {shiftTypes.map((type) => (
                    <SelectItem key={type.id} value={type.type}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
                       onValueChange={(value) => {
                         updateWorkBlock(index, 'activity_type', value);
                         // Auto-update availability when activity changes in time blocks
                         const hasWorkActivity = [...workBlocks.slice(0, index), { ...workBlocks[index], activity_type: value }, ...workBlocks.slice(index + 1)]
                           .some(block => ["work", "working_from_home", "hotline_support"].includes(block.activity_type));
                         setFormData(prev => ({ 
                           ...prev, 
                           availability_status: hasWorkActivity ? "available" : "unavailable",
                           activity_type: value as any
                         }));
                       }}
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
                      onValueChange={(val) => updateWorkBlock(index, 'start_time', val)}
                    />
                  </div>
                  <div className="w-24">
                    <Label className="text-xs">End Time</Label>
                    <TimeSelect
                      value={block.end_time}
                      onValueChange={(val) => updateWorkBlock(index, 'end_time', val)}
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
              onValueChange={(value: "work" | "vacation" | "other" | "hotline_support" | "out_of_office" | "training" | "flextime" | "working_from_home") => 
                setFormData({ 
                  ...formData, 
                  activity_type: value,
                  availability_status: getAutoAvailability(value)
                })
              }
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

        <DialogFooter className="flex justify-between">
          <div>
            {!entry.id.startsWith('temp-') && (
              <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};