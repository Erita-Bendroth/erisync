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
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Clock, CheckCircle2, XCircle, Loader2, User, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { formatUserName } from '@/lib/utils';

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
  request_group_id: string | null;
  selected_planner_id: string | null;
  approver_id: string | null;
  requester: {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    initials?: string;
  };
  team: {
    name: string;
  };
  approver?: {
    initials: string;
    first_name: string;
    last_name: string;
  };
}

interface GroupedRequest {
  id: string; // Primary request ID
  groupId: string | null;
  user_id: string;
  team_id: string;
  dates: string[]; // All dates in the group
  startDate: string;
  endDate: string;
  is_full_day: boolean;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  selected_planner_id: string | null;
  requester: {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  team: {
    name: string;
  };
  requestIds: string[]; // All request IDs in the group
  approver?: {
    initials: string;
    first_name: string;
    last_name: string;
  };
}

interface VacationRequestsListProps {
  isPlanner: boolean;
  onRequestProcessed?: () => void;
  onEditRequest?: (request: GroupedRequest) => void;
}

export const VacationRequestsList: React.FC<VacationRequestsListProps> = ({
  isPlanner,
  onRequestProcessed,
  onEditRequest,
}) => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [groupedRequests, setGroupedRequests] = useState<GroupedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<GroupedRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [bulkRejectDialogOpen, setBulkRejectDialogOpen] = useState(false);
  const [bulkRejectionReason, setBulkRejectionReason] = useState('');

  useEffect(() => {
    fetchCurrentUser();
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

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

    let query = supabase
      .from('vacation_requests')
      .select('*')
      .order('created_at', { ascending: false });

    // Different filters based on role
    if (isPlanner) {
      // Planners see all requests (no filter)
    } else {
      // Check if user is a manager
      const { data: managerTeams } = await supabase
        .rpc('get_manager_accessible_teams', { _manager_id: user.id });
      
      if (managerTeams && managerTeams.length > 0) {
        // Managers see requests from their team members + their own requests
        query = query.or(`user_id.eq.${user.id},team_id.in.(${managerTeams.join(',')})`);
      } else {
        // Regular users only see their own requests
        query = query.eq('user_id', user.id);
      }
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
      const approverIds = [...new Set(requestsData.map(r => r.approver_id).filter(Boolean))];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, initials')
        .in('user_id', userIds) as any;

      const { data: approverProfiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, initials')
        .in('user_id', approverIds) as any;

      const { data: teams } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);

      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const approverMap = new Map(approverProfiles?.map(p => [p.user_id, p]) || []);
      const teamsMap = new Map(teams?.map(t => [t.id, t]) || []);

      const enrichedRequests = requestsData.map(req => ({
        ...req,
        requester: profilesMap.get(req.user_id) || { user_id: req.user_id, first_name: '', last_name: '', email: '', initials: '' },
        team: teamsMap.get(req.team_id) || { name: '' },
        approver: req.approver_id ? approverMap.get(req.approver_id) : undefined,
      }));

      setRequests(enrichedRequests as any);

      // Group requests by request_group_id
      const grouped: GroupedRequest[] = [];
      const processedGroups = new Set<string>();

      enrichedRequests.forEach((req: any) => {
        if (req.request_group_id && !processedGroups.has(req.request_group_id)) {
          // This is part of a multi-day request
          const groupRequests = enrichedRequests.filter(
            r => r.request_group_id === req.request_group_id
          );
          
          const sortedDates = groupRequests
            .map(r => r.requested_date)
            .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

          grouped.push({
            id: req.id,
            groupId: req.request_group_id,
            user_id: req.user_id,
            team_id: req.team_id,
            dates: sortedDates,
            startDate: sortedDates[0],
            endDate: sortedDates[sortedDates.length - 1],
            is_full_day: req.is_full_day,
            start_time: req.start_time,
            end_time: req.end_time,
            notes: req.notes,
            status: req.status,
            rejection_reason: req.rejection_reason,
            created_at: req.created_at,
            selected_planner_id: req.selected_planner_id,
            requester: req.requester,
            team: req.team,
            requestIds: groupRequests.map(r => r.id),
            approver: req.approver,
          });

          processedGroups.add(req.request_group_id);
        } else if (!req.request_group_id) {
          // Single-day request
          grouped.push({
            id: req.id,
            groupId: null,
            user_id: req.user_id,
            team_id: req.team_id,
            dates: [req.requested_date],
            startDate: req.requested_date,
            endDate: req.requested_date,
            is_full_day: req.is_full_day,
            start_time: req.start_time,
            end_time: req.end_time,
            notes: req.notes,
            status: req.status,
            rejection_reason: req.rejection_reason,
            created_at: req.created_at,
            selected_planner_id: req.selected_planner_id,
            requester: req.requester,
            team: req.team,
            requestIds: [req.id],
            approver: req.approver,
          });
        }
      });

      setGroupedRequests(grouped);
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

  const handleApprove = async (request: GroupedRequest) => {
    setProcessingId(request.id);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Delete any existing schedule entries for all dates in the group
      const { error: deleteError } = await supabase
        .from('schedule_entries')
        .delete()
        .eq('user_id', request.user_id)
        .eq('team_id', request.team_id)
        .in('date', request.dates);

      if (deleteError) {
        console.error('Failed to delete existing schedule entries:', deleteError);
        // Continue with approval even if delete fails
      }

      // Update all request statuses in the group
      const { error: updateError } = await supabase
        .from('vacation_requests')
        .update({
          status: 'approved',
          approver_id: user.id,
          approved_at: new Date().toISOString(),
        })
        .in('id', request.requestIds);

      if (updateError) throw updateError;

      // Create schedule entries for all vacation days
      const scheduleEntries = request.dates.map(date => ({
        user_id: request.user_id,
        team_id: request.team_id,
        date,
        activity_type: 'vacation' as const,
        availability_status: 'unavailable' as const,
        shift_type: 'normal' as const,
        notes: `Vacation - ${request.is_full_day ? 'Full Day' : `${request.start_time} - ${request.end_time}`}${request.notes ? ` | ${request.notes}` : ''}`,
        created_by: user.id,
      }));

      const { error: scheduleError } = await supabase
        .from('schedule_entries')
        .insert(scheduleEntries);

      if (scheduleError) throw scheduleError;

      // Send notifications (to requester and manager) - only once for the group
      await supabase.functions.invoke('vacation-request-notification', {
        body: {
          requestId: request.id,
          type: 'approval',
          groupId: request.groupId,
        },
      });

      const daysText = request.dates.length === 1 
        ? "1 day" 
        : `${request.dates.length} working days`;

      toast({
        title: "Request approved",
        description: `Vacation for ${daysText} has been approved, added to the schedule, and notifications sent.`,
      });

      await fetchRequests();
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

      // Update all request statuses in the group
      const { error: updateError } = await supabase
        .from('vacation_requests')
        .update({
          status: 'rejected',
          approver_id: user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason.trim(),
        })
        .in('id', selectedRequest.requestIds);

      if (updateError) throw updateError;

      // Send notification - only once for the group
      await supabase.functions.invoke('vacation-request-notification', {
        body: {
          requestId: selectedRequest.id,
          type: 'rejection',
          groupId: selectedRequest.groupId,
        },
      });

      toast({
        title: "Request rejected",
        description: "The employee has been notified.",
      });

      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason('');
      await fetchRequests();
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

  const openRejectDialog = (request: GroupedRequest) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  const openCancelDialog = (request: GroupedRequest) => {
    setSelectedRequest(request);
    setCancelDialogOpen(true);
  };

  const handleCancel = async () => {
    if (!selectedRequest) return;

    setProcessingId(selectedRequest.id);

    try {
      // Delete all requests in the group
      const { error } = await supabase
        .from('vacation_requests')
        .delete()
        .in('id', selectedRequest.requestIds);

      if (error) throw error;

      toast({
        title: "Request cancelled",
        description: "Your vacation request has been cancelled successfully.",
      });

      setCancelDialogOpen(false);
      setSelectedRequest(null);
      await fetchRequests();
      onRequestProcessed?.();
    } catch (error: any) {
      console.error('Error cancelling request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel request",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleEdit = (request: GroupedRequest) => {
    onEditRequest?.(request);
  };

  const toggleRequestSelection = (requestId: string) => {
    const newSelected = new Set(selectedRequestIds);
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId);
    } else {
      newSelected.add(requestId);
    }
    setSelectedRequestIds(newSelected);
  };

  const toggleSelectAll = (requests: GroupedRequest[]) => {
    if (selectedRequestIds.size === requests.length) {
      setSelectedRequestIds(new Set());
    } else {
      setSelectedRequestIds(new Set(requests.map(r => r.id)));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRequestIds.size === 0) return;

    const requestsToApprove = groupedRequests.filter(r => selectedRequestIds.has(r.id));
    let successCount = 0;
    let errorCount = 0;

    for (const request of requestsToApprove) {
      try {
        const { error: updateError } = await supabase
          .from('vacation_requests')
          .update({ 
            status: 'approved',
            approver_id: currentUserId 
          })
          .in('id', request.requestIds);

        if (updateError) throw updateError;

        // Create schedule entries for each date
        const scheduleEntries = request.dates.map(date => ({
          user_id: request.user_id,
          team_id: request.team_id,
          date: date,
          shift_type: 'normal' as const,
          activity_type: 'vacation' as const,
          availability_status: 'unavailable' as const,
          notes: request.notes || 'Approved vacation',
          created_by: currentUserId,
        }));

        const { error: scheduleError } = await supabase
          .from('schedule_entries')
          .upsert(scheduleEntries, {
            onConflict: 'user_id,date,team_id',
            ignoreDuplicates: false
          });

        if (scheduleError) throw scheduleError;

        // Send notification
        await supabase.functions.invoke('vacation-request-notification', {
          body: {
            requestId: request.id,
            userId: request.user_id,
            status: 'approved',
            dates: request.dates,
          },
        });

        successCount++;
      } catch (error: any) {
        console.error('Error approving request:', error);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast({
        title: "Requests approved",
        description: `${successCount} request(s) approved successfully.${errorCount > 0 ? ` ${errorCount} failed.` : ''}`,
      });
    }

    if (errorCount > 0 && successCount === 0) {
      toast({
        title: "Error",
        description: "Failed to approve requests",
        variant: "destructive",
      });
    }

    setSelectedRequestIds(new Set());
    await fetchRequests();
    onRequestProcessed?.();
  };

  const handleBulkReject = async () => {
    if (selectedRequestIds.size === 0 || !bulkRejectionReason.trim()) return;

    const requestsToReject = groupedRequests.filter(r => selectedRequestIds.has(r.id));
    let successCount = 0;
    let errorCount = 0;

    for (const request of requestsToReject) {
      try {
        const { error: updateError } = await supabase
          .from('vacation_requests')
          .update({ 
            status: 'rejected',
            rejection_reason: bulkRejectionReason,
            approver_id: currentUserId 
          })
          .in('id', request.requestIds);

        if (updateError) throw updateError;

        // Send notification
        await supabase.functions.invoke('vacation-request-notification', {
          body: {
            requestId: request.id,
            userId: request.user_id,
            status: 'rejected',
            rejectionReason: bulkRejectionReason,
          },
        });

        successCount++;
      } catch (error: any) {
        console.error('Error rejecting request:', error);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast({
        title: "Requests rejected",
        description: `${successCount} request(s) rejected.${errorCount > 0 ? ` ${errorCount} failed.` : ''}`,
      });
    }

    if (errorCount > 0 && successCount === 0) {
      toast({
        title: "Error",
        description: "Failed to reject requests",
        variant: "destructive",
      });
    }

    setBulkRejectDialogOpen(false);
    setBulkRejectionReason('');
    setSelectedRequestIds(new Set());
    await fetchRequests();
    onRequestProcessed?.();
  };

  const renderRequest = (request: GroupedRequest) => {
    const isMultiDay = request.dates.length > 1;
    
    const dateStr = isMultiDay
      ? `${format(new Date(request.startDate), 'MMM d, yyyy')} - ${format(new Date(request.endDate), 'MMM d, yyyy')}`
      : format(new Date(request.startDate), 'EEEE, MMMM d, yyyy');
    
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

    const isSelected = selectedRequestIds.has(request.id);
    const showCheckbox = isPlanner && request.status === 'pending';

    return (
      <Card key={request.id} className="mb-3 hover:shadow-md transition-shadow">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              {showCheckbox && (
                <div className="pt-1">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleRequestSelection(request.id)}
                  />
                </div>
              )}
              <div className="flex-1">
                {isPlanner && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-full bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <span className="font-semibold text-base">
                        {formatUserName(request.requester.first_name, request.requester.last_name)}
                      </span>
                      <span className="text-sm text-muted-foreground ml-2">• {request.team.name}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <span className="font-medium">{dateStr}</span>
                      {isMultiDay && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          ({request.dates.length} working days)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className={request.is_full_day ? "font-medium" : ""}>{timeStr}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={config.variant} className="gap-1.5 px-3 py-1">
                    <StatusIcon className="h-3.5 w-3.5" />
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </Badge>
                  {request.approver && (request.status === 'approved' || request.status === 'rejected') && (
                    <span className="text-xs text-muted-foreground">
                      by {request.approver.initials || formatUserName(request.approver.first_name, request.approver.last_name)}
                    </span>
                  )}
                </div>

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

                {/* Show Edit/Cancel buttons for request owner (even if they're a planner) */}
                {currentUserId === request.user_id && request.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(request)}
                      disabled={processingId === request.id}
                      className="gap-1.5"
                    >
                      <FileText className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openCancelDialog(request)}
                      disabled={processingId === request.id}
                      className="gap-1.5"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel
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

  const pendingRequests = groupedRequests.filter((r) => r.status === 'pending');
  const approvedRequests = groupedRequests.filter((r) => r.status === 'approved');
  const rejectedRequests = groupedRequests.filter((r) => r.status === 'rejected');

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
                <>
                  {isPlanner && pendingRequests.length > 0 && (
                    <div className="mb-4 p-4 border rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedRequestIds.size === pendingRequests.length && pendingRequests.length > 0}
                            onCheckedChange={() => toggleSelectAll(pendingRequests)}
                          />
                          <span className="text-sm font-medium">
                            {selectedRequestIds.size > 0 
                              ? `${selectedRequestIds.size} selected` 
                              : 'Select all'}
                          </span>
                        </div>
                        {selectedRequestIds.size > 0 && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleBulkApprove}
                              disabled={processingId !== null}
                              className="gap-1.5"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve Selected ({selectedRequestIds.size})
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setBulkRejectDialogOpen(true)}
                              disabled={processingId !== null}
                              className="gap-1.5"
                            >
                              <XCircle className="h-4 w-4" />
                              Reject Selected ({selectedRequestIds.size})
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    {pendingRequests.map(renderRequest)}
                  </div>
                </>
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

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Vacation Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this vacation request? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
              <p className="text-sm">
                <strong>Dates:</strong> {format(new Date(selectedRequest.startDate), 'MMM d, yyyy')}
                {selectedRequest.dates.length > 1 && ` - ${format(new Date(selectedRequest.endDate), 'MMM d, yyyy')}`}
              </p>
              <p className="text-sm">
                <strong>Working days:</strong> {selectedRequest.dates.length}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelDialogOpen(false);
                setSelectedRequest(null);
              }}
              disabled={processingId !== null}
            >
              Keep Request
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={processingId !== null}
            >
              {processingId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Reject Dialog */}
      <Dialog open={bulkRejectDialogOpen} onOpenChange={setBulkRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Multiple Requests</DialogTitle>
            <DialogDescription>
              Rejecting {selectedRequestIds.size} vacation request(s). Please provide a reason.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="bulk-rejection-reason">Reason *</Label>
            <Textarea
              id="bulk-rejection-reason"
              value={bulkRejectionReason}
              onChange={(e) => setBulkRejectionReason(e.target.value)}
              placeholder="Explain why these requests cannot be approved..."
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkRejectDialogOpen(false);
                setBulkRejectionReason('');
              }}
              disabled={processingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkReject}
              disabled={processingId !== null || !bulkRejectionReason.trim()}
            >
              {processingId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject {selectedRequestIds.size} Request(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
