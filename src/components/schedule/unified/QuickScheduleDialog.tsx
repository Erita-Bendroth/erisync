import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Database } from '@/integrations/supabase/types';
import { format } from 'date-fns';
import { Calendar, User } from 'lucide-react';

type ShiftType = Database['public']['Enums']['shift_type'];
type ActivityType = Database['public']['Enums']['activity_type'];
type AvailabilityStatus = Database['public']['Enums']['availability_status'];

interface ScheduleEntry {
  user_id: string;
  team_id: string;
  date: string;
  shift_type: ShiftType | null;
  activity_type: ActivityType;
  availability_status: AvailabilityStatus;
  notes?: string;
}

interface QuickScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userInitials: string;
  date: string;
  teamId: string;
  teamName: string;
  currentEntry?: ScheduleEntry;
  onSave: (data: {
    shift_type: ShiftType | null;
    activity_type: ActivityType;
    availability_status: AvailabilityStatus;
    notes?: string;
  }) => void;
}

export const QuickScheduleDialog: React.FC<QuickScheduleDialogProps> = ({
  open,
  onOpenChange,
  userId,
  userName,
  userInitials,
  date,
  teamId,
  teamName,
  currentEntry,
  onSave,
}) => {
  const [availability, setAvailability] = useState<AvailabilityStatus>(
    currentEntry?.availability_status || 'available'
  );
  const [shiftType, setShiftType] = useState<ShiftType | null>(
    currentEntry?.shift_type || null
  );
  const [notes, setNotes] = useState(currentEntry?.notes || '');

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open) {
      setAvailability(currentEntry?.availability_status || 'available');
      setShiftType(currentEntry?.shift_type || null);
      setNotes(currentEntry?.notes || '');
    }
  }, [open, currentEntry]);

  const handleSave = () => {
    onSave({
      shift_type: shiftType,
      activity_type: availability === 'available' ? 'work' : 'vacation',
      availability_status: availability,
      notes: notes || undefined,
    });
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, availability, shiftType, notes]);

  const formattedDate = format(new Date(date), 'EEEE, MMMM d, yyyy');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Quick Schedule Entry</DialogTitle>
          <DialogDescription>
            Add or edit schedule entry for the selected date and team member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* User and Date Info */}
          <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-base font-bold cursor-help"
              title={`${userName} - ${teamName}`}
            >
              {userInitials}
            </div>
            <p className="text-sm text-muted-foreground">{teamName}</p>
          </div>
            <Badge variant="outline" className="gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(date), 'MMM d')}
            </Badge>
          </div>

          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {formattedDate}
          </div>

          {/* Availability Selection */}
          <div className="space-y-3">
            <Label className="text-base">Availability</Label>
            <RadioGroup 
              value={availability} 
              onValueChange={(val) => setAvailability(val as AvailabilityStatus)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 border border-border rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer">
                <RadioGroupItem value="available" id="quick-available" />
                <Label htmlFor="quick-available" className="font-normal cursor-pointer flex-1">
                  Available for work
                </Label>
              </div>
              <div className="flex items-center space-x-3 border border-border rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer">
                <RadioGroupItem value="unavailable" id="quick-unavailable" />
                <Label htmlFor="quick-unavailable" className="font-normal cursor-pointer flex-1">
                  Unavailable (vacation/off)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Shift Type Selection */}
          {availability === 'available' && (
            <div className="space-y-3">
              <Label className="text-base">Shift Type</Label>
              <Select 
                value={shiftType || ''} 
                onValueChange={(val) => setShiftType(val as ShiftType)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select shift type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Day Shift (Normal)</SelectItem>
                  <SelectItem value="early">Early Shift</SelectItem>
                  <SelectItem value="late">Late Shift</SelectItem>
                  <SelectItem value="weekend">Weekend Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-3">
            <Label className="text-base">Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <p className="text-xs text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 text-xs border rounded bg-muted">Ctrl+Enter</kbd> to save
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
