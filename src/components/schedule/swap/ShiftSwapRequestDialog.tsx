import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateSwapRequest } from '@/lib/swapValidation';
import { ArrowLeftRight, Loader2 } from 'lucide-react';

interface ShiftSwapRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestingUserId: string;
  requestingEntryId: string;
  targetUserId: string;
  targetUserName: string;
  targetEntryId: string;
  swapDate: string;
  teamId: string;
}

export function ShiftSwapRequestDialog({
  open,
  onOpenChange,
  requestingUserId,
  requestingEntryId,
  targetUserId,
  targetUserName,
  targetEntryId,
  swapDate,
  teamId
}: ShiftSwapRequestDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestingShift, setRequestingShift] = useState<any>(null);
  const [targetShift, setTargetShift] = useState<any>(null);
  const [requestingTeam, setRequestingTeam] = useState<any>(null);
  const [targetTeam, setTargetTeam] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchShiftDetails();
    }
  }, [open, requestingEntryId, targetEntryId]);

  const fetchShiftDetails = async () => {
    const { data, error } = await supabase
      .from('schedule_entries')
      .select('id, shift_type, activity_type, team_id, teams(name)')
      .in('id', [requestingEntryId, targetEntryId]);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch shift details',
        variant: 'destructive'
      });
      return;
    }

    if (data) {
      const reqShift = data.find(e => e.id === requestingEntryId);
      const tgtShift = data.find(e => e.id === targetEntryId);
      
      setRequestingShift(reqShift);
      setTargetShift(tgtShift);
      setRequestingTeam(reqShift?.teams);
      setTargetTeam(tgtShift?.teams);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Validate the swap request
      const validation = await validateSwapRequest(
        requestingUserId,
        requestingEntryId,
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
          requesting_entry_id: requestingEntryId,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Request Shift Swap</DialogTitle>
          <DialogDescription>
            Request to swap shifts with {targetUserName} on {new Date(swapDate).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
            <div className="space-y-1 p-3 rounded-lg border bg-muted/50">
              <p className="text-xs text-muted-foreground">Your Shift</p>
              {requestingTeam && (
                <p className="text-xs text-muted-foreground">Team: {requestingTeam.name}</p>
              )}
              <p className="font-medium">{requestingShift ? getShiftLabel(requestingShift.shift_type) : 'Loading...'}</p>
            </div>
            
            <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
            
            <div className="space-y-1 p-3 rounded-lg border bg-muted/50">
              <p className="text-xs text-muted-foreground">{targetUserName}'s Shift</p>
              {targetTeam && (
                <p className="text-xs text-muted-foreground">Team: {targetTeam.name}</p>
              )}
              <p className="font-medium">{targetShift ? getShiftLabel(targetShift.shift_type) : 'Loading...'}</p>
            </div>
          </div>

          {requestingShift && targetShift && requestingShift.team_id !== targetShift.team_id && (
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
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
