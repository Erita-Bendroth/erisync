import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeftRight, Clock, CheckCircle, XCircle, Ban, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface SwapRequest {
  id: string;
  requesting_user_id: string;
  target_user_id: string;
  swap_date: string;
  status: string;
  reason: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  team_id: string;
  requesting_user: { first_name: string; last_name: string };
  target_user: { first_name: string; last_name: string };
  requesting_entry: { shift_type: string; team_id: string; teams: { name: string } };
  target_entry: { shift_type: string; team_id: string; teams: { name: string } };
}

export function ShiftSwapRequestsList() {
  const { user } = useAuth();
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchSwapRequests();
    }
  }, [user]);

  const fetchSwapRequests = async () => {
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
      .or(`requesting_user_id.eq.${user.id},target_user_id.eq.${user.id},reviewed_by.eq.${user.id}`)
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

  const handleCancel = async (requestId: string) => {
    setCancellingId(requestId);
    const { error } = await supabase
      .from('shift_swap_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to cancel request',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Request Cancelled',
        description: 'Your swap request has been cancelled'
      });
      fetchSwapRequests();
    }
    setCancellingId(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      case 'cancelled':
      case 'expired':
        return <Ban className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: 'secondary',
      approved: 'default',
      rejected: 'destructive',
      cancelled: 'outline',
      expired: 'outline'
    };
    return (
      <Badge variant={variants[status] || 'secondary'} className="gap-1">
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
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

  const filterRequests = (status: string | null) => {
    if (status === null) return swapRequests;
    return swapRequests.filter(req => req.status === status);
  };

  const renderRequest = (request: SwapRequest) => {
    const isRequester = request.requesting_user_id === user?.id;
    const otherUser = isRequester ? request.target_user : request.requesting_user;
    const myShift = isRequester ? request.requesting_entry : request.target_entry;
    const theirShift = isRequester ? request.target_entry : request.requesting_entry;
    const isCrossTeam = request.requesting_entry.team_id !== request.target_entry.team_id;

    return (
      <Card key={request.id}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                Swap with {otherUser.first_name} {otherUser.last_name}
                {isCrossTeam && (
                  <Badge variant="outline" className="text-xs">
                    Cross-team
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {format(new Date(request.swap_date), 'EEEE, MMMM d, yyyy')}
              </CardDescription>
              {isCrossTeam && (
                <p className="text-xs text-muted-foreground">
                  {myShift.teams?.name} ↔ {theirShift.teams?.name}
                </p>
              )}
            </div>
            {getStatusBadge(request.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex-1 p-2 rounded bg-muted/50">
              <p className="text-xs text-muted-foreground">Your Shift</p>
              <p className="font-medium">{getShiftLabel(myShift.shift_type)}</p>
            </div>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 p-2 rounded bg-muted/50">
              <p className="text-xs text-muted-foreground">Their Shift</p>
              <p className="font-medium">{getShiftLabel(theirShift.shift_type)}</p>
            </div>
          </div>

          {request.reason && (
            <div className="text-sm">
              <p className="text-muted-foreground mb-1">Reason:</p>
              <p className="text-sm">{request.reason}</p>
            </div>
          )}

          {request.review_notes && (
            <div className="text-sm border-t pt-3">
              <p className="text-muted-foreground mb-1">Manager's Notes:</p>
              <p className="text-sm">{request.review_notes}</p>
            </div>
          )}

          {request.status === 'pending' && isRequester && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCancel(request.id)}
              disabled={cancellingId === request.id}
              className="w-full"
            >
              {cancellingId === request.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Cancel Request
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            Requested {format(new Date(request.created_at), 'MMM d, yyyy h:mm a')}
          </p>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="all">All ({swapRequests.length})</TabsTrigger>
        <TabsTrigger value="pending">Pending ({filterRequests('pending').length})</TabsTrigger>
        <TabsTrigger value="approved">Approved ({filterRequests('approved').length})</TabsTrigger>
        <TabsTrigger value="rejected">Rejected ({filterRequests('rejected').length})</TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="space-y-4 mt-4">
        {swapRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-8 text-center">
              <ArrowLeftRight className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No swap requests yet</p>
            </CardContent>
          </Card>
        ) : (
          swapRequests.map(renderRequest)
        )}
      </TabsContent>

      <TabsContent value="pending" className="space-y-4 mt-4">
        {filterRequests('pending').map(renderRequest)}
      </TabsContent>

      <TabsContent value="approved" className="space-y-4 mt-4">
        {filterRequests('approved').map(renderRequest)}
      </TabsContent>

      <TabsContent value="rejected" className="space-y-4 mt-4">
        {filterRequests('rejected').map(renderRequest)}
      </TabsContent>
    </Tabs>
  );
}
