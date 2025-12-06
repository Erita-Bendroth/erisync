import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TimeSelect } from '@/components/ui/time-select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar, Clock, AlertCircle, Info, UserCheck } from 'lucide-react';
import { formatUserName } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileBottomSheet } from '@/components/mobile/MobileBottomSheet';
import { format } from 'date-fns';

interface Planner {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  initials?: string;
}

interface VacationRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestSubmitted: () => void;
  editRequest?: {
    id: string;
    groupId: string | null;
    startDate: string;
    endDate: string;
    dates: string[];
    is_full_day: boolean;
    start_time: string | null;
    end_time: string | null;
    notes: string | null;
    requestIds: string[];
    selected_planner_id?: string;
  } | null;
}

export const VacationRequestModal: React.FC<VacationRequestModalProps> = ({
  open,
  onOpenChange,
  onRequestSubmitted,
  editRequest,
}) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isFullDay, setIsFullDay] = useState(true);
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('16:30');
  const [notes, setNotes] = useState('');
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [selectedPlannerId, setSelectedPlannerId] = useState<string>('');
  const [loadingPlanners, setLoadingPlanners] = useState(true);

  // Reset form when modal closes to prevent state issues
  useEffect(() => {
    if (!open) {
      setStartDate(undefined);
      setEndDate(undefined);
      setIsFullDay(true);
      setStartTime('08:00');
      setEndTime('16:30');
      setNotes('');
      setSelectedPlannerId('');
    }
  }, [open]);

  // Fetch planners when modal opens
  useEffect(() => {
    if (open) {
      fetchPlanners();
      
      // Load edit data if editing
      if (editRequest) {
        setStartDate(new Date(editRequest.startDate));
        setEndDate(new Date(editRequest.endDate));
        setIsFullDay(editRequest.is_full_day);
        setStartTime(editRequest.start_time || '08:00');
        setEndTime(editRequest.end_time || '16:30');
        setNotes(editRequest.notes || '');
        if (editRequest.selected_planner_id) {
          setSelectedPlannerId(editRequest.selected_planner_id);
        }
      }
    }
  }, [open, editRequest]);

  const fetchPlanners = async () => {
    try {
      setLoadingPlanners(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's team AND check if they're a manager
      const { data: userTeamMember, error: teamError } = await supabase
        .from('team_members')
        .select('team_id, is_manager')
        .eq('user_id', user.id)
        .single();

      if (teamError || !userTeamMember) {
        console.error('Error fetching user team:', teamError);
        setPlanners([]);
        return;
      }

      let managers: any[] = [];

      // If user is a manager, look for approvers in the parent team hierarchy
      if (userTeamMember.is_manager) {
        // Get the team hierarchy to find parent team
        const { data: team, error: teamInfoError } = await supabase
          .from('teams')
          .select('id, name, parent_team_id')
          .eq('id', userTeamMember.team_id)
          .single();

        if (teamInfoError) throw teamInfoError;

        // Look for managers in parent team(s)
        if (team.parent_team_id) {
          // Get managers from parent team
          const { data: parentManagers, error: parentManagersError } = await supabase
            .from('team_members')
            .select(`
              user_id,
              profiles!team_members_user_id_fkey(
                user_id,
                first_name,
                last_name,
                email
              )
            `)
            .eq('team_id', team.parent_team_id)
            .eq('is_manager', true);

          if (parentManagersError) throw parentManagersError;
          managers = parentManagers || [];

          // If no managers in parent, try to find planners/admins
          if (managers.length === 0) {
            const { data: plannersList, error: plannersError } = await supabase
              .from('user_roles')
              .select(`
                user_id,
                profiles!user_roles_user_id_fkey(
                  user_id,
                  first_name,
                  last_name,
                  email
                )
              `)
              .in('role', ['planner', 'admin']);

            if (plannersError) throw plannersError;
            managers = plannersList || [];
          }
        } else {
          // No parent team, look for planners/admins globally
          const { data: plannersList, error: plannersError } = await supabase
            .from('user_roles')
            .select(`
              user_id,
              profiles!user_roles_user_id_fkey(
                user_id,
                first_name,
                last_name,
                email
              )
            `)
            .in('role', ['planner', 'admin']);

          if (plannersError) throw plannersError;
          managers = plannersList || [];
        }
      } else {
        // Regular team member: get managers from their own team
        const { data: teamManagers, error: managersError } = await supabase
          .from('team_members')
          .select(`
            user_id,
            profiles!team_members_user_id_fkey(
              user_id,
              first_name,
              last_name,
              email
            )
          `)
          .eq('team_id', userTeamMember.team_id)
          .eq('is_manager', true);

        if (managersError) throw managersError;
        managers = teamManagers || [];
      }

      // Transform to expected format
      const managerList = managers
        ?.filter(m => m.profiles)
        .map(m => ({
          user_id: m.profiles.user_id,
          first_name: m.profiles.first_name,
          last_name: m.profiles.last_name,
          email: m.profiles.email
        })) || [];

      setPlanners(managerList);
      
      // Auto-select first manager
      if (managerList.length > 0 && !selectedPlannerId) {
        setSelectedPlannerId(managerList[0].user_id);
      }
    } catch (error) {
      console.error('Error fetching managers:', error);
      toast({
        title: "Error",
        description: "Failed to load team manager",
        variant: "destructive",
      });
      setPlanners([]);
    } finally {
      setLoadingPlanners(false);
    }
  };

  // Calculate working days (excluding weekends)
  const getWorkingDays = (start: Date, end: Date): Date[] => {
    const days: Date[] = [];
    const current = new Date(start);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        days.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const workingDaysCount = startDate && endDate ? getWorkingDays(startDate, endDate).length : 0;

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Dates required",
        description: "Please select start and end dates for your vacation request.",
        variant: "destructive",
      });
      return;
    }

    if (endDate < startDate) {
      toast({
        title: "Invalid date range",
        description: "End date must be after or equal to start date.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedPlannerId) {
      toast({
        title: "Manager required",
        description: "Please select a manager to review your request.",
        variant: "destructive",
      });
      return;
    }

    if (!isFullDay && (!startTime || !endTime)) {
      toast({
        title: "Time required",
        description: "Please select start and end times for partial day vacation.",
        variant: "destructive",
      });
      return;
    }

    if (!isFullDay && startTime >= endTime) {
      toast({
        title: "Invalid time range",
        description: "End time must be after start time.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get user's team
      const { data: teamMember, error: teamError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single();

      if (teamError || !teamMember) {
        throw new Error("Unable to find your team assignment");
      }

      // Get all working days in the range
      const workingDays = getWorkingDays(startDate, endDate);

      if (workingDays.length === 0) {
        toast({
          title: "No working days",
          description: "The selected date range contains no working days.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (editRequest) {
        // DELETE old requests and CREATE new ones (simpler than trying to match dates)
        const { error: deleteError } = await supabase
          .from('vacation_requests')
          .delete()
          .in('id', editRequest.requestIds);

        if (deleteError) throw deleteError;
      }

      // Check for overlapping requests for each working day (skip if editing same dates)
      for (const day of workingDays) {
        const { data: hasOverlap, error: overlapError } = await supabase
          .rpc('check_vacation_overlap', {
            _user_id: user.id,
            _requested_date: format(day, 'yyyy-MM-dd'),
            _start_time: isFullDay ? null : startTime,
            _end_time: isFullDay ? null : endTime,
            _is_full_day: isFullDay,
          });

        if (overlapError) throw overlapError;

        if (hasOverlap) {
          toast({
            title: "Overlapping request",
            description: `You already have a vacation request for ${day.toLocaleDateString()}.`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Generate a group ID for multi-day requests (reuse if editing)
      const groupId = workingDays.length > 1 ? (editRequest?.groupId || crypto.randomUUID()) : null;

      // Create vacation requests for all working days
      const requests = workingDays.map(day => ({
        user_id: user.id,
        team_id: teamMember.team_id,
        requested_date: format(day, 'yyyy-MM-dd'),
        is_full_day: isFullDay,
        start_time: isFullDay ? null : startTime,
        end_time: isFullDay ? null : endTime,
        notes: notes.trim() || null,
        status: 'pending',
        selected_planner_id: selectedPlannerId,
        request_group_id: groupId,
      }));

      const { data: insertedRequests, error: insertError } = await supabase
        .from('vacation_requests')
        .insert(requests)
        .select();

      if (insertError) throw insertError;

      // Send notification for the first request (representing the range)
      if (insertedRequests && insertedRequests.length > 0) {
        const { error: notificationError } = await supabase.functions.invoke(
          'vacation-request-notification',
          {
            body: {
              requestId: insertedRequests[0].id,
              type: 'request',
            },
          }
        );

        if (notificationError) {
          console.error('Failed to send notification:', notificationError);
          // Don't fail the whole request if notification fails
        }
      }

      toast({
        title: editRequest ? "Request updated" : "Request submitted",
        description: `Your vacation request for ${workingDays.length} working day${workingDays.length > 1 ? 's' : ''} has been ${editRequest ? 'updated' : 'submitted for approval'}.`,
      });

      // Reset form
      setStartDate(undefined);
      setEndDate(undefined);
      setIsFullDay(true);
      setStartTime('08:00');
      setEndTime('16:30');
      setNotes('');
      setSelectedPlannerId('');
      
      onRequestSubmitted();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error submitting vacation request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit vacation request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isMobile = useIsMobile();

  const modalContent = (
    <>
      {!isMobile && (
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            {editRequest ? 'Edit Vacation Request' : 'Request Time Off'}
          </DialogTitle>
          <DialogDescription className="text-base">
            {editRequest 
              ? 'Update your vacation request details. The request will remain pending for approval.'
              : 'Submit your vacation request for manager approval. You\'ll receive an email notification once it\'s reviewed.'}
          </DialogDescription>
        </DialogHeader>
      )}

      <div className="space-y-5 py-4">
          {/* Info Alert */}
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-sm text-blue-800 dark:text-blue-300">
              Your vacation request will be sent to your team manager for review and approval.
            </AlertDescription>
          </Alert>

          {/* Manager Display */}
          <div className="space-y-2">
            <Label className="text-base font-semibold flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              Manager
            </Label>
            {loadingPlanners ? (
              <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading manager...</span>
              </div>
            ) : planners.length === 0 ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No manager assigned to your team. Please contact your administrator.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={selectedPlannerId} onValueChange={setSelectedPlannerId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Your team manager" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {planners.map((planner) => (
                    <SelectItem key={planner.user_id} value={planner.user_id}>
                      {formatUserName(planner.first_name, planner.last_name, planner.initials)}
                      {planner.email && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({planner.email})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Date Range Selection */}
          <div className="space-y-4">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Vacation Period *
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Start Date</Label>
                <DatePicker
                  date={startDate}
                  onDateChange={setStartDate}
                  placeholder="From"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">End Date</Label>
                <DatePicker
                  date={endDate}
                  onDateChange={setEndDate}
                  placeholder="To"
                />
              </div>
            </div>
            {startDate && endDate && workingDaysCount > 0 && (
              <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-sm text-blue-800 dark:text-blue-300">
                  You are requesting <strong>{workingDaysCount} working day{workingDaysCount > 1 ? 's' : ''}</strong> from{' '}
                  {startDate.toLocaleDateString()} to {endDate.toLocaleDateString()} (weekends excluded).
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Full Day Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex-1">
              <Label htmlFor="full-day" className="text-base font-semibold cursor-pointer">
                Full Day Off
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Toggle off to select specific hours
              </p>
            </div>
            <Switch
              id="full-day"
              checked={isFullDay}
              onCheckedChange={setIsFullDay}
            />
          </div>

          {/* Time Selection (Partial Day) */}
          {!isFullDay && (
            <div className="space-y-4 p-4 rounded-lg border bg-background">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Time Range
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Start Time</Label>
                  <TimeSelect
                    value={startTime}
                    onValueChange={setStartTime}
                    placeholder="From"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">End Time</Label>
                  <TimeSelect
                    value={endTime}
                    onValueChange={setEndTime}
                    placeholder="To"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-base font-semibold">
              Additional Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add context for your request (e.g., medical appointment, family event)..."
              className="resize-none min-h-[100px]"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !startDate || !endDate || !selectedPlannerId || planners.length === 0}
            className="w-full sm:w-auto gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? (editRequest ? 'Updating...' : 'Submitting...') : (editRequest ? 'Update Request' : 'Submit Request')}
          </Button>
        </DialogFooter>
      </>
    );

  if (isMobile) {
    return (
      <MobileBottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title={editRequest ? 'Edit Vacation Request' : 'Request Time Off'}
        description={editRequest 
          ? 'Update your vacation request details.'
          : 'Submit your vacation request for manager approval.'}
      >
        {modalContent}
      </MobileBottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {modalContent}
      </DialogContent>
    </Dialog>
  );
};
