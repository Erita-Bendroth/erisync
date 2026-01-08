import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { validateSwapApproval } from '@/lib/swapValidation';
import { ArrowLeftRight, CheckCircle, XCircle, Loader2, Clock, AlertTriangle, Filter } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { CoverageImpactPreview } from './CoverageImpactPreview';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BulkActionBar } from '@/components/shared/BulkActionBar';
import { ManagerDirectSwapDialog } from './ManagerDirectSwapDialog';

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
  requesting_entry: { shift_type: string; team_id: string; teams: { name: string } };
  target_entry: { shift_type: string; team_id: string; teams: { name: string } };
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
  const [selectedSwapIds, setSelectedSwapIds] = useState<Set<string>>(new Set());
  const [bulkApproveDialogOpen, setBulkApproveDialogOpen] = useState(false);
  const [bulkRejectDialogOpen, setBulkRejectDialogOpen] = useState(false);
  const [bulkNotes, setBulkNotes] = useState('');
  const [directSwapDialogOpen, setDirectSwapDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'same-day' | 'cross-date' | 'cross-team'>('all');
  const [sortBy, setSortBy] = useState<'created' | 'swap-date'>('swap-date');
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
        requesting_entry:schedule_entries!shift_swap_requests_requesting_entry_id_fkey(shift_type, team_id, teams(name)),
        target_entry:schedule_entries!shift_swap_requests_target_entry_id_fkey(shift_type, team_id, teams(name))
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

  const handleBulkApprove = async () => {
    const requestsToApprove = swapRequests.filter(r => selectedSwapIds.has(r.id));
    if (requestsToApprove.length === 0) return;

    setProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const request of requestsToApprove) {
      try {
        const validation = await validateSwapApproval(request.id);
        if (!validation.valid) {
          errorCount++;
          continue;
        }

        await supabase
          .from('shift_swap_requests')
          .update({
            status: 'approved',
            reviewed_by: user?.id,
            reviewed_at: new Date().toISOString(),
            review_notes: bulkNotes.trim() || null
          })
          .eq('id', request.id);

        const { data: entries } = await supabase
          .from('schedule_entries')
          .select('id, shift_type')
          .in('id', [request.requesting_entry_id, request.target_entry_id]);

        if (entries && entries.length === 2) {
          const requestingEntry = entries.find(e => e.id === request.requesting_entry_id);
          const targetEntry = entries.find(e => e.id === request.target_entry_id);

          await supabase
            .from('schedule_entries')
            .update({ 
              shift_type: targetEntry?.shift_type,
              notes: `Shift swapped via approved request on ${format(new Date(), 'MMM d, yyyy')}`
            })
            .eq('id', request.requesting_entry_id);

          await supabase
            .from('schedule_entries')
            .update({ 
              shift_type: requestingEntry?.shift_type,
              notes: `Shift swapped via approved request on ${format(new Date(), 'MMM d, yyyy')}`
            })
            .eq('id', request.target_entry_id);
        }

        await supabase.functions.invoke('send-swap-notification', {
          body: {
            type: 'request_approved',
            requesting_user_id: request.requesting_user_id,
            target_user_id: request.target_user_id,
            swap_date: request.swap_date,
            team_id: request.team_id,
            review_notes: bulkNotes.trim() || null
          }
        });

        successCount++;
      } catch (error) {
        console.error('Error approving swap:', error);
        errorCount++;
      }
    }

    setProcessing(false);
    setBulkApproveDialogOpen(false);
    setBulkNotes('');
    setSelectedSwapIds(new Set());

    toast({
      title: successCount > 0 ? 'Bulk approval complete' : 'Bulk approval failed',
      description: `${successCount} approved, ${errorCount} failed`,
      variant: errorCount > 0 ? 'destructive' : 'default',
    });

    fetchPendingSwaps();
  };

  const handleBulkReject = async () => {
    if (!bulkNotes.trim()) {
      toast({
        title: 'Notes required',
        description: 'Please provide a reason for bulk rejection',
        variant: 'destructive'
      });
      return;
    }

    const requestsToReject = swapRequests.filter(r => selectedSwapIds.has(r.id));
    if (requestsToReject.length === 0) return;

    setProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const request of requestsToReject) {
      try {
        await supabase
          .from('shift_swap_requests')
          .update({
            status: 'rejected',
            reviewed_by: user?.id,
            reviewed_at: new Date().toISOString(),
            review_notes: bulkNotes.trim()
          })
          .eq('id', request.id);

        await supabase.functions.invoke('send-swap-notification', {
          body: {
            type: 'request_rejected',
            requesting_user_id: request.requesting_user_id,
            target_user_id: request.target_user_id,
            swap_date: request.swap_date,
            team_id: request.team_id,
            review_notes: bulkNotes.trim()
          }
        });

        successCount++;
      } catch (error) {
        console.error('Error rejecting swap:', error);
        errorCount++;
      }
    }

    setProcessing(false);
    setBulkRejectDialogOpen(false);
    setBulkNotes('');
    setSelectedSwapIds(new Set());

    toast({
      title: successCount > 0 ? 'Bulk rejection complete' : 'Bulk rejection failed',
      description: `${successCount} rejected, ${errorCount} failed`,
      variant: errorCount > 0 ? 'destructive' : 'default',
    });

    fetchPendingSwaps();
  };

  const toggleSwapSelection = (swapId: string) => {
    const newSelection = new Set(selectedSwapIds);
    if (newSelection.has(swapId)) {
      newSelection.delete(swapId);
    } else {
      newSelection.add(swapId);
    }
    setSelectedSwapIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedSwapIds.size === swapRequests.length) {
      setSelectedSwapIds(new Set());
    } else {
      setSelectedSwapIds(new Set(swapRequests.map(r => r.id)));
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

  // Filter and sort logic
  const filteredRequests = swapRequests.filter(request => {
    if (filterType === 'all') return true;
    const isCrossTeam = request.requesting_entry.team_id !== request.target_entry.team_id;
    if (filterType === 'cross-team') return isCrossTeam;
    // For same-day vs cross-date, we'd need requesting entry date which isn't in our current query
    return true;
  }).sort((a, b) => {
    if (sortBy === 'swap-date') {
      return new Date(a.swap_date).getTime() - new Date(b.swap_date).getTime();
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <>
      <div className="space-y-4">
        {/* Header with Direct Swap and Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Requests</SelectItem>
                <SelectItem value="cross-team">Cross-team</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="swap-date">Soonest First</SelectItem>
                <SelectItem value="created">Newest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setDirectSwapDialogOpen(true)}>
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Direct Swap
          </Button>
        </div>

        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-8 text-center">
              <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No pending swap requests</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Select All Header */}
            {filteredRequests.length > 1 && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Checkbox
                  checked={selectedSwapIds.size === filteredRequests.length}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium">
                  Select All ({selectedSwapIds.size}/{filteredRequests.length})
                </span>
              </div>
            )}

            {filteredRequests.map(request => {
              const isCrossTeam = request.requesting_entry.team_id !== request.target_entry.team_id;
              const isSelected = selectedSwapIds.has(request.id);
              const daysUntilSwap = differenceInDays(new Date(request.swap_date), new Date());
              const isUrgent = daysUntilSwap <= 2 && daysUntilSwap >= 0;
              
              return (
              <Card key={request.id} className={isSelected ? 'border-primary' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-3 flex-1">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSwapSelection(request.id)}
                      />
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        <span>{request.requesting_user.first_name} {request.requesting_user.last_name}</span>
                        <span className="text-xs text-muted-foreground">({request.requesting_entry.teams?.name})</span>
                        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                        <span>{request.target_user.first_name} {request.target_user.last_name}</span>
                        <span className="text-xs text-muted-foreground">({request.target_entry.teams?.name})</span>
                        {isCrossTeam && (
                          <Badge variant="outline" className="text-xs ml-2 bg-purple-500/10 text-purple-600 border-purple-200">
                            Cross-team
                          </Badge>
                        )}
                        {isUrgent && (
                          <Badge variant="outline" className="text-xs ml-1 bg-orange-500/10 text-orange-600 border-orange-200">
                            <Clock className="h-3 w-3 mr-1" />
                            {daysUntilSwap === 0 ? 'Today' : daysUntilSwap === 1 ? 'Tomorrow' : `${daysUntilSwap} days`}
                          </Badge>
                        )}
                      </CardTitle>
                    </div>
                  </div>
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
              );
            })}
          </>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedSwapIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedSwapIds.size}
          onApprove={() => setBulkApproveDialogOpen(true)}
          onReject={() => setBulkRejectDialogOpen(true)}
          onClear={() => setSelectedSwapIds(new Set())}
          approveLabel="Approve Selected"
          rejectLabel="Reject Selected"
          isProcessing={processing}
        />
      )}

      {/* Bulk Approve Dialog */}
      <Dialog open={bulkApproveDialogOpen} onOpenChange={setBulkApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {selectedSwapIds.size} Swap Requests</DialogTitle>
            <DialogDescription>
              This will approve all selected swap requests and update the schedules accordingly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-approve-notes">Notes (Optional)</Label>
              <Textarea
                id="bulk-approve-notes"
                placeholder="Add any notes about these approvals..."
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkApproveDialogOpen(false)} disabled={processing}>
              Cancel
            </Button>
            <Button onClick={handleBulkApprove} disabled={processing}>
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve {selectedSwapIds.size} Requests
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Reject Dialog */}
      <Dialog open={bulkRejectDialogOpen} onOpenChange={setBulkRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {selectedSwapIds.size} Swap Requests</DialogTitle>
            <DialogDescription>
              This will reject all selected swap requests. Please provide a reason.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-reject-notes">Rejection Reason (Required)</Label>
              <Textarea
                id="bulk-reject-notes"
                placeholder="Explain why these requests are being rejected..."
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRejectDialogOpen(false)} disabled={processing}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkReject}
              disabled={processing || !bulkNotes.trim()}
            >
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject {selectedSwapIds.size} Requests
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Manager Direct Swap Dialog */}
      <ManagerDirectSwapDialog
        open={directSwapDialogOpen}
        onOpenChange={setDirectSwapDialogOpen}
        onSuccess={fetchPendingSwaps}
      />
    </>
  );
}
