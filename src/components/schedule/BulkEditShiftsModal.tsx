import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trash2 } from 'lucide-react';

interface BulkEditShiftsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedShiftIds: string[];
  onSuccess: () => void;
}

export const BulkEditShiftsModal = ({ open, onOpenChange, selectedShiftIds, onSuccess }: BulkEditShiftsModalProps) => {
  const { toast } = useToast();
  const [shiftType, setShiftType] = useState<string>('');
  const [activityType, setActivityType] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSubmit = async () => {
    if (!shiftType && !activityType) {
      toast({
        title: 'No Changes',
        description: 'Please select at least one field to update.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Build the update object with only selected fields
      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      if (shiftType) {
        updates.shift_type = shiftType;
      }

      if (activityType) {
        updates.activity_type = activityType;
        // Update availability based on activity type
        if (activityType === 'work') {
          updates.availability_status = 'available';
        } else {
          updates.availability_status = 'unavailable';
        }
      }

      // Update all selected shifts
      const { error } = await supabase
        .from('schedule_entries')
        .update(updates)
        .in('id', selectedShiftIds);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Updated ${selectedShiftIds.length} shift${selectedShiftIds.length !== 1 ? 's' : ''} successfully.`,
      });

      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setShiftType('');
      setActivityType('');
    } catch (error: any) {
      console.error('Error updating shifts:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update shifts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('schedule_entries')
        .delete()
        .in('id', selectedShiftIds);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Deleted ${selectedShiftIds.length} shift${selectedShiftIds.length !== 1 ? 's' : ''} successfully.`,
      });

      onSuccess();
      onOpenChange(false);
      setShowDeleteConfirm(false);
      
      // Reset form
      setShiftType('');
      setActivityType('');
    } catch (error: any) {
      console.error('Error deleting shifts:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete shifts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedShiftIds.length} shift{selectedShiftIds.length !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected shifts from the schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bulk Edit Shifts</DialogTitle>
          <DialogDescription>
            Update {selectedShiftIds.length} selected shift{selectedShiftIds.length !== 1 ? 's' : ''}. 
            Leave fields empty to keep existing values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="shift-type">Shift Type (optional)</Label>
            <Select value={shiftType} onValueChange={setShiftType}>
              <SelectTrigger id="shift-type">
                <SelectValue placeholder="Keep existing" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                <SelectItem value="normal">Normal Shift</SelectItem>
                <SelectItem value="early">Early Shift</SelectItem>
                <SelectItem value="late">Late Shift</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="activity-type">Activity Type (optional)</Label>
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger id="activity-type">
                <SelectValue placeholder="Keep existing" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                <SelectItem value="work">Work</SelectItem>
                <SelectItem value="vacation">Vacation</SelectItem>
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="working_from_home">Working from Home</SelectItem>
                <SelectItem value="hotline_support">Hotline Support</SelectItem>
                <SelectItem value="flextime">Flextime</SelectItem>
                <SelectItem value="out_of_office">Out of Office</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loading}
            className="mr-auto"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete All
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply to {selectedShiftIds.length} Shift{selectedShiftIds.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};
