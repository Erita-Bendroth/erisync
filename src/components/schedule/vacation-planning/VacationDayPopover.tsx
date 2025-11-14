import { useState } from 'react';
import { format } from 'date-fns';
import { VacationRequest } from '@/hooks/useVacationPlanning';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Clock, AlertTriangle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
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

interface VacationDayPopoverProps {
  day: Date;
  requests: VacationRequest[];
  capacity: {
    available: number;
    required: number;
    total: number;
    riskLevel: 'safe' | 'warning' | 'critical';
    capacities: any[];
  } | null;
  teams: Array<{ id: string; name: string }>;
  children: React.ReactNode;
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string, reason: string) => Promise<void>;
  onRefresh: () => void;
  canEditTeam: (teamId: string) => boolean;
  isAdmin: boolean;
  isPlanner: boolean;
}

export const VacationDayPopover = ({
  day,
  requests,
  capacity,
  teams,
  children,
  onApprove,
  onReject,
  onRefresh,
  canEditTeam,
  isAdmin,
  isPlanner
}: VacationDayPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  if (requests.length === 0 && !capacity) {
    return <>{children}</>;
  }

  const handleApprove = async (requestId: string) => {
    setProcessing(true);
    await onApprove(requestId);
    setProcessing(false);
    setOpen(false);
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
    setOpen(false);
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {children}
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-4" align="start">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-base mb-1">
                {format(day, 'EEEE, MMMM d, yyyy')}
              </h4>
              
              {capacity && (
                <div className="flex items-center gap-2 text-sm">
                  {capacity.riskLevel === 'critical' && (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  {capacity.riskLevel === 'warning' && (
                    <AlertTriangle className="h-4 w-4 text-warning" />
                  )}
                  <span className="text-muted-foreground">
                    Available: {capacity.available}/{capacity.total} 
                    {' '}(Required: {capacity.required})
                  </span>
                </div>
              )}
            </div>

            {pendingRequests.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-warning" />
                    <span className="font-medium text-sm">Pending Requests</span>
                    <Badge variant="secondary">{pendingRequests.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {pendingRequests.map(request => (
                      <div key={request.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium">
                              {request.profiles?.first_name} {request.profiles?.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {request.teams?.name}
                            </div>
                            {!request.is_full_day && request.start_time && request.end_time && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {request.start_time} - {request.end_time}
                              </div>
                            )}
                            {request.notes && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Note: {request.notes}
                              </div>
                            )}
                          </div>
                          <Badge variant={request.is_full_day ? "default" : "outline"}>
                            {request.is_full_day ? 'Full Day' : 'Partial'}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="flex-1"
                            onClick={() => handleApprove(request.id)}
                            disabled={processing}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1"
                            onClick={() => handleRejectClick(request.id)}
                            disabled={processing}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {approvedRequests.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="h-4 w-4 text-success" />
                    <span className="font-medium text-sm">Approved</span>
                    <Badge variant="secondary">{approvedRequests.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {approvedRequests.map(request => (
                      <div key={request.id} className="p-2 bg-success/5 border border-success/20 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">
                              {request.profiles?.first_name} {request.profiles?.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {request.teams?.name}
                              {!request.is_full_day && request.start_time && ` • ${request.start_time}-${request.end_time}`}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {request.is_full_day ? 'Full Day' : 'Partial'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

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
