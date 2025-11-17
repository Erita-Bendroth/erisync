import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateSwapRequest } from '@/lib/swapValidation';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface ShiftSwapRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestingUserId: string;
  targetUserId: string;
  targetUserName: string;
  targetEntryId: string;
  swapDate: string;
  teamId: string;
}

interface UserShift {
  id: string;
  date: string;
  shift_type: string | null;
  team_id: string;
  teams: { name: string } | null;
}

export function ShiftSwapRequestDialog({
  open,
  onOpenChange,
  requestingUserId,
  targetUserId,
  targetUserName,
  targetEntryId,
  swapDate,
  teamId
}: ShiftSwapRequestDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [userShifts, setUserShifts] = useState<UserShift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [targetShift, setTargetShift] = useState<any>(null);
  const [targetTeam, setTargetTeam] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchTargetShift();
      fetchUserShifts();
    }
  }, [open, targetEntryId, requestingUserId]);

  const fetchTargetShift = async () => {
    const { data, error } = await supabase
      .from('schedule_entries')
      .select('id, date, shift_type, activity_type, team_id, teams(name)')
      .eq('id', targetEntryId)
      .single();

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch shift details',
        variant: 'destructive'
      });
      return;
    }

    setTargetShift(data);
    setTargetTeam(data?.teams);
  };

  const fetchUserShifts = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('schedule_entries')
      .select('id, date, shift_type, team_id, teams(name)')
      .eq('user_id', requestingUserId)
      .eq('activity_type', 'work')
      .eq('availability_status', 'available')
      .gte('date', today.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch your shifts',
        variant: 'destructive'
      });
      return;
    }

    setUserShifts(data || []);
    
    // Auto-select first shift if available
    if (data && data.length > 0) {
      setSelectedShiftId(data[0].id);
    }
  };

  const handleSubmit = async () => {
    if (!selectedShiftId) {
      toast({
        title: 'No Shift Selected',
        description: 'Please select one of your shifts to offer in exchange',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Validate the swap request
      const validation = await validateSwapRequest(
        requestingUserId,
        selectedShiftId,
        targetUserId,
        targetEntryId,
        new Date(swapDate),
        teamId
      );

      if (!validation.valid) {
        toast({
          title: 'Invalid Swap Request',
          description: validation.error,
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // Create the swap request
      const { error } = await supabase
        .from('shift_swap_requests')
        .insert({
          requesting_user_id: requestingUserId,
          requesting_entry_id: selectedShiftId,
          target_user_id: targetUserId,
          target_entry_id: targetEntryId,
          swap_date: swapDate,
          team_id: teamId,
          reason: reason.trim() || null,
          status: 'pending'
        });

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to create swap request',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // Call notification edge function
      await supabase.functions.invoke('send-swap-notification', {
        body: {
          type: 'request_created',
          requesting_user_id: requestingUserId,
          target_user_id: targetUserId,
          swap_date: swapDate,
          team_id: teamId
        }
      });

      toast({
        title: 'Swap Request Sent',
        description: `Your swap request has been sent to ${targetUserName} and your manager`
      });

      setReason('');
      setSelectedShiftId('');
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getShiftLabel = (shiftType: string | null) => {
    if (!shiftType) return 'Normal Shift';
    const labels: Record<string, string> = {
      early: 'Early Shift',
      late: 'Late Shift',
      normal: 'Normal Shift',
      weekend: 'Weekend Shift'
    };
    return labels[shiftType] || 'Normal Shift';
  };

  const formatShiftOption = (shift: UserShift) => {
    const date = new Date(shift.date);
    const dateStr = format(date, 'EEE, MMM d, yyyy');
    const shiftLabel = getShiftLabel(shift.shift_type);
    const teamName = shift.teams?.name || 'Unknown Team';
    return `${dateStr} - ${shiftLabel} (${teamName})`;
  };

  const selectedShift = userShifts.find(s => s.id === selectedShiftId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Request Shift Swap</DialogTitle>
          <DialogDescription>
            Choose which of your shifts to offer in exchange for {targetUserName}'s shift
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Target Shift (What you want) */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Shift You Want</Label>
            <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">{targetUserName}'s Shift</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">Date:</span>{' '}
                  {targetShift && format(new Date(targetShift.date), 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Shift:</span>{' '}
                  {targetShift && getShiftLabel(targetShift.shift_type)}
                </p>
                {targetTeam && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Team:</span> {targetTeam.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowLeftRight className="h-6 w-6 text-muted-foreground" />
          </div>

          {/* Your Shift (What you offer) */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Your Shift to Offer</Label>
            {userShifts.length > 0 ? (
              <>
                <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select one of your shifts..." />
                  </SelectTrigger>
                  <SelectContent>
                    {userShifts.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id}>
                        {formatShiftOption(shift)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedShift && (
                  <div className="p-3 rounded-lg border bg-muted/50 text-sm">
                    <p>
                      <span className="text-muted-foreground">Selected:</span>{' '}
                      {format(new Date(selectedShift.date), 'EEEE, MMMM d')} -{' '}
                      {getShiftLabel(selectedShift.shift_type)}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 rounded-lg border bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground">
                  You don't have any available shifts to offer in exchange.
                </p>
              </div>
            )}
          </div>

          {selectedShift && targetShift && selectedShift.team_id !== targetShift.team_id && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
              <p className="text-sm text-foreground">
                This is a cross-team swap within your planning partnership. Your manager will review this request.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              placeholder="Explain why you'd like to swap shifts..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !selectedShiftId || userShifts.length === 0}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
