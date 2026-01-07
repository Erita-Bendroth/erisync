import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Database } from '@/integrations/supabase/types';
import { isDateWeekend } from '@/lib/shiftValidation';

type ShiftType = Database['public']['Enums']['shift_type'];
type ActivityType = Database['public']['Enums']['activity_type'];
type AvailabilityStatus = Database['public']['Enums']['availability_status'];

interface InlineEditPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  date: string;
  currentShiftType: ShiftType | null;
  currentActivityType: ActivityType;
  currentAvailabilityStatus: AvailabilityStatus;
  currentNotes?: string;
  onSave: (data: {
    shift_type: ShiftType | null;
    activity_type: ActivityType;
    availability_status: AvailabilityStatus;
    notes?: string;
  }) => void;
  children: React.ReactNode;
}

export const InlineEditPopover: React.FC<InlineEditPopoverProps> = ({
  open,
  onOpenChange,
  userId,
  userName,
  date,
  currentShiftType,
  currentActivityType,
  currentAvailabilityStatus,
  currentNotes,
  onSave,
  children,
}) => {
  const [availability, setAvailability] = useState<AvailabilityStatus>(currentAvailabilityStatus);
  const [shiftType, setShiftType] = useState<ShiftType | null>(currentShiftType);
  const [notes, setNotes] = useState(currentNotes || '');

  const handleSave = () => {
    onSave({
      shift_type: shiftType,
      activity_type: availability === 'available' ? 'work' : 'vacation',
      availability_status: availability,
      notes: notes || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm">{userName}</h4>
            <p className="text-xs text-muted-foreground">
              {new Date(date).toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Availability</Label>
            <RadioGroup value={availability} onValueChange={(val) => setAvailability(val as AvailabilityStatus)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="available" id="available" />
                <Label htmlFor="available" className="font-normal">Available</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="unavailable" id="unavailable" />
                <Label htmlFor="unavailable" className="font-normal">Unavailable</Label>
              </div>
            </RadioGroup>
          </div>

          {availability === 'available' && (() => {
            // Only show weekend option on actual weekends
            const isWeekend = isDateWeekend(date);
            
            return (
              <div className="space-y-2">
                <Label>Shift Type</Label>
                <Select value={shiftType || ''} onValueChange={(val) => setShiftType(val as ShiftType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select shift type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Day Shift</SelectItem>
                    <SelectItem value="early">Early Shift</SelectItem>
                    <SelectItem value="late">Late Shift</SelectItem>
                    {isWeekend && <SelectItem value="weekend">Weekend</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            );
          })()}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={2}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
