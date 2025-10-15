import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TimeSelect } from '@/components/ui/time-select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar, Clock, AlertCircle, Info } from 'lucide-react';

interface VacationRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestSubmitted: () => void;
}

export const VacationRequestModal: React.FC<VacationRequestModalProps> = ({
  open,
  onOpenChange,
  onRequestSubmitted,
}) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [isFullDay, setIsFullDay] = useState(true);
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('16:30');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    if (!selectedDate) {
      toast({
        title: "Date required",
        description: "Please select a date for your vacation request.",
        variant: "destructive",
      });
      return;
    }

    if (!isFullDay && (!startTime || !endTime)) {
      toast({
        title: "Time required",
        description: "Please select start and end times for partial day vacation.",
        variant: "destructive",
      });
      return;
    }

    if (!isFullDay && startTime >= endTime) {
      toast({
        title: "Invalid time range",
        description: "End time must be after start time.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get user's team
      const { data: teamMember, error: teamError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single();

      if (teamError || !teamMember) {
        throw new Error("Unable to find your team assignment");
      }

      // Check for overlapping requests
      const { data: hasOverlap, error: overlapError } = await supabase
        .rpc('check_vacation_overlap', {
          _user_id: user.id,
          _requested_date: selectedDate.toISOString().split('T')[0],
          _start_time: isFullDay ? null : startTime,
          _end_time: isFullDay ? null : endTime,
          _is_full_day: isFullDay,
        });

      if (overlapError) throw overlapError;

      if (hasOverlap) {
        toast({
          title: "Overlapping request",
          description: "You already have a vacation request for this date/time.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Create the vacation request
      const { data: request, error: insertError } = await supabase
        .from('vacation_requests')
        .insert({
          user_id: user.id,
          team_id: teamMember.team_id,
          requested_date: selectedDate.toISOString().split('T')[0],
          is_full_day: isFullDay,
          start_time: isFullDay ? null : startTime,
          end_time: isFullDay ? null : endTime,
          notes: notes.trim() || null,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Send notification to approver
      const { error: notificationError } = await supabase.functions.invoke(
        'vacation-request-notification',
        {
          body: {
            requestId: request.id,
            type: 'request',
          },
        }
      );

      if (notificationError) {
        console.error('Failed to send notification:', notificationError);
        // Don't fail the whole request if notification fails
      }

      toast({
        title: "Request submitted",
        description: "Your vacation request has been submitted for approval.",
      });

      // Reset form
      setSelectedDate(undefined);
      setIsFullDay(true);
      setStartTime('08:00');
      setEndTime('16:30');
      setNotes('');
      
      onRequestSubmitted();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error submitting vacation request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit vacation request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            Request Time Off
          </DialogTitle>
          <DialogDescription className="text-base">
            Submit your vacation request for manager approval. You'll receive an email notification once it's reviewed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Info Alert */}
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-sm text-blue-800 dark:text-blue-300">
              Your request will be sent to planners for approval. Your manager will be notified once approved.
            </AlertDescription>
          </Alert>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Vacation Date *
            </Label>
            <DatePicker
              date={selectedDate}
              onDateChange={setSelectedDate}
              placeholder="Select your vacation date"
            />
          </div>

          {/* Full Day Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex-1">
              <Label htmlFor="full-day" className="text-base font-semibold cursor-pointer">
                Full Day Off
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Toggle off to select specific hours
              </p>
            </div>
            <Switch
              id="full-day"
              checked={isFullDay}
              onCheckedChange={setIsFullDay}
            />
          </div>

          {/* Time Selection (Partial Day) */}
          {!isFullDay && (
            <div className="space-y-4 p-4 rounded-lg border bg-background">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Time Range
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Start Time</Label>
                  <TimeSelect
                    value={startTime}
                    onValueChange={setStartTime}
                    placeholder="From"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">End Time</Label>
                  <TimeSelect
                    value={endTime}
                    onValueChange={setEndTime}
                    placeholder="To"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-base font-semibold">
              Additional Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add context for your request (e.g., medical appointment, family event)..."
              className="resize-none min-h-[100px]"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !selectedDate}
            className="w-full sm:w-auto gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
