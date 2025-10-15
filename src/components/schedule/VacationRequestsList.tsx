import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Calendar, Clock, CheckCircle2, XCircle, Loader2, User, FileText, AlertCircle } from 'lucide-react';
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

      // Delete any existing schedule entries for this date
      const { error: deleteError } = await supabase
        .from('schedule_entries')
        .delete()
        .eq('user_id', request.user_id)
        .eq('team_id', request.team_id)
        .eq('date', request.requested_date);

      if (deleteError) {
        console.error('Failed to delete existing schedule entries:', deleteError);
        // Continue with approval even if delete fails
      }

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

      if (scheduleError) throw scheduleError;

      // Send notifications (to requester and manager)
      await supabase.functions.invoke('vacation-request-notification', {
        body: {
          requestId: request.id,
          type: 'approval',
        },
      });

      toast({
        title: "Request approved",
        description: "Vacation has been approved, added to the schedule, and notifications sent.",
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

    const statusConfig = {
      pending: { variant: 'secondary' as const, icon: Clock, color: 'text-yellow-600 dark:text-yellow-400' },
      approved: { variant: 'default' as const, icon: CheckCircle2, color: 'text-green-600 dark:text-green-400' },
      rejected: { variant: 'destructive' as const, icon: XCircle, color: 'text-red-600 dark:text-red-400' },
    };

    const config = statusConfig[request.status as keyof typeof statusConfig] || statusConfig.pending;
    const StatusIcon = config.icon;

    return (
      <Card key={request.id} className="mb-3 hover:shadow-md transition-shadow">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {isPlanner && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-full bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <span className="font-semibold text-base">
                        {request.requester.first_name} {request.requester.last_name}
                      </span>
                      <span className="text-sm text-muted-foreground ml-2">• {request.team.name}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium">{dateStr}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className={request.is_full_day ? "font-medium" : ""}>{timeStr}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                <Badge variant={config.variant} className="gap-1.5 px-3 py-1">
                  <StatusIcon className="h-3.5 w-3.5" />
                  {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                </Badge>

                {isPlanner && request.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(request)}
                      disabled={processingId === request.id}
                      className="gap-1.5"
                    >
                      {processingId === request.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openRejectDialog(request)}
                      disabled={processingId === request.id}
                      className="gap-1.5"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {request.notes && (
              <>
                <Separator />
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Notes</p>
                    <p className="text-sm text-muted-foreground italic">{request.notes}</p>
                  </div>
                </div>
              </>
            )}

            {/* Rejection Reason */}
            {request.rejection_reason && (
              <>
                <Separator />
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive mb-1">Rejection Reason</p>
                    <p className="text-sm text-destructive/90">{request.rejection_reason}</p>
                  </div>
                </div>
              </>
            )}
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
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            Vacation Requests
          </CardTitle>
          <CardDescription>
            {isPlanner 
              ? 'Review and manage vacation requests from your team members'
              : 'Track the status of your vacation requests'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="h-4 w-4" />
                Pending
                {pendingRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-5 min-w-[20px]">
                    {pendingRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Approved
                {approvedRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-5 min-w-[20px]">
                    {approvedRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="rejected" className="gap-2">
                <XCircle className="h-4 w-4" />
                Rejected
                {rejectedRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-5 min-w-[20px]">
                    {rejectedRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-0">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Clock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No pending requests</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isPlanner ? 'All requests have been reviewed' : 'You have no pending requests'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map(renderRequest)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="approved" className="mt-0">
              {approvedRequests.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-muted-foreground font-medium">No approved requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {approvedRequests.map(renderRequest)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rejected" className="mt-0">
              {rejectedRequests.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center mb-4">
                    <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <p className="text-muted-foreground font-medium">No rejected requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rejectedRequests.map(renderRequest)}
                </div>
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
