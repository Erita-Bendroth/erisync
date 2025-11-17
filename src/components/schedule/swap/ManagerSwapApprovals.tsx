import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { validateSwapApproval } from '@/lib/swapValidation';
import { ArrowLeftRight, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SwapRequest {
  id: string;
  requesting_user_id: string;
  target_user_id: string;
  requesting_entry_id: string;
  target_entry_id: string;
  swap_date: string;
  reason: string | null;
  created_at: string;
  team_id: string;
  requesting_user: { first_name: string; last_name: string };
  target_user: { first_name: string; last_name: string };
  requesting_entry: { shift_type: string };
  target_entry: { shift_type: string };
}

export function ManagerSwapApprovals() {
  const { user } = useAuth();
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SwapRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchPendingSwaps();
    }
  }, [user]);

  const fetchPendingSwaps = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('shift_swap_requests')
      .select(`
        *,
        requesting_user:profiles!shift_swap_requests_requesting_user_id_fkey(first_name, last_name),
        target_user:profiles!shift_swap_requests_target_user_id_fkey(first_name, last_name),
        requesting_entry:schedule_entries!shift_swap_requests_requesting_entry_id_fkey(shift_type),
        target_entry:schedule_entries!shift_swap_requests_target_entry_id_fkey(shift_type)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching swap requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load swap requests',
        variant: 'destructive'
      });
    } else {
      setSwapRequests(data || []);
    }
    setLoading(false);
  };

  const openReviewDialog = (request: SwapRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setReviewAction(action);
    setReviewNotes('');
    setReviewDialogOpen(true);
  };

  const handleReview = async () => {
    if (!selectedRequest || !user) return;

    setProcessing(true);
    try {
      // Validate the swap can still be approved
      const validation = await validateSwapApproval(selectedRequest.id);
      if (!validation.valid) {
        toast({
          title: 'Cannot Process Swap',
          description: validation.error,
          variant: 'destructive'
        });
        setProcessing(false);
        return;
      }

      if (reviewAction === 'approve') {
        // Update swap request status
        const { error: updateError } = await supabase
          .from('shift_swap_requests')
          .update({
            status: 'approved',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            review_notes: reviewNotes.trim() || null
          })
          .eq('id', selectedRequest.id);

        if (updateError) throw updateError;

        // Swap the shifts
        const { data: entries } = await supabase
          .from('schedule_entries')
          .select('id, shift_type')
          .in('id', [selectedRequest.requesting_entry_id, selectedRequest.target_entry_id]);

        if (entries && entries.length === 2) {
          const requestingEntry = entries.find(e => e.id === selectedRequest.requesting_entry_id);
          const targetEntry = entries.find(e => e.id === selectedRequest.target_entry_id);

          // Swap shift types
          await supabase
            .from('schedule_entries')
            .update({ 
              shift_type: targetEntry?.shift_type,
              notes: `Shift swapped via approved request on ${format(new Date(), 'MMM d, yyyy')}`
            })
            .eq('id', selectedRequest.requesting_entry_id);

          await supabase
            .from('schedule_entries')
            .update({ 
              shift_type: requestingEntry?.shift_type,
              notes: `Shift swapped via approved request on ${format(new Date(), 'MMM d, yyyy')}`
            })
            .eq('id', selectedRequest.target_entry_id);
        }

        toast({
          title: 'Swap Approved',
          description: 'The shift swap has been approved and schedules updated'
        });
      } else {
        // Reject the swap
        const { error: updateError } = await supabase
          .from('shift_swap_requests')
          .update({
            status: 'rejected',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            review_notes: reviewNotes.trim() || null
          })
          .eq('id', selectedRequest.id);

        if (updateError) throw updateError;

        toast({
          title: 'Swap Rejected',
          description: 'The shift swap request has been rejected'
        });
      }

      // Send notification
      await supabase.functions.invoke('send-swap-notification', {
        body: {
          type: reviewAction === 'approve' ? 'request_approved' : 'request_rejected',
          requesting_user_id: selectedRequest.requesting_user_id,
          target_user_id: selectedRequest.target_user_id,
          swap_date: selectedRequest.swap_date,
          team_id: selectedRequest.team_id,
          review_notes: reviewNotes.trim() || null
        }
      });

      setReviewDialogOpen(false);
      fetchPendingSwaps();
    } catch (error) {
      console.error('Error processing swap:', error);
      toast({
        title: 'Error',
        description: 'Failed to process swap request',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const getShiftLabel = (shiftType: string | null) => {
    if (!shiftType) return 'Normal';
    const labels: Record<string, string> = {
      early: 'Early',
      late: 'Late',
      normal: 'Normal',
      weekend: 'Weekend'
    };
    return labels[shiftType] || 'Normal';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {swapRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-8 text-center">
              <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No pending swap requests</p>
            </CardContent>
          </Card>
        ) : (
          swapRequests.map(request => (
            <Card key={request.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {request.requesting_user.first_name} {request.requesting_user.last_name} ↔️{' '}
                  {request.target_user.first_name} {request.target_user.last_name}
                </CardTitle>
                <CardDescription>
                  {format(new Date(request.swap_date), 'EEEE, MMMM d, yyyy')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex-1 p-2 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground">
                      {request.requesting_user.first_name}'s Shift
                    </p>
                    <p className="font-medium">{getShiftLabel(request.requesting_entry.shift_type)}</p>
                  </div>
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 p-2 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground">
                      {request.target_user.first_name}'s Shift
                    </p>
                    <p className="font-medium">{getShiftLabel(request.target_entry.shift_type)}</p>
                  </div>
                </div>

                {request.reason && (
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">Reason:</p>
                    <p className="text-sm">{request.reason}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={() => openReviewDialog(request, 'approve')}
                    className="flex-1"
                    size="sm"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => openReviewDialog(request, 'reject')}
                    variant="destructive"
                    className="flex-1"
                    size="sm"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Requested {format(new Date(request.created_at), 'MMM d, yyyy h:mm a')}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve' : 'Reject'} Swap Request
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <>
                  {reviewAction === 'approve'
                    ? 'This will swap the shifts and update both schedules.'
                    : 'This will reject the swap request.'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="review-notes">
                Notes {reviewAction === 'reject' ? '(Required)' : '(Optional)'}
              </Label>
              <Textarea
                id="review-notes"
                placeholder={
                  reviewAction === 'approve'
                    ? 'Add any notes about this approval...'
                    : 'Explain why this request is being rejected...'
                }
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)} disabled={processing}>
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={processing || (reviewAction === 'reject' && !reviewNotes.trim())}
              variant={reviewAction === 'approve' ? 'default' : 'destructive'}
            >
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {reviewAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
