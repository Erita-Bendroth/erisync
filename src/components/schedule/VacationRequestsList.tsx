import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, CheckCircle2, XCircle, Loader2, User } from 'lucide-react';
import { format } from 'date-fns';

interface VacationRequest {
  id: string;
  user_id: string;
  team_id: string;
  requested_date: string;
  is_full_day: boolean;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  requester: {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  team: {
    name: string;
  };
}

interface VacationRequestsListProps {
  isPlanner: boolean;
  onRequestProcessed?: () => void;
}

export const VacationRequestsList: React.FC<VacationRequestsListProps> = ({
  isPlanner,
  onRequestProcessed,
}) => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchRequests();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('vacation-requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vacation_requests',
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('vacation_requests')
        .select('*')
        .order('created_at', { ascending: false });

      // If not a planner, only show own requests
      if (!isPlanner) {
        query = query.eq('user_id', user.id);
      }

      const { data: requestsData, error } = await query;
      if (error) throw error;

      if (!requestsData || requestsData.length === 0) {
        setRequests([]);
        return;
      }

      // Fetch related profiles and teams
      const userIds = [...new Set(requestsData.map(r => r.user_id))];
      const teamIds = [...new Set(requestsData.map(r => r.team_id))];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds);

      const { data: teams } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);

      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const teamsMap = new Map(teams?.map(t => [t.id, t]) || []);

      const enrichedRequests = requestsData.map(req => ({
        ...req,
        requester: profilesMap.get(req.user_id) || { user_id: req.user_id, first_name: '', last_name: '', email: '' },
        team: teamsMap.get(req.team_id) || { name: '' },
      }));

      setRequests(enrichedRequests as VacationRequest[]);
    } catch (error: any) {
      console.error('Error fetching vacation requests:', error);
      toast({
        title: "Error",
        description: "Failed to load vacation requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: VacationRequest) => {
    setProcessingId(request.id);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update request status
      const { error: updateError } = await supabase
        .from('vacation_requests')
        .update({
          status: 'approved',
          approver_id: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // Create schedule entry for the vacation
      const { error: scheduleError } = await supabase
        .from('schedule_entries')
        .insert({
          user_id: request.user_id,
          team_id: request.team_id,
          date: request.requested_date,
          activity_type: 'vacation',
          availability_status: 'unavailable',
          shift_type: 'normal',
          notes: `Vacation - ${request.is_full_day ? 'Full Day' : `${request.start_time} - ${request.end_time}`}${request.notes ? ` | ${request.notes}` : ''}`,
          created_by: user.id,
        });

      if (scheduleError) {
        console.error('Failed to create schedule entry:', scheduleError);
        // Don't fail the approval if schedule creation fails
      }

      // Send notification
      await supabase.functions.invoke('vacation-request-notification', {
        body: {
          requestId: request.id,
          type: 'approval',
        },
      });

      toast({
        title: "Request approved",
        description: "Vacation has been approved and added to the schedule.",
      });

      onRequestProcessed?.();
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for rejection.",
        variant: "destructive",
      });
      return;
    }

    setProcessingId(selectedRequest.id);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: updateError } = await supabase
        .from('vacation_requests')
        .update({
          status: 'rejected',
          approver_id: user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason.trim(),
        })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      // Send notification
      await supabase.functions.invoke('vacation-request-notification', {
        body: {
          requestId: selectedRequest.id,
          type: 'rejection',
        },
      });

      toast({
        title: "Request rejected",
        description: "The employee has been notified.",
      });

      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason('');
      onRequestProcessed?.();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectDialog = (request: VacationRequest) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  const renderRequest = (request: VacationRequest) => {
    const dateStr = format(new Date(request.requested_date), 'EEEE, MMMM d, yyyy');
    const timeStr = request.is_full_day
      ? 'Full Day'
      : `${request.start_time} - ${request.end_time}`;

    return (
      <Card key={request.id} className="mb-3">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              {isPlanner && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {request.requester.first_name} {request.requester.last_name}
                  </span>
                  <span className="text-muted-foreground">• {request.team.name}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{dateStr}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{timeStr}</span>
              </div>

              {request.notes && (
                <p className="text-sm text-muted-foreground italic">{request.notes}</p>
              )}

              {request.rejection_reason && (
                <div className="mt-2 p-2 bg-destructive/10 rounded-md">
                  <p className="text-sm text-destructive">
                    <strong>Rejection reason:</strong> {request.rejection_reason}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <Badge
                variant={
                  request.status === 'approved'
                    ? 'default'
                    : request.status === 'rejected'
                    ? 'destructive'
                    : 'secondary'
                }
              >
                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
              </Badge>

              {isPlanner && request.status === 'pending' && (
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleApprove(request)}
                    disabled={processingId === request.id}
                  >
                    {processingId === request.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => openRejectDialog(request)}
                    disabled={processingId === request.id}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const approvedRequests = requests.filter((r) => r.status === 'approved');
  const rejectedRequests = requests.filter((r) => r.status === 'rejected');

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Vacation Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">
                Pending ({pendingRequests.length})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({approvedRequests.length})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected ({rejectedRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              {pendingRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No pending requests
                </p>
              ) : (
                pendingRequests.map(renderRequest)
              )}
            </TabsContent>

            <TabsContent value="approved" className="mt-4">
              {approvedRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No approved requests
                </p>
              ) : (
                approvedRequests.map(renderRequest)
              )}
            </TabsContent>

            <TabsContent value="rejected" className="mt-4">
              {rejectedRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No rejected requests
                </p>
              ) : (
                rejectedRequests.map(renderRequest)
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Vacation Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Reason *</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explain why this request cannot be approved..."
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setSelectedRequest(null);
                setRejectionReason('');
              }}
              disabled={processingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processingId !== null || !rejectionReason.trim()}
            >
              {processingId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
