import { VacationRequest } from '@/hooks/useVacationPlanning';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, Clock, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

interface VacationPipelineProps {
  vacationRequests: VacationRequest[];
  capacityData: any[];
  teams: Array<{ id: string; name: string }>;
  loading: boolean;
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string, reason: string) => Promise<void>;
  onRefresh: () => void;
  canEditTeam: (teamId: string) => boolean;
  isAdmin: boolean;
  isPlanner: boolean;
}

export const VacationPipeline = ({
  vacationRequests,
  capacityData,
  teams,
  loading,
  onApprove,
  onReject,
  onRefresh,
  canEditTeam,
  isAdmin,
  isPlanner
}: VacationPipelineProps) => {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleApprove = async (requestId: string) => {
    setProcessing(true);
    await onApprove(requestId);
    setProcessing(false);
  };

  const handleRejectClick = (requestId: string) => {
    setSelectedRequestId(requestId);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedRequestId) return;
    
    setProcessing(true);
    await onReject(selectedRequestId, rejectionReason);
    setProcessing(false);
    setRejectDialogOpen(false);
  };

  const pendingRequests = vacationRequests.filter(r => r.status === 'pending');
  const approvedRequests = vacationRequests.filter(r => r.status === 'approved');
  const rejectedRequests = vacationRequests.filter(r => r.status === 'rejected');

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const RequestCard = ({ request }: { request: VacationRequest }) => {
    const canEdit = isAdmin || isPlanner || canEditTeam(request.team_id);
    
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <div>
                <div className="font-semibold">
                  {request.profiles?.first_name} {request.profiles?.last_name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {request.teams?.name}
                </div>
              </div>
              {!canEdit && (
                <Badge variant="outline" className="text-xs">
                  Read Only
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {format(parseISO(request.requested_date), 'MMM d, yyyy')}
              </div>
              {!request.is_full_day && request.start_time && request.end_time && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {request.start_time} - {request.end_time}
                </div>
              )}
              <Badge variant={request.is_full_day ? 'default' : 'outline'}>
                {request.is_full_day ? 'Full Day' : 'Partial'}
              </Badge>
            </div>

            {request.notes && (
              <div className="text-sm text-muted-foreground">
                Note: {request.notes}
              </div>
            )}

            {request.rejection_reason && (
              <div className="text-sm text-destructive">
                Reason: {request.rejection_reason}
              </div>
            )}
          </div>

          {request.status === 'pending' && canEdit && (
            <div className="flex gap-2 ml-4">
              <Button
                size="sm"
                variant="default"
                onClick={() => handleApprove(request.id)}
                disabled={processing}
              >
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleRejectClick(request.id)}
                disabled={processing}
              >
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </div>
          )}

          {request.status === 'approved' && (
            <Badge variant="default" className="bg-success text-success-foreground">
              <Check className="h-3 w-3 mr-1" />
              Approved
            </Badge>
          )}

          {request.status === 'rejected' && (
            <Badge variant="destructive">
              <X className="h-3 w-3 mr-1" />
              Rejected
            </Badge>
          )}
        </div>
      </Card>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {/* Pending Section */}
        {pendingRequests.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-warning" />
              <h3 className="text-lg font-semibold">Pending Approval</h3>
              <Badge variant="secondary">{pendingRequests.length}</Badge>
            </div>
            <div className="space-y-2">
              {pendingRequests.map(request => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
          </div>
        )}

        {/* Approved Section */}
        {approvedRequests.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Check className="h-5 w-5 text-success" />
              <h3 className="text-lg font-semibold">Approved</h3>
              <Badge variant="secondary">{approvedRequests.length}</Badge>
            </div>
            <div className="space-y-2">
              {approvedRequests.map(request => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
          </div>
        )}

        {/* Rejected Section */}
        {rejectedRequests.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <X className="h-5 w-5 text-destructive" />
              <h3 className="text-lg font-semibold">Rejected</h3>
              <Badge variant="secondary">{rejectedRequests.length}</Badge>
            </div>
            <div className="space-y-2">
              {rejectedRequests.map(request => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
          </div>
        )}

        {vacationRequests.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No vacation requests in the selected date range
          </div>
        )}
      </div>

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Vacation Request</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Reason</Label>
            <Textarea
              id="rejection-reason"
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirm}
              disabled={!rejectionReason.trim() || processing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
